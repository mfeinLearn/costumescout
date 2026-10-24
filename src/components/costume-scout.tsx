import { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  MapPin,
  ShieldCheck,
  ShoppingBag,
  Store,
  Upload,
} from "lucide-react";
import {
  LISTING_CUT,
  SCOUT_PRICE,
  VERIFIED_PRICE,
  type Costume,
  type Hit,
  type Stock,
} from "@/data/catalog";
import { loadListings, loadWhopUrl, saveListing, saveWhopUrl } from "@/lib/listings";
import { searchStores } from "@/lib/exa-search";
import { classifyLook } from "@/lib/classify";
import { FALLBACK_SPOT, clothesNear, type NearbyCloth } from "@/data/shops";

type Phase = "idle" | "running" | "ready" | "verifying" | "verified";

type LogLine = { id: string; text: string };

const STEPS = [
  { n: "01", title: "Upload", body: "Snap or type a character." },
  { n: "02", title: "Identify", body: "The agent names the costume." },
  { n: "03", title: "Search", body: "Nearby stores and the web." },
  { n: "04", title: "Match", body: "New stock plus peer listings." },
  { n: "05", title: "Transact", body: "Whop checkout. Agent keeps the cut." },
];

function wait(ms: number) {
  const reduce =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return new Promise((resolve) => setTimeout(resolve, reduce ? 40 : ms));
}

function locate(): Promise<{ lat: number; lng: number } | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  });
}

function fileToImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const draw = (source: CanvasImageSource, width: number, height: number) => {
      const scale = Math.min(1, 768 / Math.max(width, height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      canvas.getContext("2d")?.drawImage(source, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.72));
    };
    if (file.type.startsWith("video/")) {
      const video = document.createElement("video");
      video.preload = "auto";
      video.muted = true;
      video.playsInline = true;
      video.src = url;
      video.onloadeddata = () => {
        video.currentTime = Math.min(0.5, (video.duration || 1) / 3);
      };
      video.onseeked = () => draw(video, video.videoWidth, video.videoHeight);
      video.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Could not read that video."));
      };
      return;
    }
    const image = new Image();
    image.onload = () => draw(image, image.naturalWidth, image.naturalHeight);
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image."));
    };
    image.src = url;
  });
}

function stockLabel(stock: Stock) {
  if (stock === "in") return "In stock";
  if (stock === "low") return "Limited";
  return "Sold out";
}

function stockClass(stock: Stock) {
  if (stock === "in") return "text-good";
  if (stock === "low") return "text-warn";
  return "text-bad";
}

function relevantPeers(costume: Costume | null, query: string, peers: Hit[]) {
  const blob = `${costume?.title ?? ""} ${costume?.aliases.join(" ") ?? ""} ${query}`.toLowerCase();
  return peers.filter((peer) => {
    const text = `${peer.name} ${peer.note}`.toLowerCase();
    return blob.split(/\s+/).some((word) => word.length > 3 && text.includes(word));
  });
}

export function CostumeScout() {
  const [query, setQuery] = useState("");
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [log, setLog] = useState<LogLine[]>([]);
  const [costume, setCostume] = useState<Costume | null>(null);
  const [hits, setHits] = useState<Hit[]>([]);
  const [verifiedId, setVerifiedId] = useState<string | null>(null);
  const [teracNote, setTeracNote] = useState<string | null>(null);
  const [liveSearch, setLiveSearch] = useState(false);
  const [pieceHits, setPieceHits] = useState<Record<string, Hit[]>>({});
  const [place, setPlace] = useState<string | null>(null);
  const [nearby, setNearby] = useState<NearbyCloth[]>([]);
  const [lookPieces, setLookPieces] = useState<{ name: string; image: string; url: string }[]>([]);
  const photoDataRef = useRef<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [listings, setListings] = useState<Hit[]>([]);
  const [whopUrl, setWhopUrl] = useState("https://whop.com");
  const [checkout, setCheckout] = useState<"scout" | "verified" | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [seller, setSeller] = useState({
    title: "",
    area: "Williamsburg",
    price: "25",
    sizes: "M",
    note: "",
  });

  useEffect(() => {
    const loaded = loadListings();
    setListings(loaded);
    setWhopUrl(loadWhopUrl());
  }, []);

  useEffect(() => {
    return () => {
      if (photoUrl?.startsWith("blob:")) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  const exaQuery = useMemo(() => {
    const name = costume?.title ?? (query.trim() || "halloween costume");
    const where = place ?? "your location";
    return `${name} and its pieces near ${where}`;
  }, [costume, query, place]);

  const pieces = lookPieces;

  useEffect(() => {
    if (nearby.length === 0) return;
    listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [nearby]);

  async function runScout(override?: string) {
    const spotPromise = locate();
    const text =
      (override ?? query).trim() ||
      photoName?.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]/g, " ") ||
      "";
    if (!text && !photoDataRef.current) return;
    setPhase("running");
    setVerifiedId(null);
    setTeracNote(null);
    setCheckout(null);
    setLiveSearch(false);
    setPieceHits({});
    setLookPieces([]);
    setLog([{ id: "start", text: "Classifying the clothes, then searching each piece near you." }]);
    const spot = await spotPromise;
    const here = spot ?? FALLBACK_SPOT;
    let title = text || "Uploaded look";
    let actor = "";
    let show = "";
    let foundClothes = clothesNear(here.lat, here.lng, []);
    const image = photoDataRef.current;
    try {
      if (image) {
        const look = await classifyLook({ data: { image, lat: spot?.lat, lng: spot?.lng } });
        title = look.show ? `${look.actor || look.title} in ${look.show}` : look.title || title;
        actor = look.actor;
        show = look.show;
        foundClothes = look.pieces;
        setPlace(look.place);
        setLookPieces(
          look.pieces.map((piece) => ({ name: piece.piece, image: piece.image, url: piece.productUrl })),
        );
      } else {
        setPlace(spot ? "your location" : "Whop HQ");
      }
    } catch (error) {
      setPhase("ready");
      setLog([
        {
          id: "fail",
          text: error instanceof Error ? error.message : "Classification failed.",
        },
      ]);
      return;
    }
    setNearby(foundClothes);
    setHits(
      foundClothes.map((item) => ({
        id: item.id,
        kind: "store" as const,
        name: item.piece,
        area: item.shop,
        address: item.address,
        miles: item.miles,
        price: 0,
        sizes: "At the shop",
        stock: "in" as const,
        note: item.productUrl
          ? "Classified from the upload, then searched near you."
          : "Classified from the upload. No product page came back.",
      })),
    );
    setPhase("ready");
    const lines: LogLine[] = [];
    const push = async (textLine: string, ms: number) => {
      lines.push({ id: `${lines.length}-${textLine}`, text: textLine });
      setLog([...lines]);
      await wait(ms);
    };
    await push("Reading the request.", 420);
    await push(
      image
        ? "Classifying the clothes in the photo, and the actor if there is one."
        : "No photo. Searching the description.",
      40,
    );
    const found = null;
    await push(
      show ? `Actor: ${actor || "unknown"}. Show: ${show}.` : `Identified: ${title}.`,
      40,
    );
    await push(
      `Searching ${foundClothes.length} pieces near ${spot ? "you" : "Whop HQ"}.`,
      40,
    );
    const live = await searchStores({
      data: {
        query: title,
        pieces: foundClothes.map((piece) => piece.piece),
        lat: spot?.lat,
        lng: spot?.lng,
      },
    });
    setLiveSearch(live.live);
    if (live.live) setPlace(live.place);
    setPieceHits(Object.fromEntries(live.pieces.map((piece) => [piece.name, piece.hits])));
    await push(
      live.live
        ? `Exa checked ${live.place}. ${live.hits.length} costume listings, ${live.pieces.reduce((sum, piece) => sum + piece.hits.length, 0)} clothing listings.`
        : `Nearby shops are listed. Web search did not run.`,
      200,
    );
    const peers = relevantPeers(found, text, loadListings());
    const merged = [
      ...foundClothes.map((item) => ({
        id: item.id,
        kind: "store" as const,
        name: item.piece,
        area: item.shop,
        address: item.address,
        miles: item.miles,
        price: 0,
        sizes: "At the shop",
        stock: "in" as const,
        note: item.productUrl
          ? "Classified from the upload, then searched near you."
          : "Classified from the upload. No product page came back.",
      })),
      ...live.hits,
      ...peers,
    ];
    await push(
      `Matched ${live.hits.length} live results and ${peers.length} peer listings.`,
      200,
    );
    setCostume({
      id: "request",
      title,
      aliases: [],
      blurb: show
        ? `${actor ? `${actor} in ` : ""}${show}. Pieces were classified from the upload, then searched near ${place ?? "you"}.`
        : image
          ? "Pieces were classified from the upload, then searched near you."
          : "Matched from the name you gave.",
      image: photoUrl ?? "",
      hits: merged,
    });
    setHits(merged);
    setPhase("ready");
    await push(`${foundClothes.length} nearby clothes, plus ${live.hits.length} web listings.`, 80);
  }

  async function verify() {
    if (!hits.length || phase === "verifying") return;
    setPhase("verifying");
    const target = hits.find((hit) => hit.stock !== "out") ?? hits[0];
    const lines = [...log];
    const push = async (textLine: string, ms: number) => {
      lines.push({ id: `${lines.length}-v`, text: textLine });
      setLog([...lines]);
      await wait(ms);
    };
    await push("Paid verification. Routing a Terac task.", 400);
    await push(
      `Terac: check ${target.name}. Confirm “${costume?.title}” is actually there, with sizes and price.`,
      500,
    );
    const note = "Task sent. No expert reply yet, so stock was not changed.";
    setTeracNote(note);
    setPhase("verified");
    await push(note, 200);
  }

  function onPhoto(file: File | null) {
    if (!file) return;
    const nextName = query.trim() || file.name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]/g, " ");
    if (!query.trim()) setQuery(nextName);
    void fileToImage(file).then((data) => {
      photoDataRef.current = data;
      setPhotoName(file.name);
      setPhotoUrl(data);
      void runScout(nextName);
    });
  }

  function publishListing() {
    if (!seller.title.trim()) return;
    const hit: Hit = {
      id: `peer-${Date.now()}`,
      kind: "peer",
      name: seller.title.trim(),
      area: seller.area.trim() || "Brooklyn",
      address: "Peer pickup",
      miles: 0,
      price: Number(seller.price) || 20,
      sizes: seller.sizes.trim() || "One size",
      stock: "in",
      note: seller.note.trim() || "Listed during the hackathon.",
    };
    saveListing(hit);
    setListings(loadListings());
    setSeller({ title: "", area: "Williamsburg", price: "25", sizes: "M", note: "" });
    setListOpen(false);
  }

  const busy = phase === "running" || phase === "verifying";

  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-full bg-primary text-primary-ink">
              <ShoppingBag className="size-4" aria-hidden />
            </span>
            <div>
              <p className="font-display text-lg leading-none tracking-tight">CostumeScout</p>
              <p className="text-xs text-muted">Agent-run · Brooklyn tonight</p>
            </div>
          </div>
          <p className="hidden text-sm text-muted sm:block">Halloween is in 7 days. Good sizes are already gone.</p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-20 pt-8">
        <section className="grid items-end gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-sm font-medium tracking-wide text-primary">Zero-human company</p>
            <h1 className="mt-2 font-display text-4xl leading-[1.05] tracking-tight sm:text-6xl">
              Upload a photo.
              <br />
              Find the costume nearby.
            </h1>
            <p className="mt-4 max-w-xl text-base text-muted sm:text-lg">
              The agent identifies the character, checks stores around Whop HQ, and only calls a human
              when you pay to verify the piece is actually on the rack.
            </p>
          </div>
          <img
            src="/costumes/shop.jpg"
            alt="Dim costume shop with warm lights"
            className="h-52 w-full rounded-2xl object-cover sm:h-64"
          />
        </section>

        <ol className="mt-8 grid gap-3 sm:grid-cols-5">
          {STEPS.map((step) => (
            <li key={step.n} className="rounded-2xl border border-line bg-surface px-3 py-3">
              <p className="font-display text-sm text-primary">{step.n}</p>
              <p className="mt-1 font-medium">{step.title}</p>
              <p className="text-sm text-muted">{step.body}</p>
            </li>
          ))}
        </ol>

        <section className="mt-8 grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
          <form
            className="rounded-2xl border border-line bg-surface p-4 sm:p-5"
            onSubmit={(event) => {
              event.preventDefault();
              void runScout();
            }}
          >
            <label className="block text-sm font-medium" htmlFor="character">
              Character or costume
            </label>
            <input
              id="character"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Wednesday, ghost mask, vampire cape…"
              className="mt-2 w-full rounded-xl border border-line bg-bg px-3 py-3 text-base outline-none focus:border-primary"
            />
            <label className="mt-5 flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-bg px-3 py-4 text-center text-sm text-muted">
              {photoUrl ? (
                <img src={photoUrl} alt="" className="h-24 w-24 rounded-lg object-cover" />
              ) : (
                <Camera className="size-5 text-primary" aria-hidden />
              )}
              <span>{photoName ? photoName : "Or upload a photo of the character"}</span>
              <input
                type="file"
                accept="image/*,video/*"
                className="sr-only"
                onChange={(event) => onPhoto(event.target.files?.[0] ?? null)}
              />
            </label>

            <button
              type="submit"
              disabled={busy || (!query.trim() && !photoName)}
              className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-ink disabled:opacity-50"
            >
              <Upload className="size-4" aria-hidden />
              {phase === "running" ? "Scouting…" : "Run the scout"}
            </button>

            <div ref={listRef} className="mt-4 scroll-mt-20">
              {nearby.length > 0 ? (
                <>
                  <p className="text-sm font-medium">Clothes near you</p>
                  <ul className="mt-2 space-y-2">
                    {nearby.map((item) => (
                      <li key={item.id} className="rounded-xl border border-line bg-bg px-3 py-3">
                        <div className="flex items-start gap-3">
                          {item.image ? (
                            <a href={item.productUrl} target="_blank" rel="noreferrer" className="shrink-0">
                              <img src={item.image} alt="" className="size-16 rounded-lg object-cover" />
                            </a>
                          ) : null}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <p className="font-medium">{item.piece}</p>
                              <p className="shrink-0 text-sm font-medium text-primary">{item.miles.toFixed(1)} mi</p>
                            </div>
                            <a
                              className="mt-1 block text-sm underline"
                              href={item.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {item.shop}
                            </a>
                            <p className="text-sm text-muted">{item.url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]}</p>
                            <p className="text-sm text-muted">{item.address}. Stock is not confirmed.</p>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>

            <div className="mt-5 rounded-xl bg-bg p-3">
              <p className="text-xs font-medium tracking-wide text-muted">Agent log</p>
              <ul className="mt-2 space-y-1.5 text-sm">
                {log.length === 0 ? (
                  <li className="text-muted">Waiting for a costume. The company does not start itself.</li>
                ) : (
                  log.map((line) => (
                    <li key={line.id} className="border-l-2 border-primary pl-2">
                      {line.text}
                    </li>
                  ))
                )}
              </ul>
            </div>
          </form>

          <div>
            {phase === "idle" || phase === "running" ? (
              <div className="flex h-full min-h-80 flex-col justify-end rounded-2xl border border-line bg-surface p-5">
                <p className="font-display text-2xl">Nothing matched yet.</p>
                <p className="mt-2 max-w-md text-muted">
                  Try a character name or a photo. Results come from Exa and from costumes people list here. Nothing is filled in ahead of time.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-4 rounded-2xl border border-line bg-surface p-4">
                  {photoUrl ? (
                    <img src={photoUrl} alt="" className="size-24 shrink-0 rounded-xl object-cover" />
                  ) : null}
                  <div>
                    <p className="text-xs font-medium tracking-wide text-primary">Identified</p>
                    <h2 className="font-display text-2xl leading-tight">{costume?.title}</h2>
                    <p className="mt-1 text-sm text-muted">{costume?.blurb}</p>
                  </div>
                </div>

                {hits.length === 0 ? (
                  <p className="rounded-2xl border border-line bg-surface px-4 py-6 text-sm text-muted">
                    No listings came back. Add the Exa key for live store pages, or list a costume yourself.
                  </p>
                ) : (
                <ul className="space-y-3">
                  {hits.map((hit) => (
                    <li key={hit.id} className="rounded-2xl border border-line bg-surface p-4">
                      <div className="flex items-start gap-3">
                        {nearby.find((item) => item.id === hit.id)?.image ? (
                          <a href={nearby.find((item) => item.id === hit.id)!.productUrl} target="_blank" rel="noreferrer" className="shrink-0">
                            <img src={nearby.find((item) => item.id === hit.id)!.image} alt="" className="size-16 rounded-lg object-cover" />
                          </a>
                        ) : null}
                        <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="flex items-center gap-2 font-medium">
                            {hit.kind === "peer" ? (
                              <ShoppingBag className="size-4 text-primary" aria-hidden />
                            ) : (
                              <Store className="size-4 text-primary" aria-hidden />
                            )}
                            {hit.name}
                          </p>
                          <p className="mt-1 flex items-center gap-1 text-sm text-muted">
                            <MapPin className="size-3.5" aria-hidden />
                            {hit.miles > 0 ? (
                              `${hit.area} · ${hit.miles.toFixed(1)} mi · ${hit.address}`
                            ) : hit.address.startsWith("http") ? (
                              <a href={hit.address} target="_blank" rel="noreferrer" className="underline">
                                {hit.area}
                              </a>
                            ) : (
                              `${hit.area} · ${hit.address}`
                            )}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-display text-xl">
                            {hit.price > 0 ? `$${hit.price.toFixed(0)}` : hit.miles > 0 ? `${hit.miles.toFixed(1)} mi` : "Web"}
                          </p>
                          <p className={`text-sm font-medium ${stockClass(hit.stock)}`}>
                            {verifiedId === hit.id ? "Verified · " : ""}
                            {stockLabel(hit.stock)}
                          </p>
                        </div>
                      </div>
                      <p className="mt-2 text-sm text-muted">
                        {hit.sizes} · {hit.note}
                      </p>
                      </div>
                      </div>
                    </li>
                  ))}
                </ul>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setCheckout("scout")}
                    className="min-h-12 rounded-xl border border-line bg-surface-2 px-4 py-3 text-left"
                  >
                    <span className="block font-medium">Scout report · ${SCOUT_PRICE}</span>
                    <span className="text-sm text-muted">This list, via Whop. No human.</span>
                  </button>
                  <button
                    type="button"
                    disabled={busy || phase === "verified"}
                    onClick={() => {
                      setCheckout("verified");
                      if (phase !== "verified") void verify();
                    }}
                    className="min-h-12 rounded-xl bg-primary px-4 py-3 text-left text-primary-ink disabled:opacity-60"
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <ShieldCheck className="size-4" aria-hidden />
                      Verified scout · ${VERIFIED_PRICE}
                    </span>
                    <span className="text-sm">
                      {phase === "verified" ? "Terac already checked." : "A person confirms the rack."}
                    </span>
                  </button>
                </div>

                {teracNote ? (
                  <p className="rounded-xl border border-line bg-bg px-3 py-3 text-sm">{teracNote}</p>
                ) : null}

                <p className="text-xs text-muted">
                  {liveSearch ? "Live Exa results." : "Exa did not run. No stand-in stores."} Query: {exaQuery}
                </p>

                {pieces.length > 0 ? (
                  <div>
                    <p className="text-sm font-medium">The item</p>
                    <ul className="mt-3 grid grid-cols-2 gap-3">
                      {pieces.map((piece) => (
                        <li key={piece.name} className="rounded-2xl border border-line bg-surface p-3">
                          {piece.image ? (
                            <a href={piece.url || undefined} target="_blank" rel="noreferrer">
                              <img
                                src={piece.image}
                                alt=""
                                className="aspect-square w-full rounded-xl object-cover"
                              />
                            </a>
                          ) : (
                            <p className="text-sm text-muted">No product photo on the page that came back.</p>
                          )}
                          <p className="mt-2 text-sm font-medium">{piece.name}</p>
                          <ul className="mt-2 space-y-1.5">
                            {(pieceHits[piece.name] ?? []).length === 0 ? (
                              <li className="text-sm text-muted">
                                {liveSearch ? `Nothing listed near ${place ?? "you"}.` : "Nearby search needs the Exa key."}
                              </li>
                            ) : (
                              (pieceHits[piece.name] ?? []).map((hit) => (
                                <li key={hit.id} className="text-sm">
                                  <a href={hit.address} target="_blank" rel="noreferrer" className="underline">
                                    {hit.name}
                                  </a>
                                  <span className="text-muted"> · {hit.area}</span>
                                </li>
                              ))
                            )}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </section>

        <section className="mt-12 grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div>
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-3xl">Sell one tonight</h2>
                <p className="mt-1 text-muted">
                  List free. The agent takes {Math.round(LISTING_CUT * 100)}% only if it sells.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setListOpen((open) => !open)}
                className="min-h-11 rounded-xl bg-fg px-4 py-2 text-sm font-semibold text-bg"
              >
                {listOpen ? "Close" : "List a costume"}
              </button>
            </div>
            {listOpen ? (
              <form
                className="mt-4 grid gap-3 rounded-2xl border border-line bg-surface p-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  publishListing();
                }}
              >
                <input
                  required
                  value={seller.title}
                  onChange={(event) => setSeller({ ...seller, title: event.target.value })}
                  placeholder="What are you selling?"
                  className="rounded-xl border border-line bg-bg px-3 py-3 outline-none focus:border-primary"
                />
                <div className="grid grid-cols-3 gap-2">
                  <input
                    value={seller.area}
                    onChange={(event) => setSeller({ ...seller, area: event.target.value })}
                    placeholder="Neighborhood"
                    className="rounded-xl border border-line bg-bg px-3 py-3 outline-none focus:border-primary"
                  />
                  <input
                    value={seller.price}
                    onChange={(event) => setSeller({ ...seller, price: event.target.value })}
                    inputMode="decimal"
                    placeholder="Price"
                    className="rounded-xl border border-line bg-bg px-3 py-3 outline-none focus:border-primary"
                  />
                  <input
                    value={seller.sizes}
                    onChange={(event) => setSeller({ ...seller, sizes: event.target.value })}
                    placeholder="Size"
                    className="rounded-xl border border-line bg-bg px-3 py-3 outline-none focus:border-primary"
                  />
                </div>
                <button type="submit" className="min-h-11 rounded-xl bg-primary font-semibold text-primary-ink">
                  Publish listing
                </button>
              </form>
            ) : null}
          </div>
          <ul className="space-y-2">
            {listings.slice(0, 4).map((hit) => (
              <li key={hit.id} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-3">
                <div>
                  <p className="font-medium">{hit.name}</p>
                  <p className="text-sm text-muted">
                    {hit.area} · {hit.sizes}
                  </p>
                </div>
                <p className="font-display text-xl">${hit.price.toFixed(0)}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12 grid gap-3 sm:grid-cols-3">
          {[
            ["Exa", "Finds stores and pages. The agent writes the query."],
            ["Whop", "Scout reports and the cut on a sale."],
            ["Terac", "A person calls the store. Only on the paid verify."],
          ].map(([title, body]) => (
            <div key={title} className="rounded-2xl border border-line bg-surface p-4">
              <p className="font-display text-xl">{title}</p>
              <p className="mt-1 text-sm text-muted">{body}</p>
            </div>
          ))}
        </section>
      </main>

      {checkout ? (
        <div className="fixed inset-0 z-30 grid place-items-end bg-bg/70 p-4 sm:place-items-center">
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-5">
            <p className="text-sm text-muted">Whop checkout</p>
            <h3 className="font-display text-2xl">
              {checkout === "scout" ? "Scout report" : "Verified scout"} · $
              {checkout === "scout" ? SCOUT_PRICE : VERIFIED_PRICE}
            </h3>
            <p className="mt-2 text-sm text-muted">
              {checkout === "verified"
                ? "After payment, the agent sends Terac to confirm stock at the closest store that still shows inventory."
                : "Opens your Whop product. Paste the real checkout link once the product is live."}
            </p>
            <label className="mt-4 block text-sm" htmlFor="whop">
              Checkout link
            </label>
            <input
              id="whop"
              value={whopUrl}
              onChange={(event) => {
                setWhopUrl(event.target.value);
                saveWhopUrl(event.target.value);
              }}
              className="mt-1 w-full rounded-xl border border-line bg-bg px-3 py-3 text-sm outline-none focus:border-primary"
            />
            <div className="mt-4 flex gap-2">
              <a
                href={whopUrl}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-primary font-semibold text-primary-ink"
                onClick={() => {
                  if (checkout === "verified" && phase !== "verifying" && phase !== "verified") {
                    void verify();
                  }
                }}
              >
                Open Whop
              </a>
              <button
                type="button"
                className="min-h-11 rounded-xl border border-line px-4"
                onClick={() => setCheckout(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
