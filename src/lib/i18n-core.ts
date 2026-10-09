import { PAIRS } from "./i18n-dict";

const AR = /[؀-ۿ]/;
const norm = (s: string) => s.replace(/\s+/g, " ").trim();
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const MAP = new Map<string, string>();
PAIRS.forEach(([a, b]) => MAP.set(norm(a), b));

// عبارات طويلة (أو فيها مسافة) تُترجم حتى لو كانت داخل جملة أطول؛ الكلمات القصيرة تُترجم فقط إذا كانت وحدها.
const LONG = [...MAP.keys()].filter((k) => k.includes(" ") || k.length >= 8).sort((a, b) => b.length - a.length);
const RE_LONG = new RegExp("(^|[^\\u0600-\\u06FF])(" + LONG.map(esc).join("|") + ")(?![\\u0600-\\u06FF])", "g");
const RE_RUN = /[؀-ۿً-ْ]+(?:[  ][؀-ۿً-ْ]+)*/g;
const PATTERNS: [RegExp, string][] = [[/(\d+) فاتورة/g, "$1 invoice(s)"], [/ر\.ع/g, "OMR"]];

export function translate(s: string): string {
  if (!s || !AR.test(s)) return s;
  let out = s;
  for (const [re, rep] of PATTERNS) out = out.replace(re, rep);
  if (AR.test(out)) out = out.replace(RE_LONG, (_m, p: string, k: string) => p + (MAP.get(k) ?? k));
  if (AR.test(out)) out = out.replace(RE_RUN, (r) => MAP.get(norm(r)) ?? r);
  return out.replace(/،/g, ",");
}
