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
      { name: "Red puffer vest", image: "/items/vest.jpg", url: "https://www.walmart.com/ip/Puffer-Vest-for-Men-Fashion-2024-Solid-Color-Stand-Collar-Unisex-Zip-Up-Pockets-Down-Jacket-Sleeveless-Waistcoat-5X-Large-Red/5107433246" },
      { name: "Denim jacket", image: "/items/jacket.jpg", url: "https://www.walmart.com/ip/Wrangler-Men-s-Denim-Trucker-Jacket/1144122408" },
      { name: "Blue jeans", image: "/items/jeans.jpg", url: "https://www.walmart.com/ip/George-Men-s-Straight-Fit-Jeans/841628089" },
      { name: "White sneakers", image: "/items/sneakers.jpg", url: "https://www.walmart.com/ip/19386161626" },
    ],
  },
];

export function piecesFor(title: string): Piece[] {
  const q = title.toLowerCase();
  return LOOKS.find((look) => look.keys.some((key) => q.includes(key)))?.pieces ?? [];
}
