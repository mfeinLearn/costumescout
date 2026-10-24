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

async function pageImage(url: string) {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return "";
    const html = (await response.text()).slice(0, 120000);
    const match =
      html.match(/property=["']og:image["']\s+content=["']([^"']+)["']/i) ||
      html.match(/content=["']([^"']+)["']\s+property=["']og:image["']/i);
    const image = match?.[1] ?? "";
    return image.startsWith("http") ? image : "";
  } catch {
    return "";
  }
}

async function findPiece(piece: string, place: string) {
  const text = await grok(
    [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Search once for a current product page selling "${piece}" that ships to or is sold near ${place}. Reply with JSON only: {"title":"","url":"","store":""}. The url must be a page you opened. Do not invent a url.`,
          },
        ],
      },
    ],
    [{ type: "web_search" }],
    20000,
  );
  const parsed = parseJson(text);
  const url = String(parsed?.url ?? "");
  const store = String(parsed?.store || parsed?.title || "").slice(0, 80);
  if (!/^https?:\/\//.test(url)) return { url: "", store, image: "" };
  return { url, store, image: await pageImage(url) };
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
  }> => {
    const text = await grok([
      {
        role: "user",
        content: [
          { type: "input_image", image_url: data.image, detail: "high" },
          {
            type: "input_text",
            text: 'Classify this picture. Return JSON only: {"title":"","actor":"","show":"","pieces":[]}. pieces is 1 to 5 visible clothing items, each a short phrase with color and garment, like "red puffer vest". If the person is an actor or a character, put their name in actor and the movie or show in show. If you are not sure, leave actor and show empty. Do not guess a celebrity.',
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
        const listing = await findPiece(piece, place).catch(() => ({ url: "", store: "", image: "" }));
        return {
          id: `look-${index}-${piece}`,
          piece,
          image: listing.image,
          shop: listing.store || shop?.shop || "Listing",
          address: shop?.address || place,
          miles: shop?.miles ?? 0,
          lat: shop?.lat ?? lat,
          lng: shop?.lng ?? lng,
          url: shop?.url || listing.url || "https://www.google.com/search?q=" + encodeURIComponent(`${piece} near ${place}`),
          productUrl: listing.url || shop?.url || "",
        } satisfies NearbyCloth;
      }),
    );

    return { title: look.title, actor: look.actor, show: look.show, place, pieces: found };
  });
