import { createServerFn } from "@tanstack/react-start";
import type { Hit } from "@/data/catalog";

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Web";
  }
}

function toHits(label: string, results: { url?: string | null; title?: string | null; highlights?: string[] }[]): Hit[] {
  return results.flatMap((item, index) => {
    if (!item.url || !item.title) return [];
    return [
      {
        id: `exa-${label}-${index}`,
        kind: "store" as const,
        name: item.title.slice(0, 80),
        area: hostOf(item.url),
        address: item.url,
        miles: 0,
        price: 0,
        sizes: "See listing",
        stock: "in" as const,
        note: item.highlights?.[0] ?? "Live web result.",
      },
    ];
  });
}

async function placeFromCoords(lat: number, lng: number) {
  const response = await fetch(
    `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
  );
  if (!response.ok) return null;
  const body = (await response.json()) as {
    city?: string;
    locality?: string;
    principalSubdivision?: string;
  };
  const city = body.city || body.locality;
  const region = body.principalSubdivision;
  if (city && region) return `${city}, ${region}`;
  return city || region || null;
}

export const searchStores = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const src = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
    const query = String(src.query ?? "").trim().slice(0, 180);
    if (!query) throw new Error("A costume name is required.");
    const pieces = Array.isArray(src.pieces)
      ? src.pieces
          .map((piece) => String(piece).trim())
          .filter(Boolean)
          .slice(0, 6)
      : [];
    const lat = Number(src.lat);
    const lng = Number(src.lng);
    return {
      query,
      pieces,
      lat: Number.isFinite(lat) ? lat : undefined,
      lng: Number.isFinite(lng) ? lng : undefined,
    };
  })
  .handler(async ({ data }): Promise<{
    live: boolean;
    place: string;
    hits: Hit[];
    pieces: { name: string; hits: Hit[] }[];
  }> => {
    const key = process.env.EXA_API_KEY?.trim();
    let place = "New York City";
    if (data.lat != null && data.lng != null) {
      place = (await placeFromCoords(data.lat, data.lng).catch(() => null)) ?? place;
    }
    const emptyPieces = data.pieces.map((name) => ({ name, hits: [] as Hit[] }));
    if (!key) return { live: false, place, hits: [], pieces: emptyPieces };

    try {
      const { default: Exa } = await import("exa-js");
      const exa = new Exa(key);
      const search = (label: string, query: string) =>
        exa
          .search(query, {
            type: "auto",
            userLocation: "US",
            numResults: 3,
            contents: { highlights: true },
          })
          .then((result) => toHits(label, result.results))
          .catch(() => [] as Hit[]);

      const [hits, ...pieceHits] = await Promise.all([
        search("costume", `${data.query} halloween costume for sale or in stock near ${place}`),
        ...data.pieces.map((name) =>
          search(name, `${name} for sale in stock near ${place}`),
        ),
      ]);

      return {
        live: true,
        place,
        hits,
        pieces: data.pieces.map((name, index) => ({ name, hits: pieceHits[index] ?? [] })),
      };
    } catch {
      return { live: false, place, hits: [], pieces: emptyPieces };
    }
  });
