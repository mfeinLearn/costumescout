import { createServerFn } from "@tanstack/react-start";
import { FALLBACK_SPOT, type NearbyCloth } from "@/data/shops";

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

async function characterAgent(image: string) {
  const text = await grok([
    {
      role: "user",
      content: [
        { type: "input_image", image_url: image, detail: "high" },
        {
          type: "input_text",
          text: 'You only identify the person. Return JSON only: {"actor":"","show":"","title":""}. If they are an actor or a character, name them and the movie or show. If you are not sure, leave actor and show empty. Do not guess. Do not list clothes.',
        },
      ],
    },
  ]);
  const parsed = parseJson(text);
  return {
    title: String(parsed?.title || "Uploaded look").slice(0, 80),
    actor: String(parsed?.actor ?? "").slice(0, 80),
    show: String(parsed?.show ?? "").slice(0, 80),
  };
}

async function layersAgent(image: string) {
  const text = await grok([
    {
      role: "user",
      content: [
        { type: "input_image", image_url: image, detail: "high" },
        {
          type: "input_text",
          text: 'You only list clothing layers, outer to inner. Return JSON only: {"pieces":[]}. Each item is a short phrase with color and garment, like "red puffer vest". Wearable clothes only. No faces, hair, props, or background.',
        },
      ],
    },
  ]);
  const parsed = parseJson(text);
  return Array.isArray(parsed?.pieces)
    ? parsed.pieces.map((piece) => String(piece).trim()).filter(Boolean).slice(0, 5)
    : [];
}

async function clothesAgent(image: string, pieces: string[]) {
  if (pieces.length === 0) return [];
  const text = await grok([
    {
      role: "user",
      content: [
        { type: "input_image", image_url: image, detail: "high" },
        {
          type: "input_text",
          text: `Another agent suggested these items: ${JSON.stringify(pieces)}. Keep only ones that are actual wearable clothes visible in the photo. Drop props, hair, faces, and guesses. JSON only: {"pieces":[]}`,
        },
      ],
    },
  ]);
  const parsed = parseJson(text);
  const kept = Array.isArray(parsed?.pieces)
    ? parsed.pieces.map((piece) => String(piece).trim()).filter(Boolean).slice(0, 5)
    : [];
  return kept.length > 0 ? kept : pieces;
}

async function linkLive(url: string) {
  if (!/^https?:\/\//.test(url)) return false;
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8000),
    });
    const html = (await response.text()).slice(0, 2500);
    const title = html.match(/<title>([^<]{0,140})/i)?.[1]?.toLowerCase() ?? "";
    if (response.status === 404 || response.status === 410) return false;
    if (title.includes("404") || title.includes("page not found") || title.includes("not found")) return false;
    return response.status < 500;
  } catch {
    return false;
  }
}

async function nearAgent(
  place: string,
  rows: { piece: string; store: string; url: string }[],
) {
  const text = await grok(
    [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `The user is in ${place}. For each listing, decide if that garment is sold at a physical store within 25 miles. Online-only or far-away pages are not near. JSON only: {"rows":[{"piece":"","near":false,"miles":0,"where":""}]}\n${JSON.stringify(rows)}`,
          },
        ],
      },
    ],
    [{ type: "web_search" }],
    20000,
  );
  const parsed = parseJson(text);
  const verdicts = Array.isArray(parsed?.rows) ? parsed.rows : [];
  return rows.map((row, index) => {
    const verdict = verdicts[index] as { near?: boolean; miles?: number; where?: string } | undefined;
    const miles = Number(verdict?.miles);
    return {
      near: verdict?.near === true,
      miles: Number.isFinite(miles) ? miles : 0,
      where: String(verdict?.where ?? "").slice(0, 80),
    };
  });
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
    notes: string[];
  }> => {
    const [character, layers] = await Promise.all([
      characterAgent(data.image),
      layersAgent(data.image),
    ]);
    const pieces = await clothesAgent(data.image, layers);
    const look: Look = {
      title: character.show
        ? `${character.actor || character.title} in ${character.show}`
        : character.title,
      actor: character.actor,
      show: character.show,
      pieces: pieces.length > 0 ? pieces : [character.title],
    };

    const lat = data.lat ?? FALLBACK_SPOT.lat;
    const lng = data.lng ?? FALLBACK_SPOT.lng;
    const place =
      data.lat != null && data.lng != null
        ? ((await placeFromCoords(data.lat, data.lng).catch(() => null)) ?? "New York City")
        : "Brooklyn, New York";
    const listings = await Promise.all(
      look.pieces.map(async (piece) => {
        const listing = await exaPick(piece, place).catch(() => null);
        return {
          piece,
          url: listing?.url ?? "",
          store: listing?.store ?? "",
          image: listing?.image ?? "",
        };
      }),
    );
    const [near, liveFlags] = await Promise.all([
      nearAgent(
        place,
        listings.map((listing) => ({ piece: listing.piece, store: listing.store, url: listing.url })),
      ).catch(() => listings.map(() => ({ near: false, miles: 0, where: "" }))),
      Promise.all(listings.map((listing) => linkLive(listing.url))),
    ]);
    const found = listings.map((listing, index) => {
      const verdict = near[index] ?? { near: false, miles: 0, where: "" };
      const live = liveFlags[index] === true;
      const close = verdict.near && live;
      return {
        id: `look-${index}-${listing.piece}`,
        piece: listing.piece,
        image: close ? listing.image : "",
        shop: !listing.url ? "No store page" : !live ? "Link is a 404" : !verdict.near ? "Not near you" : listing.store,
        address: close ? verdict.where || place : place,
        miles: close ? verdict.miles : 0,
        lat,
        lng,
        url: close ? listing.url : "",
        productUrl: close ? listing.url : "",
      } satisfies NearbyCloth;
    });

    const notes = [
      `Agent 1, character: ${look.actor || "not identified"}${look.show ? ` in ${look.show}` : ""}.`,
      `Agent 2, layers: ${layers.join(", ") || "none"}.`,
      `Agent 3, clothes check: ${pieces.join(", ") || "none kept"}.`,
      `Agent 4, near ${place}: ${found.filter((item) => item.shop !== "Not near you" && item.url).length} of ${found.length} are close.`,
      `Agent 5, live link: ${liveFlags.filter(Boolean).length} of ${listings.length} pages loaded. 404s were dropped.`,
    ];

    return {
      title: look.title,
      actor: look.actor,
      show: look.show,
      place,
      pieces: found,
      exa: Boolean(process.env.EXA_API_KEY?.trim()),
      notes,
    };
  });
