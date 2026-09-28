/**
 * Read a company's own website and suggest its brand: name, tagline, colours,
 * font and logo — so on a call the starter can take on the prospect's look in
 * one step. Everything here is a suggestion; nothing is applied until someone
 * picks it.
 *
 * Deliberately modest, and dependency-free: it reads the page's metadata and
 * stylesheets the way a person would look for them, and says what it couldn't
 * find rather than guessing. Pages that only render in the browser, or that
 * block automated requests, come back mostly empty — the manual fields are
 * still there.
 *
 * Server-side, development only (it's called from a setup action). It fetches
 * only public http(s) addresses, with timeouts and size limits.
 */

export type LogoCandidate = {
  /** Where it was found, in words: "Header logo", "App icon"… */
  label: string;
  /** The image itself, so the page can preview and upload it without refetching. */
  dataUrl: string;
  /** SVG logos are turned into PNG in the browser before upload — the app stores only raster logos. */
  svg: boolean;
};

export type SiteImport = {
  url: string;
  name?: string;
  tagline?: string;
  /** Most brand-like first. */
  colors: string[];
  font?: { family: string; css: string };
  /**
   * The page background. `usable` only when it's light: every page in the
   * starter is dark text on a light page, so a dark site's background is shown
   * but not offered.
   */
  background?: { color: string; usable: boolean };
  logos: LogoCandidate[];
  /** What it couldn't find, in plain words. */
  missing: string[];
};

const UA = "Mozilla/5.0 (compatible; LithosStarter/1.0; brand import)";
const PAGE_BYTES = 3_000_000;
const ASSET_BYTES = 800_000;

// ---------------------------------------------------------------- fetching

function isPublicHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
    const [a, b] = h.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return false;
  }
  if (h.includes(":")) return false; // IPv6 literals: not worth the risk here
  return true;
}

export function normalizeSiteUrl(input: string): URL | null {
  const trimmed = input.trim();
  // Any scheme but http(s) is refused, not "fixed" by prefixing https://.
  if (!trimmed || (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) && !/^https?:\/\//i.test(trimmed))) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    if ((url.protocol !== "https:" && url.protocol !== "http:") || !url.hostname.includes(".") || !isPublicHost(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

async function fetchCapped(url: URL, maxBytes: number, accept: string): Promise<{ body: Buffer; type: string; url: URL } | null> {
  if (!isPublicHost(url.hostname)) return null;
  try {
    const response = await fetch(url, { headers: { "user-agent": UA, accept }, redirect: "follow", signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (!response.ok || !response.body) return null;
    const finalUrl = new URL(response.url || url.href);
    if (!isPublicHost(finalUrl.hostname)) return null;
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    return { body: Buffer.concat(chunks), type: (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase(), url: finalUrl };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- reading HTML

type Tag = Record<string, string>;

function attrs(tag: string): Tag {
  const out: Tag = {};
  for (const m of tag.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
    out[m[1].toLowerCase()] = decode(m[3] ?? m[4] ?? m[5] ?? "");
  }
  return out;
}

function tags(html: string, name: string): Tag[] {
  return [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, "gi"))].map((m) => attrs(m[0]));
}

function decode(text: string): string {
  return text
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;|&rsquo;|&#8217;/g, "’").replace(/&lsquo;|&#8216;/g, "‘")
    .replace(/&ldquo;|&rdquo;|&#822[01];/g, '"').replace(/&ndash;|&#8211;/g, "–").replace(/&mdash;|&#8212;/g, "—")
    .replace(/&nbsp;|&#160;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ").trim();
}

function meta(html: string, ...keys: string[]): string | undefined {
  const all = tags(html, "meta");
  for (const key of keys) {
    const found = all.find((t) => (t.property ?? t.name ?? "").toLowerCase() === key && t.content);
    if (found) return found.content;
  }
  return undefined;
}

/**
 * The company name. Sites say it in several places — the declared site name,
 * the page and share titles ("Brand | what we do", "What we do | Brand") — and not all of
 * them are the name: some sites declare their headline instead. The candidate
 * that matches the web address wins; then the declared name; then the shortest
 * part of the title.
 */
function nameFrom(html: string, host: string): string | undefined {
  const declared = meta(html, "og:site_name", "application-name", "apple-mobile-web-app-title");
  const title = decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  // The share title often carries the brand when the page title doesn't.
  const titles = [title, meta(html, "og:title", "twitter:title") ?? ""];
  const generic = /^(home|homepage|welcome|official site)$/i;
  const parts = [declared, ...titles.flatMap((t) => t.split(/\s+[|–—·•-]\s+|:\s+/))]
    .map((p) => p?.trim() ?? "")
    .filter((p) => p && !generic.test(p));
  const letters = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, "");
  const domain = letters(host.replace(/^www\./, "").split(".").slice(0, -1).join(""));
  const matching = parts.find((p) => letters(p).length >= 3 && domain.includes(letters(p)));
  const shortest = [...parts].sort((a, b) => a.length - b.length)[0];
  return (matching ?? declared ?? shortest)?.slice(0, 60);
}

function taglineFrom(html: string): string | undefined {
  const text = meta(html, "og:description", "description", "twitter:description");
  if (!text) return undefined;
  // First sentence, if the description runs on — and never cut mid-word.
  const line = text.match(/^.{20,140}?[.!?](\s|$)/)?.[0]?.trim() ?? text;
  return line.length <= 120 ? line : `${line.slice(0, 118).replace(/\s+\S*$/, "")}…`;
}

// ---------------------------------------------------------------- colours

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
}

function parseColor(value: string): string | null {
  const v = value.trim().toLowerCase();
  let m = v.match(/^#([0-9a-f]{3})$/);
  if (m) return `#${m[1].split("").map((c) => c + c).join("")}`;
  m = v.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/);
  if (m) return m[2] && parseInt(m[2], 16) < 200 ? null : `#${m[1]}`;
  m = v.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+%?))?\s*\)$/);
  if (m) {
    const alpha = m[4] ? (m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4])) : 1;
    return alpha < 0.8 ? null : toHex(+m[1], +m[2], +m[3]);
  }
  return null;
}

function hsl(hex: string): { s: number; l: number } {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  const s = max === min ? 0 : l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
  return { s, l };
}

/** Greys, pale tints (the beige and cream of page backgrounds) and near-black are the page, not the brand. */
function brandLike(hex: string): boolean {
  const { s, l } = hsl(hex);
  return s >= 0.3 && l > 0.12 && l < 0.85;
}

function distance(a: string, b: string): number {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]);
}

/**
 * Colours ranked by how brand-like and how used they are: a declared theme
 * colour first, then colours from custom properties named like a brand colour
 * (primary, brand, accent), then the most-used saturated colours in the CSS.
 */
export function rankColors(declared: string[], css: string): string[] {
  const scores = new Map<string, number>();
  const add = (hex: string | null, weight: number) => {
    if (!hex || !brandLike(hex)) return;
    scores.set(hex, (scores.get(hex) ?? 0) + weight);
  };
  declared.forEach((c) => add(parseColor(c), 1000));
  for (const m of css.matchAll(/--([-\w]*(?:primary|brand|accent|main|theme)[-\w]*)\s*:\s*([^;}]+)/gi)) add(parseColor(m[2]), 25);
  for (const m of css.matchAll(/#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\([^)]*\)/g)) add(parseColor(m[0]), 1);
  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]).map(([hex]) => hex);
  const distinct: string[] = [];
  for (const hex of ranked) {
    if (distinct.every((d) => distance(d, hex) > 40)) distinct.push(hex);
    if (distinct.length === 3) break;
  }
  return distinct;
}

// ---------------------------------------------------------------- page background

/** WCAG relative luminance of a #rrggbb colour. */
export function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The site's custom properties, first definition wins (later ones are usually dark-mode overrides). */
function customProperties(css: string): Map<string, string> {
  const vars = new Map<string, string>();
  for (const m of css.matchAll(/--([\w-]+)\s*:\s*([^;}]+)/g)) if (!vars.has(m[1])) vars.set(m[1], m[2].trim());
  return vars;
}

/** A CSS colour value, following var(--x) chains — design systems route the page colour through several. */
function resolveColor(value: string, vars: Map<string, string>, depth = 0): string | null {
  const v = value.trim();
  if (/^white$/i.test(v)) return "#ffffff";
  const ref = v.match(/^var\(\s*--([\w-]+)\s*(?:,\s*([^)]+))?\)$/);
  if (ref) {
    const next = vars.get(ref[1]) ?? ref[2];
    return next && depth < 8 ? resolveColor(next, vars, depth + 1) : null;
  }
  return parseColor(v);
}

function backgroundIn(declarations: string, vars: Map<string, string>): string | null {
  const m = declarations.match(/background(?:-color)?\s*:\s*([^;}]+)/i);
  return m ? resolveColor(m[1].replace(/!important/i, ""), vars) : null;
}

/** A class name as it appears in a CSS selector (Tailwind's bg-[#f7f3ee] becomes .bg-\[\#f7f3ee\]). */
function cssEscape(name: string): string {
  return name.replace(/([^a-zA-Z0-9_-])/g, "\\$1");
}

/**
 * The page background, the way a browser would settle it: a rule on the body
 * (or html, :root), then a class on the <body>, then a background custom
 * property, then the web app manifest's background colour.
 */
export function pageBackground(html: string, css: string, manifestBackground?: string): string | undefined {
  const vars = customProperties(css);
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selectors: m[1].split(",").map((s) => s.trim()), body: m[2] }));
  for (const rule of rules) {
    if (rule.selectors.some((s) => s === "body" || s === "html" || s === ":root" || s === "html body")) {
      const color = backgroundIn(rule.body, vars);
      if (color) return color;
    }
  }
  const bodyClasses = (attrs(html.match(/<body\b[^>]*>/i)?.[0] ?? "").class ?? "").split(/\s+/).filter(Boolean);
  for (const cls of bodyClasses) {
    const selector = `.${cssEscape(cls)}`;
    const rule = rules.find((r) => r.selectors.includes(selector));
    const color = rule && backgroundIn(rule.body, vars);
    if (color) return color;
    // Tailwind arbitrary values carry the colour in the class name itself.
    const inline = cls.match(/^bg-\[(#[0-9a-fA-F]{3,6})\]$/);
    if (inline) return parseColor(inline[1]) ?? undefined;
  }
  for (const name of ["background", "bg", "page-bg", "page-background", "surface", "base-100"]) {
    const value = vars.get(name);
    const color = value && resolveColor(value, vars);
    if (color) return color;
  }
  return manifestBackground ? parseColor(manifestBackground) ?? undefined : undefined;
}

// ---------------------------------------------------------------- font

const GENERIC_FONTS = /^(inherit|initial|unset|serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-sans-serif|ui-serif|ui-monospace|-apple-system|blinkmacsystemfont|arial|helvetica|helvetica neue|segoe ui|roboto fallback|times new roman|georgia|verdana|tahoma|apple color emoji|segoe ui emoji|segoe ui symbol|noto color emoji)$/i;

/** Font families the site asks for, most likely brand font first. */
export function fontCandidates(html: string, css: string): string[] {
  const found: string[] = [];
  const push = (name: string) => {
    const clean = name.replace(/["']/g, "").replace(/_/g, " ").replace(/ Fallback$/, "").trim();
    if (clean.length >= 2 && !GENERIC_FONTS.test(clean) && !found.includes(clean)) found.push(clean);
  };
  // A Google Fonts stylesheet link names its families outright.
  for (const link of tags(html, "link")) {
    const href = link.href ?? "";
    if (!/fonts\.googleapis\.com\/css/.test(href)) continue;
    for (const m of href.matchAll(/family=([^&:]+)/g)) push(decodeURIComponent(m[1].replace(/\+/g, " ")));
  }
  // next/font renames Google fonts to "__Inter_0ab1c2" — the real name is inside.
  for (const m of (html + css).matchAll(/__([A-Z][A-Za-z0-9]*(?:_[A-Z0-9][A-Za-z0-9]*)*?)_(?:Fallback_)?[0-9a-f]{5,}\b/g)) push(m[1]);
  // Otherwise, the families the CSS uses most.
  const counts = new Map<string, number>();
  for (const m of css.matchAll(/font-family\s*:\s*([^;}]+)/gi)) {
    const first = m[1].split(",")[0].replace(/["']/g, "").trim();
    if (first.startsWith("var(") || first.startsWith("__")) continue;
    counts.set(first, (counts.get(first) ?? 0) + 1);
  }
  [...counts.entries()].sort((a, b) => b[1] - a[1]).forEach(([name]) => push(name));
  return found.slice(0, 4);
}

/** A family is only offered if Google Fonts serves it — checked, not assumed. */
async function googleFont(family: string): Promise<{ family: string; css: string } | undefined> {
  const name = family.trim().replace(/\s+/g, "+");
  for (const css of [`${name}:wght@400;600;700`, name]) {
    try {
      const r = await fetch(`https://fonts.googleapis.com/css2?family=${css}&display=swap`, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(5000) });
      if (r.ok) return { family: family.trim(), css };
    } catch {
      /* try the next form */
    }
  }
  return undefined;
}

// ---------------------------------------------------------------- logos

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

function sniffType(body: Buffer, declared: string, src: string): string | null {
  if (IMAGE_TYPES.includes(declared)) return declared;
  const head = body.subarray(0, 256).toString("utf8");
  if (/<svg[\s>]/i.test(head) || /\.svg(\?|$)/i.test(src)) return "image/svg+xml";
  if (body[0] === 0x89 && body[1] === 0x50) return "image/png";
  if (body[0] === 0xff && body[1] === 0xd8) return "image/jpeg";
  if (head.startsWith("RIFF") && head.includes("WEBP")) return "image/webp";
  return null;
}

function logoSources(html: string, base: URL): Array<{ label: string; src: string }> {
  const out: Array<{ label: string; src: string }> = [];
  const add = (label: string, src: string | undefined) => {
    if (!src || src.startsWith("data:")) return;
    try {
      const url = new URL(src, base).href;
      if (!out.some((o) => o.src === url)) out.push({ label, src: url });
    } catch {
      /* not a URL */
    }
  };
  const header = html.match(/<header\b[\s\S]*?<\/header>/i)?.[0] ?? "";
  // Images that say they're the logo — in the header first.
  for (const scope of [header, html]) {
    for (const img of tags(scope, "img")) {
      const hint = `${img.alt ?? ""} ${img.class ?? ""} ${img.id ?? ""} ${img.src ?? ""}`;
      if (/logo/i.test(hint)) add(scope === header ? "Header logo" : "Logo on the page", img.src ?? img["data-src"]);
    }
  }
  // The site's icons: reliable, but square.
  const icons = tags(html, "link").filter((l) => /(^|\s)(apple-touch-icon|icon)(\s|$)/i.test(l.rel ?? ""));
  icons.sort((a, b) => parseInt(b.sizes ?? "0") - parseInt(a.sizes ?? "0"));
  icons.forEach((l) => add(/apple/i.test(l.rel ?? "") ? "App icon" : "Site icon", l.href));
  return out.slice(0, 5);
}

/** An inline <svg> logo in the header — common on modern sites, invisible to the image search above. */
function inlineSvgLogo(html: string): string | undefined {
  const header = html.match(/<header\b[\s\S]*?<\/header>/i)?.[0];
  if (!header) return undefined;
  const svg = header.match(/<svg\b[\s\S]*?<\/svg>/i)?.[0];
  if (!svg || svg.length > 150_000 || !/viewBox/i.test(svg)) return undefined;
  return /xmlns=/.test(svg) ? svg : svg.replace(/<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
}

// ---------------------------------------------------------------- the whole import

export async function importFromWebsite(input: string): Promise<SiteImport | { error: string }> {
  const url = normalizeSiteUrl(input);
  if (!url) return { error: "That isn't a public web address. Try something like acmehealth.com." };

  const page = await fetchCapped(url, PAGE_BYTES, "text/html,application/xhtml+xml");
  if (!page) return { error: `Couldn't read ${url.hostname}. The site may block automated requests, or be down — fill the fields in by hand.` };
  const html = page.body.toString("utf8");
  const base = page.url;

  // Stylesheets: inline, plus the first few linked ones.
  let css = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n");
  const sheets = tags(html, "link").filter((l) => /stylesheet/i.test(l.rel ?? "") && l.href && !/fonts\.googleapis/.test(l.href)).slice(0, 4);
  const sheetBodies = await Promise.all(sheets.map((l) => fetchCapped(new URL(l.href, base), 1_500_000, "text/css")));
  css += sheetBodies.filter(Boolean).map((s) => s!.body.toString("utf8")).join("\n");

  // Declared colours: the theme colour, and the web app manifest's.
  const declared = [meta(html, "theme-color", "msapplication-tilecolor")].filter(Boolean) as string[];
  let manifestBackground: string | undefined;
  const manifestHref = tags(html, "link").find((l) => /manifest/i.test(l.rel ?? ""))?.href;
  if (manifestHref) {
    const manifest = await fetchCapped(new URL(manifestHref, base), 200_000, "application/json");
    try {
      const json = manifest ? JSON.parse(manifest.body.toString("utf8")) : null;
      if (typeof json?.theme_color === "string") declared.push(json.theme_color);
      if (typeof json?.background_color === "string") manifestBackground = json.background_color;
    } catch {
      /* not JSON */
    }
  }

  const logos: LogoCandidate[] = [];
  const inline = inlineSvgLogo(html);
  if (inline) logos.push({ label: "Header logo", dataUrl: `data:image/svg+xml;base64,${Buffer.from(inline).toString("base64")}`, svg: true });
  for (const source of logoSources(html, base)) {
    if (logos.length >= 4) break;
    const asset = await fetchCapped(new URL(source.src), ASSET_BYTES, "image/*");
    if (!asset) continue;
    const type = sniffType(asset.body, asset.type, source.src);
    if (!type) continue;
    logos.push({ label: source.label, dataUrl: `data:${type};base64,${asset.body.toString("base64")}`, svg: type === "image/svg+xml" });
  }

  let font: SiteImport["font"];
  for (const family of fontCandidates(html, css)) {
    font = await googleFont(family);
    if (font) break;
  }

  const result: SiteImport = {
    url: base.href,
    name: nameFrom(html, base.hostname),
    tagline: taglineFrom(html),
    colors: rankColors(declared, css),
    font,
    logos,
    missing: [],
  };
  const background = pageBackground(html, css, manifestBackground);
  if (background) result.background = { color: background, usable: luminance(background) >= 0.75 };
  if (!result.name) result.missing.push("a company name");
  if (!result.tagline) result.missing.push("a tagline");
  if (result.colors.length === 0) result.missing.push("a brand colour");
  if (!result.font) result.missing.push("a Google Font (a custom font can't be copied)");
  if (result.logos.length === 0) result.missing.push("a logo");
  return result;
}
