export type NearbyCloth = {
  id: string;
  piece: string;
  image: string;
  shop: string;
  address: string;
  miles: number;
  lat: number;
  lng: number;
  url: string;
  productUrl: string;
  shots?: { image: string; url: string }[];
};

type Shop = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  carries: string;
  shoes: boolean;
  costume: boolean;
  url: string;
};

// Coordinates checked against OpenStreetMap. Used only to sort by the phone's location.
const SHOPS: Shop[] = [
  { id: "beacons", name: "Beacon's Closet", address: "74 Guernsey St, Brooklyn", lat: 40.7236707, lng: -73.9525839, carries: "Secondhand vest and jacket", shoes: false, costume: false, url: "https://beaconscloset.com/pages/greenpoint" },
  { id: "buffalo", name: "Buffalo Exchange", address: "504 Driggs Ave, Brooklyn", lat: 40.7183158, lng: -73.9552362, carries: "Secondhand jeans and jacket", shoes: false, costume: false, url: "https://buffaloexchange.com/location/williamsburg-new-york/" },
  { id: "amarcord", name: "Amarcord Vintage", address: "223 Bedford Ave, Brooklyn", lat: 40.7163655, lng: -73.9591388, carries: "Vintage jacket", shoes: false, costume: false, url: "https://www.amarcordvintagefashion.com/" },
  { id: "monk", name: "Monk Vintage", address: "500 Driggs Ave, Brooklyn", lat: 40.7183403, lng: -73.9551992, carries: "Vintage clothes", shoes: false, costume: false, url: "https://www.instagram.com/monkvintage/" },
  { id: "hm", name: "H&M", address: "497 Fulton Mall, Brooklyn", lat: 40.6907449, lng: -73.985152, carries: "New jeans and jacket", shoes: false, costume: false, url: "https://www2.hm.com/en_us/men/products/jackets-coats/jackets.html" },
  { id: "uniqlo", name: "Uniqlo", address: "546 Broadway, Manhattan", lat: 40.7235022, lng: -73.998176, carries: "New jacket and jeans", shoes: false, costume: false, url: "https://www.uniqlo.com/us/en/products/E487348-000/00" },
  { id: "zara", name: "Zara", address: "Broadway, Manhattan", lat: 40.7225116, lng: -73.9994791, carries: "New jacket", shoes: false, costume: false, url: "https://www.zara.com/us/en/man-jackets-denim-l648.html" },
  { id: "kith", name: "Kith", address: "337 Lafayette St, Manhattan", lat: 40.7260461, lng: -73.9943647, carries: "Sneakers", shoes: true, costume: false, url: "https://kith.com/pages/locations" },
  { id: "nike", name: "Nike Community Store", address: "21 Mercer St, Manhattan", lat: 40.7206891, lng: -74.0020439, carries: "Sneakers", shoes: true, costume: false, url: "https://www.nike.com" },
  { id: "footlocker", name: "Foot Locker", address: "1268 Fulton St, Brooklyn", lat: 40.6802095, lng: -73.9501081, carries: "Sneakers", shoes: true, costume: false, url: "https://www.footlocker.com" },
  { id: "spirit", name: "Spirit Halloween", address: "490 Fulton Mall, Brooklyn", lat: 40.6897009, lng: -73.9833081, carries: "Costume", shoes: false, costume: true, url: "https://www.spirithalloween.com" },
  { id: "goodwill", name: "Goodwill", address: "42 Bond St, Brooklyn", lat: 40.6885543, lng: -73.9840421, carries: "Secondhand clothes", shoes: false, costume: false, url: "https://www.goodwillnynj.org" },
];

export const FALLBACK_SPOT = { lat: 40.7218, lng: -73.9645 };

function milesBetween(lat: number, lng: number, lat2: number, lng2: number) {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat) * rad;
  const dLng = (lng2 - lng) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(a));
}

function wantsShoes(piece: string) {
  return /sneaker|shoe|boot/.test(piece.toLowerCase());
}

export function clothesNear(lat: number, lng: number, pieces: string[]): NearbyCloth[] {
  const ranked = SHOPS.map((shop) => ({ ...shop, miles: milesBetween(lat, lng, shop.lat, shop.lng) })).sort(
    (a, b) => a.miles - b.miles,
  );
  const used = new Set<string>();
  const rows: NearbyCloth[] = [];
  const wanted = pieces.length ? pieces : ranked.slice(0, 6).map((shop) => shop.carries);

  for (const piece of wanted) {
    const shoes = wantsShoes(piece);
    const shop =
      ranked.find((item) => !used.has(item.id) && (shoes ? item.shoes : !item.shoes)) ??
      ranked.find((item) => (shoes ? item.shoes : true));
    if (!shop || used.has(shop.id)) continue;
    used.add(shop.id);
    rows.push({
      id: `${shop.id}-${piece}`,
      piece,
      image: "",
      shop: shop.name,
      address: shop.address,
      miles: shop.miles,
      lat: shop.lat,
      lng: shop.lng,
      url: shop.url,
      productUrl: "",
    });
  }

  return rows.sort((a, b) => a.miles - b.miles);
}
