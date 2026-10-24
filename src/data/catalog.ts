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

export type Piece = { name: string; image: string };

const LOOKS: { keys: string[]; pieces: Piece[] }[] = [
  {
    keys: ["mac fly", "macfly", "mac-fly", "marty", "mcfly", "mc fly"],
    pieces: [
      { name: "Red puffer vest", image: "/pieces/vest.jpg" },
      { name: "Denim jacket", image: "/pieces/jacket.jpg" },
      { name: "Blue jeans", image: "/pieces/jeans.jpg" },
      { name: "White sneakers", image: "/pieces/sneakers.jpg" },
    ],
  },
];

export function piecesFor(title: string): Piece[] {
  const q = title.toLowerCase();
  return LOOKS.find((look) => look.keys.some((key) => q.includes(key)))?.pieces ?? [];
}
