import type { Hit } from "@/data/catalog";

const KEY = "costumescout.listings.v1";
const WHOP_KEY = "costumescout.whop.v1";

export function loadListings(): Hit[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const extra = JSON.parse(raw) as Hit[];
    return Array.isArray(extra) ? extra : [];
  } catch {
    return [];
  }
}

export function saveListing(hit: Hit) {
  const raw = localStorage.getItem(KEY);
  const extra: Hit[] = raw ? (JSON.parse(raw) as Hit[]) : [];
  extra.unshift(hit);
  localStorage.setItem(KEY, JSON.stringify(extra));
}

export function loadWhopUrl() {
  if (typeof window === "undefined") return "https://whop.com";
  return localStorage.getItem(WHOP_KEY) || "https://whop.com";
}

export function saveWhopUrl(url: string) {
  localStorage.setItem(WHOP_KEY, url);
}

const LOOKS_KEY = "costumescout.looks.v1";

export type PastLook = {
  id: string;
  title: string;
  at: number;
  pieces: { name: string; shop: string; url: string }[];
};

export function loadLooks(): PastLook[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOOKS_KEY);
    if (!raw) return [];
    const looks = JSON.parse(raw) as PastLook[];
    return Array.isArray(looks) ? looks : [];
  } catch {
    return [];
  }
}

export function saveLook(look: PastLook) {
  const next = [look, ...loadLooks().filter((item) => item.id !== look.id)].slice(0, 12);
  localStorage.setItem(LOOKS_KEY, JSON.stringify(next));
  return next;
}
