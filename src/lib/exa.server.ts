import { createServerFn } from "@tanstack/react-start";
import type { Hit } from "@/data/catalog";

type ExaResult = {
  title?: string;
  url?: string;
  highlights?: string[];
};

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Web";
  }
}

export const searchStores = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const query =
      input && typeof input === "object" && "query" in input ? String(input.query) : "";
    const trimmed = query.trim().slice(0, 180);
    if (!trimmed) throw new Error("A costume name is required.");
    return { query: trimmed };
  })
  .handler(async ({ data }): Promise<{ live: boolean; hits: Hit[] }> => {
    const key = process.env.EXA_API_KEY?.trim();
    if (!key) return { live: false, hits: [] };

    const response = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
      },
      body: JSON.stringify({
        query: `${data.query} halloween costume in stock Brooklyn OR Manhattan Spirit Halloween OR "Party City" OR "Halloween Adventure" OR Target`,
        type: "auto",
        numResults: 6,
        contents: { highlights: { maxCharacters: 220 } },
      }),
    });

    if (!response.ok) return { live: false, hits: [] };

    const body = (await response.json()) as { results?: ExaResult[] };
    const hits: Hit[] = (body.results ?? [])
      .filter((result) => result.url && result.title)
      .map((result, index) => ({
        id: `exa-${index}`,
        kind: "store" as const,
        name: (result.title ?? "Listing").slice(0, 80),
        area: hostOf(result.url ?? ""),
        address: result.url ?? "",
        miles: 0,
        price: 0,
        sizes: "See listing",
        stock: "in" as const,
        note: result.highlights?.[0] ?? "Live web result.",
      }));

    return { live: hits.length > 0, hits };
  });
