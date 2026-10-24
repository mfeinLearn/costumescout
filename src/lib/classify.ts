import { createServerFn } from "@tanstack/react-start";
import { FALLBACK_SPOT, clothesNear, type NearbyCloth } from "@/data/shops";

type Look = {
  title: string;
  actor: string;
  show: string;
  pieces: string[];
};

function parseJson(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function grok(input: unknown, tools?: unknown[], timeout = 22000) {
  const key = process.env.XAI_API_KEY?.trim();
  if (!key) throw new Error("No vision key on this server.");
  const response = await fetch("https://api.x.ai/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "grok-4-fast-non-reasoning",
      temperature: 0.2,
      input,
      tools,
    }),
    signal: AbortSignal.timeout(timeout),
  });
  if (!response.ok) throw new Error(`Vision model failed (${response.status}).`);
  const body = (await response.json()) as {
    output?: { content?: { type?: string; text?: string }[] }[];
  };
  return (body.output ?? [])
    .flatMap((item) => item.content ?? [])
    .map((part) => part.text ?? "")
    .filter(Boolean)
    .join("\n");
}

async function placeFromCoords(lat: number, lng: number) {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
    { headers: { "User-Agent": "CostumeScout/1.0 (hackathon)" }, signal: AbortSignal.timeout(8000) },
  );
  if (!response.ok) return null;
  const body = (await response.json()) as { address?: Record<string, string> };
  const address = body.address ?? {};
  const city = address.city || address.town || address.village || address.suburb || address.borough;
  const region = address.state;
  if (city && region) return `${city}, ${region}`;
  return city || region || null;
}

function productImages(html: string) {
  const found = new Set<string>();
  const patterns = [
    /property=["']og:image["']\s+content=["']([^"']+)["']/gi,
    /content=["']([^"']+)["']\s+property=["']og:image["']/gi,
    /property=["']twitter:image["']\s+content=["']([^"']+)["']/gi,
    /"image"\s*:\s*"(https?:[^"]+)"/gi,
  ];
  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const image = match[1]?.replace(/\\u0026/g, "&").replace(/\\\//g, "/");
      if (!image?.startsWith("http")) continue;
      if (/logo|icon|sprite|avatar|favicon|map|badge|placeholder|\.svg(\?|$)/i.test(image)) continue;
      found.add(image);
      if (found.size >= 2) return [...found];
    }
  }
  return [...found];
}

async function pageImages(url: string) {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return [];
    const html = (await response.text()).slice(0, 160000);
    return productImages(html);
  } catch {
    return [];
  }
}

async function clothesIndexes(piece: string, images: string[]) {
  if (images.length === 0) return [];
  const text = await grok(
    [
      {
        role: "user",
        content: [
          ...images.map((image) => ({ type: "input_image" as const, image_url: image, detail: "low" as const })),
          {
            type: "input_text" as const,
            text: `Images are numbered from 0. Which ones are a photo of the clothing item "${piece}" — the garment itself, or a person wearing that garment? Reject logos, storefronts, maps, faces alone, and anything that is not clothes. JSON only: {"keep":[]}`,
          },
        ],
      },
    ],
    undefined,
    18000,
  );
  const parsed = parseJson(text);
  if (!Array.isArray(parsed?.keep)) return [];
  return parsed.keep.map(Number).filter((index) => index >= 0 && index < images.length);
}

async function exaPick(piece: string, place: string) {
  const key = process.env.EXA_API_KEY?.trim();
  if (!key) return null;
  const { default: Exa } = await import("exa-js");
  const exa = new Exa(key);
  const result = await exa.search(`buy ${piece} clothing product page near ${place}`, {
    type: "auto",
    userLocation: "US",
    numResults: 4,
    systemPrompt:
      "Prefer a retailer product page for this garment. Skip news, maps, social posts, and store homepages.",
    excludeDomains: [
      "wikipedia.org",
      "youtube.com",
      "reddit.com",
      "instagram.com",
      "facebook.com",
      "tiktok.com",
      "pinterest.com",
    ],
    contents: { highlights: true },
  });
  const pages = (result.results ?? []).filter((item) => item.url).slice(0, 4);
  const candidates: { url: string; store: string; image: string }[] = [];
  for (const page of pages) {
    const images = await pageImages(page.url);
    if (images[0]) candidates.push({ url: page.url, store: String(page.title || "Store").slice(0, 80), image: images[0] });
  }
  const keep = await clothesIndexes(piece, candidates.map((item) => item.image)).catch(() => []);
  const chosen = candidates[keep[0] ?? -1];
  if (chosen) return chosen;
  const fallback = pages[0];
  if (!fallback?.url) return null;
  return { url: fallback.url, store: String(fallback.title || "Store").slice(0, 80), image: "" };
}

async function whopCheckout(piece: string, storeUrl: string) {
  const key = process.env.WHOP_API_KEY?.trim();
  const company = process.env.WHOP_COMPANY_ID?.trim();
  if (!key || !company || !storeUrl) return "";
  const response = await fetch("https://api.whop.com/api/v1/checkout_configurations", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      currency: "usd",
      plan: { initial_price: 4, plan_type: "one_time", company_id: company },
      metadata: { piece, store: storeUrl },
    }),
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) return "";
  const body = (await response.json()) as { plan?: { id?: string }; id?: string };
  const planId = body.plan?.id || body.id;
  return planId ? `https://whop.com/checkout/${planId}` : "";
}

async function findPiece(piece: string, place: string) {
  const picked = await exaPick(piece, place);
  if (!picked) return { url: "", store: "", image: "", checkout: "" };
  const checkout = await whopCheckout(piece, picked.url);
  return { ...picked, checkout };
}

export const classifyLook = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const src = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
    const image = String(src.image ?? "");
    if (!image.startsWith("data:image/")) throw new Error("An image is required.");
    if (image.length > 1_800_000) throw new Error("That image is too large.");
    const lat = Number(src.lat);
    const lng = Number(src.lng);
    return {
      image,
      lat: Number.isFinite(lat) ? lat : undefined,
      lng: Number.isFinite(lng) ? lng : undefined,
    };
  })
  .handler(async ({ data }): Promise<{
    title: string;
    actor: string;
    show: string;
    place: string;
    pieces: NearbyCloth[];
    exa: boolean;
  }> => {
    const text = await grok([
      {
        role: "user",
        content: [
          { type: "input_image", image_url: data.image, detail: "high" },
          {
            type: "input_text",
            text: 'Classify this picture. Return JSON only: {"title":"","actor":"","show":"","pieces":[]}. pieces is 1 to 5 wearable clothing items only, each a short phrase with color and garment, like "red puffer vest". Do not include faces, hair, props, weapons, or background objects. If the person is an actor or a character, put their name in actor and the movie or show in show. If you are not sure, leave actor and show empty. Do not guess a celebrity.',
          },
        ],
      },
    ]);
    const parsed = parseJson(text);
    const look: Look = {
      title: String(parsed?.title || "Uploaded look").slice(0, 80),
      actor: String(parsed?.actor ?? "").slice(0, 80),
      show: String(parsed?.show ?? "").slice(0, 80),
      pieces: Array.isArray(parsed?.pieces)
        ? parsed.pieces.map((piece) => String(piece).trim()).filter(Boolean).slice(0, 5)
        : [],
    };
    if (look.pieces.length === 0) look.pieces = [look.title];

    const lat = data.lat ?? FALLBACK_SPOT.lat;
    const lng = data.lng ?? FALLBACK_SPOT.lng;
    const place =
      data.lat != null && data.lng != null
        ? ((await placeFromCoords(data.lat, data.lng).catch(() => null)) ?? "New York City")
        : "Brooklyn, New York";
    const shops = clothesNear(lat, lng, look.pieces);
    const found = await Promise.all(
      look.pieces.map(async (piece, index) => {
        const shop = shops[index] ?? shops[0];
        const listing = await findPiece(piece, place).catch(() => ({
          url: "",
          store: "",
          image: "",
          checkout: "",
        }));
        const picked = Boolean(listing.url);
        return {
          id: `look-${index}-${piece}`,
          piece,
          image: listing.image,
          shop: picked ? listing.store : "Exa did not pick a store",
          address: picked ? place : shop?.address || place,
          miles: picked ? 0 : shop?.miles ?? 0,
          lat: shop?.lat ?? lat,
          lng: shop?.lng ?? lng,
          url: listing.url || shop?.url || "",
          productUrl: listing.checkout || listing.url || "",
        } satisfies NearbyCloth;
      }),
    );

    return {
      title: look.title,
      actor: look.actor,
      show: look.show,
      place,
      pieces: found,
      exa: Boolean(process.env.EXA_API_KEY?.trim()),
    };
  });
