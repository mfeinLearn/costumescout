import { createServerFn } from "@tanstack/react-start";
import type { Hit } from "@/data/catalog";

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

    try {
      const { default: Exa } = await import("exa-js");
      const exa = new Exa(key);
      const result = await exa.search(
        `${data.query} halloween costume for sale or in stock near Williamsburg Brooklyn New York`,
        {
          type: "auto",
          userLocation: "US",
          contents: { highlights: true },
        },
      );

      const hits: Hit[] = result.results.flatMap((item, index) => {
        if (!item.url || !item.title) return [];
        return [
          {
            id: `exa-${index}`,
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

      return { live: hits.length > 0, hits };
    } catch {
      return { live: false, hits: [] };
    }
  });
