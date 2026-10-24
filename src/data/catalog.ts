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
