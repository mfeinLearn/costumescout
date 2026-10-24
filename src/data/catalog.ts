export type Stock = "in" | "low" | "out";

export type Hit = {
  id: string;
  kind: "store" | "peer";
  name: string;
  area: string;
  address: string;
  miles: number;
  price: number;
  sizes: string;
  stock: Stock;
  note: string;
};

export type Costume = {
  id: string;
  title: string;
  aliases: string[];
  blurb: string;
  image: string;
  hits: Hit[];
};

export const SCOUT_PRICE = 4;
export const VERIFIED_PRICE = 7;
export const LISTING_CUT = 0.12;

export type Piece = { name: string; image: string; url: string };

const LOOKS: { keys: string[]; pieces: Piece[] }[] = [
  {
    keys: ["mac fly", "macfly", "mac-fly", "marty", "mcfly", "mc fly"],
    pieces: [
      { name: "Red puffer vest", image: "/stores/uniqlo-vest.jpg", url: "https://www.uniqlo.com/us/en/products/E487348-000/00" },
      { name: "Denim jacket", image: "/stores/uniqlo-denim.jpg", url: "https://www.uniqlo.com/us/en/products/E488726-000/00" },
      { name: "Blue jeans", image: "/stores/uniqlo-jeans.jpg", url: "https://www.uniqlo.com/us/en/products/E488684-000/00" },
      { name: "White sneakers", image: "/stores/nike-af1.png", url: "https://www.nike.com/t/air-force-1-07-mens-shoes-DZejrQoC" },
    ],
  },
];

export function piecesFor(title: string): Piece[] {
  const q = title.toLowerCase();
  return LOOKS.find((look) => look.keys.some((key) => q.includes(key)))?.pieces ?? [];
}
