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

export const COSTUMES: Costume[] = [
  {
    id: "gothic",
    title: "Gothic schoolgirl",
    aliases: ["wednesday", "addams", "gothic", "schoolgirl", "nevermore", "braids"],
    blurb: "Black dress, white collar, long braids. The one everyone is hunting this week.",
    image: "/costumes/gothic.jpg",
    hits: [
      {
        id: "g-spirit",
        kind: "store",
        name: "Spirit Halloween",
        area: "Atlantic Terminal",
        address: "139 Flatbush Ave, Brooklyn",
        miles: 2.4,
        price: 49.99,
        sizes: "S–XL",
        stock: "low",
        note: "Adult black dress + collar set. Two mediums left on the site listing.",
      },
      {
        id: "g-ricky",
        kind: "store",
        name: "Ricky’s NYC",
        area: "East Village",
        address: "88 E 7th St, New York",
        miles: 3.1,
        price: 64,
        sizes: "XS–L",
        stock: "in",
        note: "In-store rack, not the online SKU. Staff page lists it as in stock.",
      },
      {
        id: "g-party",
        kind: "store",
        name: "Party City",
        area: "Downtown Brooklyn",
        address: "445 Albee Square, Brooklyn",
        miles: 2.8,
        price: 39.99,
        sizes: "M–XL",
        stock: "out",
        note: "Page still up. Pickup says unavailable at this store.",
      },
    ],
  },
  {
    id: "ghost",
    title: "Ghost mask & robe",
    aliases: ["ghostface", "scream", "ghost", "mask", "stab"],
    blurb: "White robe, blank mask, black hood. Easy to find, sizes go first.",
    image: "/costumes/ghost.jpg",
    hits: [
      {
        id: "gh-spirit",
        kind: "store",
        name: "Spirit Halloween",
        area: "Williamsburg",
        address: "152 N 6th St, Brooklyn",
        miles: 0.6,
        price: 34.99,
        sizes: "One size + adult",
        stock: "in",
        note: "Aisle endcap. Mask and robe sold together.",
      },
      {
        id: "gh-target",
        kind: "store",
        name: "Target",
        area: "Atlantic Ave",
        address: "139 Flatbush Ave, Brooklyn",
        miles: 2.4,
        price: 30,
        sizes: "Adult",
        stock: "low",
        note: "Two robes, no extra masks.",
      },
      {
        id: "gh-adventure",
        kind: "store",
        name: "Halloween Adventure",
        area: "East Village",
        address: "104 Fourth Ave, New York",
        miles: 3.4,
        price: 42,
        sizes: "Adult",
        stock: "in",
        note: "Higher-quality robe. Open late this week.",
      },
    ],
  },
  {
    id: "stripes",
    title: "Striped suit",
    aliases: ["beetlejuice", "beetle", "stripes", "striped", "juice", "sandworm"],
    blurb: "Black and white stripes, wild wig optional. Peer sellers still have a few.",
    image: "/costumes/stripes.jpg",
    hits: [
      {
        id: "st-adventure",
        kind: "store",
        name: "Halloween Adventure",
        area: "East Village",
        address: "104 Fourth Ave, New York",
        miles: 3.4,
        price: 79,
        sizes: "S–L",
        stock: "low",
        note: "One large left on the floor. Wig sold separate.",
      },
      {
        id: "st-spirit",
        kind: "store",
        name: "Spirit Halloween",
        area: "Williamsburg",
        address: "152 N 6th St, Brooklyn",
        miles: 0.6,
        price: 54.99,
        sizes: "M–XL",
        stock: "out",
        note: "Sold through yesterday according to the store page.",
      },
    ],
  },
  {
    id: "vampire",
    title: "Vampire cape",
    aliases: ["vampire", "dracula", "cape", "fangs", "count"],
    blurb: "High collar, red lining. The reliable last-minute costume.",
    image: "/costumes/vampire.jpg",
    hits: [
      {
        id: "v-ricky",
        kind: "store",
        name: "Ricky’s NYC",
        area: "East Village",
        address: "88 E 7th St, New York",
        miles: 3.1,
        price: 38,
        sizes: "One size",
        stock: "in",
        note: "Cape only. Fangs at the counter for $6.",
      },
      {
        id: "v-party",
        kind: "store",
        name: "Party City",
        area: "Downtown Brooklyn",
        address: "445 Albee Square, Brooklyn",
        miles: 2.8,
        price: 24.99,
        sizes: "Adult",
        stock: "in",
        note: "Basic satin cape. Plenty of stock.",
      },
      {
        id: "v-spirit",
        kind: "store",
        name: "Spirit Halloween",
        area: "Atlantic Terminal",
        address: "139 Flatbush Ave, Brooklyn",
        miles: 2.4,
        price: 44.99,
        sizes: "S–XL",
        stock: "low",
        note: "Full costume with vest. Mediums only.",
      },
    ],
  },
  {
    id: "witch",
    title: "Classic witch",
    aliases: ["witch", "wicked", "broom", "hag", "sorceress"],
    blurb: "Pointed hat, black dress, optional broom. Everywhere, quality varies.",
    image: "/costumes/gothic.jpg",
    hits: [
      {
        id: "w-party",
        kind: "store",
        name: "Party City",
        area: "Downtown Brooklyn",
        address: "445 Albee Square, Brooklyn",
        miles: 2.8,
        price: 29.99,
        sizes: "S–XL",
        stock: "in",
        note: "Hat included. Dress runs small.",
      },
      {
        id: "w-target",
        kind: "store",
        name: "Target",
        area: "Atlantic Ave",
        address: "139 Flatbush Ave, Brooklyn",
        miles: 2.4,
        price: 25,
        sizes: "Adult",
        stock: "in",
        note: "Hyde & EEK rack near seasonal.",
      },
      {
        id: "w-spirit",
        kind: "store",
        name: "Spirit Halloween",
        area: "Williamsburg",
        address: "152 N 6th St, Brooklyn",
        miles: 0.6,
        price: 36.99,
        sizes: "XS–L",
        stock: "low",
        note: "Deluxe hat sold out. Dress still up.",
      },
    ],
  },
  {
    id: "skeleton",
    title: "Skeleton",
    aliases: ["skeleton", "bones", "skull", "skelly"],
    blurb: "Printed bones on black. The backup when the character costume is gone.",
    image: "/costumes/ghost.jpg",
    hits: [
      {
        id: "sk-target",
        kind: "store",
        name: "Target",
        area: "Atlantic Ave",
        address: "139 Flatbush Ave, Brooklyn",
        miles: 2.4,
        price: 22,
        sizes: "S–XXL",
        stock: "in",
        note: "Jumpsuit. Glow print.",
      },
      {
        id: "sk-spirit",
        kind: "store",
        name: "Spirit Halloween",
        area: "Williamsburg",
        address: "152 N 6th St, Brooklyn",
        miles: 0.6,
        price: 29.99,
        sizes: "Adult",
        stock: "in",
        note: "Morphsuit and a separate ribcage vest.",
      },
    ],
  },
];

export const SEED_LISTINGS: Hit[] = [
  {
    id: "peer-cape",
    kind: "peer",
    name: "Used vampire cape",
    area: "Greenpoint",
    address: "Pickup near McCarren Park",
    miles: 1.2,
    price: 18,
    sizes: "One size",
    stock: "in",
    note: "Worn once. Red lining intact. Seller: Mara.",
  },
  {
    id: "peer-stripes",
    kind: "peer",
    name: "Striped suit, size M",
    area: "Bushwick",
    address: "Meetup at Jefferson St L",
    miles: 1.8,
    price: 40,
    sizes: "M",
    stock: "in",
    note: "Includes wig. No stains. Seller: Jules.",
  },
];

export function matchCostume(query: string): Costume | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  let best: { costume: Costume; score: number } | null = null;
  for (const costume of COSTUMES) {
    let score = 0;
    if (costume.title.toLowerCase().includes(q) || q.includes(costume.title.toLowerCase())) {
      score += 5;
    }
    for (const alias of costume.aliases) {
      if (q.includes(alias) || alias.includes(q)) score += alias.length > 3 ? 4 : 2;
    }
    if (score > 0 && (!best || score > best.score)) best = { costume, score };
  }
  return best?.costume ?? null;
}

export function genericHits(title: string): Hit[] {
  return [
    {
      id: "gen-spirit",
      kind: "store",
      name: "Spirit Halloween",
      area: "Williamsburg",
      address: "152 N 6th St, Brooklyn",
      miles: 0.6,
      price: 44.99,
      sizes: "Check in store",
      stock: "low",
      note: `Search hit for “${title}”. Page exists; sizes not listed.`,
    },
    {
      id: "gen-adventure",
      kind: "store",
      name: "Halloween Adventure",
      area: "East Village",
      address: "104 Fourth Ave, New York",
      miles: 3.4,
      price: 55,
      sizes: "Ask the floor",
      stock: "in",
      note: "Shop stocks one-offs. Worth a call before the trek.",
    },
    {
      id: "gen-party",
      kind: "store",
      name: "Party City",
      area: "Downtown Brooklyn",
      address: "445 Albee Square, Brooklyn",
      miles: 2.8,
      price: 34.99,
      sizes: "M–XL",
      stock: "out",
      note: "Closest chain match is sold out for pickup.",
    },
  ];
}
