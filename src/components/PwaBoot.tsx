"use client";
import { useEffect, useState } from "react";

/** تسجيل service worker + شريط انقطاع الاتصال + اقتراح تثبيت البرنامج. */
export default function PwaBoot() {
  const [online, setOnline] = useState(true);
  const [prompt, setPrompt] = useState<any>(null);
  const [hide, setHide] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    setOnline(navigator.onLine);
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    const bip = (e: any) => { e.preventDefault(); setPrompt(e); };
    window.addEventListener("beforeinstallprompt", bip);
    try { if (localStorage.getItem("pwa-hide") === "1") setHide(true); } catch {}
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); window.removeEventListener("beforeinstallprompt", bip); };
  }, []);

  async function install() {
    if (!prompt) return;
    prompt.prompt();
    await prompt.userChoice.catch(() => {});
    setPrompt(null);
  }
  function dismiss() { setHide(true); try { localStorage.setItem("pwa-hide", "1"); } catch {} }

  return (
    <>
      {!online && (
        <div className="fixed top-0 inset-x-0 z-[80] bg-amber-500 text-white text-center text-sm font-semibold px-3 py-2 no-print" role="status">
          لا يوجد اتصال بالإنترنت — يمكنك تصفّح الصفحات المحمّلة سابقاً، لكن لا يمكن حفظ فواتير أو سندات حتى يعود الاتصال
        </div>
      )}
      {prompt && !hide && (
        <div className="fixed bottom-3 inset-x-3 z-[60] mx-auto max-w-md bg-brand-900 text-white rounded-2xl shadow-xl px-4 py-3 flex items-center gap-3 no-print">
          <span className="flex-1 text-sm">ثبّت البرنامج على جهازك لفتحه كتطبيق</span>
          <button className="bg-gold-500 text-brand-900 font-bold rounded-xl px-3 py-1.5 text-sm" onClick={install}>تثبيت</button>
          <button className="text-white/60 text-lg leading-none" onClick={dismiss} aria-label="إغلاق">×</button>
        </div>
      )}
    </>
  );
}
