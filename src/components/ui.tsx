"use client";
import { useEffect, useState } from "react";
import { I } from "@/components/Icon";
import { useApp } from "@/lib/app-context";

const TITLE_ICONS: [string, string][] = [
  ["نقطة البيع", "receipt"], ["فواتير البيع", "file"], ["فواتير الشراء", "cart"], ["فاتورة شراء", "cart"], ["فاتورة بيع", "receipt"], ["فاتورة", "receipt"],
  ["استلام جهاز", "inbox"], ["أمر صيانة", "wrench"], ["أوامر الصيانة", "wrench"], ["المنتجات", "box"], ["المخزون", "store"],
  ["كشف حساب", "bookOpen"], ["العملاء", "users"], ["السندات", "wallet"], ["المصروفات", "trendDown"], ["التقارير", "trendUp"], ["القيود", "book"],
  ["المتأخرون", "clock"], ["الإعدادات", "sliders"], ["لوحة التحكم", "dashboard"],
];
export function PageHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  const icon = TITLE_ICONS.find(([k]) => title.includes(k))?.[1] || "sparkle";
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 mb-5 no-print">
      <h1 className="text-xl font-extrabold text-brand-900 flex items-center gap-2">
        <span className="w-9 h-9 rounded-xl bg-gold-100 text-brand-900 flex items-center justify-center"><I n={icon} size={20} /></span>{title}
      </h1>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export function Msg({ error, ok }: { error?: string; ok?: string }) {
  if (!error && !ok) return null;
  return (
    <div className={`rounded-xl px-3 py-2 text-sm mb-3 no-print ${error ? "bg-red-50 text-red-700 border border-red-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}>
      <span className="inline-flex items-start gap-1.5"><I n={error ? "alert" : "checkCircle"} className="mt-0.5" />{error || ok}</span>
    </div>
  );
}

export function NeedBranch() {
  const { branches, setBranchId, canSelectBranch } = useApp();
  return (
    <div className="card text-center space-y-3">
      <p className="text-slate-600"><I n="store" /> هذه العملية تحتاج تحديد فرع. اختر الفرع:</p>
      {canSelectBranch ? (
        <div className="flex justify-center gap-2">
          {branches.filter((b) => b.is_active).map((b) => (
            <button key={b.id} className="btn" onClick={() => setBranchId(b.id)}>{b.name_ar}</button>
          ))}
        </div>
      ) : <p className="text-red-600">حسابك غير مرتبط بفرع.</p>}
    </div>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-auto no-print" onClick={onClose}>
      <div className={`bg-white rounded-2xl shadow-xl w-full ${wide ? "max-w-3xl" : "max-w-lg"} mt-10`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b bg-gold-50 rounded-t-2xl px-4 py-3">
          <h3 className="font-extrabold text-brand-900">{title}</h3>
          <button className="text-slate-400 hover:text-slate-700 text-xl leading-none" onClick={onClose}>×</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

export function StatCard({ label, value, sub, tone, icon }: { label: string; value: string; sub?: string; tone?: "ok" | "bad"; icon?: string }) {
  const bg = tone === "bad" ? "bg-red-50" : tone === "ok" ? "bg-emerald-50" : "bg-gold-50";
  return (
    <div className="card flex items-start gap-3">
      <div className={`w-11 h-11 shrink-0 rounded-xl ${bg} flex items-center justify-center text-xl`}><I n={icon || "sparkle"} size={22} className={tone === "bad" ? "text-red-600" : tone === "ok" ? "text-emerald-600" : "text-gold-700"} /></div>
      <div className="min-w-0">
        <div className="text-xs text-slate-500 font-semibold">{label}</div>
        <div className={`text-xl font-extrabold num mt-0.5 ${tone === "bad" ? "text-red-600" : tone === "ok" ? "text-emerald-600" : "text-brand-900"}`}>{value}</div>
        {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

export function Empty({ text = "لا توجد بيانات" }: { text?: string }) {
  return <div className="text-center text-slate-400 py-10 text-sm"><div className="text-3xl mb-1"><I n="inbox" size={34} className="mx-auto text-gold-500" /></div>{text}</div>;
}

export const PAGE_SIZES = [25, 50, 100, 200];

export function Pager({ page, size, total, setPage, setSize }: { page: number; size: number; total: number; setPage: (n: number) => void; setSize: (n: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (total <= PAGE_SIZES[0] && size === PAGE_SIZES[0]) return null;
  const a = total ? (page - 1) * size + 1 : 0;
  const b = Math.min(total, page * size);
  return (
    <div className="flex items-center justify-between flex-wrap gap-2 pt-3 text-sm no-print">
      <div className="text-slate-500"><span className="num">{a}-{b}</span> <span>من</span> <span className="num">{total}</span></div>
      <div className="flex items-center gap-2">
        <select className="input !w-24 !py-1" value={size} onChange={(e) => { setSize(Number(e.target.value)); setPage(1); }}>{PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}</select>
        <button type="button" className="btn btn-sec !py-1 !px-3" disabled={page <= 1} onClick={() => setPage(1)}>«</button>
        <button type="button" className="btn btn-sec !py-1 !px-3" disabled={page <= 1} onClick={() => setPage(page - 1)}>السابق</button>
        <span><span>صفحة</span> <span className="num">{page}</span> <span>من</span> <span className="num">{pages}</span></span>
        <button type="button" className="btn btn-sec !py-1 !px-3" disabled={page >= pages} onClick={() => setPage(page + 1)}>التالي</button>
        <button type="button" className="btn btn-sec !py-1 !px-3" disabled={page >= pages} onClick={() => setPage(pages)}>»</button>
      </div>
    </div>
  );
}

/** ترقيم صفحات من جهة المتصفح لقائمة محمّلة. يعود للصفحة 1 عند تغيّر عدد النتائج (بحث/فلتر). */
export function usePaged<T>(all: T[], initial = 25) {
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(initial);
  const total = all.length;
  const pages = Math.max(1, Math.ceil(total / size));
  useEffect(() => { setPage(1); }, [total]);
  const cur = Math.min(page, pages);
  const rows = all.slice((cur - 1) * size, cur * size);
  const bar = <Pager page={cur} size={size} total={total} setPage={setPage} setSize={setSize} />;
  return { rows, bar };
}
