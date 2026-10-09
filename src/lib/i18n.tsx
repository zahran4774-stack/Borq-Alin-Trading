"use client";
import { I } from "@/components/Icon";
import { createContext, useContext, useEffect, useState } from "react";
import { translate } from "./i18n-core";

export type Lang = "ar" | "en";
type Ctx = { lang: Lang; setLang: (l: Lang) => void; toggle: () => void };
const LangCtx = createContext<Ctx>({ lang: "ar", setLang: () => {}, toggle: () => {} });
export const useLang = () => useContext(LangCtx);

const ATTRS = ["placeholder", "title", "aria-label"];
const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "NOSCRIPT"]);

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ar");

  useEffect(() => {
    try { const s = localStorage.getItem("lang"); if (s === "en") setLangState("en"); } catch {}
  }, []);
  const setLang = (l: Lang) => { setLangState(l); try { localStorage.setItem("lang", l); } catch {} };

  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang; root.dir = lang === "en" ? "ltr" : "rtl"; root.dataset.lang = lang;
    if (lang !== "en") { root.dataset.ready = "1"; return; }

    // ---- وضع الإنجليزية: ترجمة DOM مع تتبّع الأصل للرجوع للعربية ----
    const origText = new WeakMap<Node, string>();
    const doneText = new WeakMap<Node, string>();
    const tracked = new Set<Text>();
    const origAttr = new WeakMap<Element, Record<string, string>>();
    const doneAttr = new WeakMap<Element, Record<string, string>>();
    const trackedEl = new Set<Element>();

    const procText = (n: Text) => {
      const cur = n.nodeValue || "";
      if (doneText.get(n) === cur) return;
      const t = translate(cur);
      origText.set(n, cur);
      if (t !== cur) { n.nodeValue = t; doneText.set(n, t); tracked.add(n); } else doneText.delete(n);
    };
    const procAttrs = (el: Element) => {
      for (const a of ATTRS) {
        const cur = el.getAttribute(a);
        if (cur == null) continue;
        const d = doneAttr.get(el)?.[a];
        if (d === cur) continue;
        const t = translate(cur);
        if (t !== cur) {
          origAttr.set(el, { ...(origAttr.get(el) || {}), [a]: cur });
          doneAttr.set(el, { ...(doneAttr.get(el) || {}), [a]: t });
          el.setAttribute(a, t); trackedEl.add(el);
        }
      }
    };
    const walk = (node: Node) => {
      if (node.nodeType === 3) { procText(node as Text); return; }
      if (node.nodeType !== 1) return;
      const el = node as Element;
      if (SKIP.has(el.tagName)) return;
      procAttrs(el);
      for (let c = el.firstChild; c; c = c.nextSibling) walk(c);
    };

    const origTitle = document.title;
    document.title = translate(document.title);
    walk(document.body);
    root.dataset.ready = "1";

    const mo = new MutationObserver((recs) => {
      for (const r of recs) {
        if (r.type === "characterData") { const t = r.target; if (t.nodeType === 3 && !SKIP.has((t.parentElement?.tagName) || "")) procText(t as Text); }
        else if (r.type === "attributes") procAttrs(r.target as Element);
        else r.addedNodes.forEach((n) => walk(n));
      }
      if (tracked.size > 5000) tracked.forEach((n) => { if (!n.isConnected) tracked.delete(n); });
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });

    const w = window as any;
    const { alert: a0, confirm: c0, prompt: p0 } = w;
    w.alert = (m?: any) => a0.call(window, translate(String(m ?? "")));
    w.confirm = (m?: any) => c0.call(window, translate(String(m ?? "")));
    w.prompt = (m?: any, d?: any) => p0.call(window, translate(String(m ?? "")), d);

    return () => {
      mo.disconnect();
      w.alert = a0; w.confirm = c0; w.prompt = p0; document.title = origTitle;
      tracked.forEach((n) => { if (doneText.get(n) === n.nodeValue && origText.has(n)) n.nodeValue = origText.get(n)!; });
      trackedEl.forEach((el) => {
        const o = origAttr.get(el), d = doneAttr.get(el);
        if (o && d) for (const a of Object.keys(o)) if (el.getAttribute(a) === d[a]) el.setAttribute(a, o[a]);
      });
    };
  }, [lang]);

  return <LangCtx.Provider value={{ lang, setLang, toggle: () => setLang(lang === "en" ? "ar" : "en") }}>{children}</LangCtx.Provider>;
}

export function LangToggle({ className = "" }: { className?: string }) {
  const { lang, toggle } = useLang();
  return (
    <button type="button" onClick={toggle} title={lang === "en" ? "العربية" : "English"}
      className={`no-print rounded-xl border border-brand-200 bg-white px-3 py-1.5 text-xs font-bold text-brand-900 hover:bg-gold-50 ${className}`}>
      <I n="globe" size={16} /> {lang === "en" ? "العربية" : "English"}
    </button>
  );
}
