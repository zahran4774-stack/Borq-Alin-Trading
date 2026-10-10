/* Service worker — بروق العين. يخزّن هيكل التطبيق فقط؛ لا يخزّن بيانات Supabase ولا /api. */
const VERSION = "v1";
const STATIC = "buroq-static-" + VERSION;
const PAGES = "buroq-pages-" + VERSION;
const PRECACHE = ["/offline.html", "/icon-192.png", "/icon-512.png", "/manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(STATIC).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => ![STATIC, PAGES].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;           // Supabase والخطوط: دون تدخل
  if (url.pathname.startsWith("/api/")) return;              // لا نخزّن واجهات الخادم
  if (url.pathname.startsWith("/print/")) return;            // الفواتير المطبوعة تُجلب حيّة دائماً

  // ملفات البناء (اسمها يتغير مع كل نسخة): من الذاكرة أولاً
  if (url.pathname.startsWith("/_next/static/") || /\.(?:png|svg|ico|webmanifest|woff2?)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(STATIC).then((c) => c.put(req, copy)); }
        return res;
      }))
    );
    return;
  }

  // الصفحات: من الشبكة أولاً (لأخذ آخر نسخة)، وعند انقطاع الاتصال من الذاكرة ثم صفحة "لا يوجد اتصال"
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then((res) => {
        // لا نخزّن إعادة التوجيه ولا الأخطاء
        if (res.ok && !res.redirected) { const copy = res.clone(); caches.open(PAGES).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => caches.match(req).then((hit) => hit || caches.match("/offline.html")))
    );
  }
});
