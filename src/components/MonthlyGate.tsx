"use client";
import { I } from "@/components/Icon";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/lib/app-context";
import { useLang } from "@/lib/i18n";
import { errMsg, METHODS } from "@/lib/format";

type Pending = { branch_id: string; period: string; period_end: string };
type Row = { amount: string; method: string; payee: string };
const blank = (): Row => ({ amount: "", method: "cash", payee: "" });

// نافذة إجبارية: لا تُغلق إلا بإدخال مصروفات الشهر (إيجار + كهرباء + راتب واحد على الأقل، والإنترنت اختياري)
export default function MonthlyGate() {
  const { sb, can, branches, logout } = useApp();
  const { lang } = useLang();
  const [pending, setPending] = useState<Pending[]>([]);
  const [rent, setRent] = useState<Row>(blank());
  const [elec, setElec] = useState<Row>(blank());
  const [net, setNet] = useState<Row>(blank());
  const [sal, setSal] = useState<Row[]>([blank()]);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const eligible = can("admin", "accountant", "branch_manager");

  const check = useCallback(async () => {
    if (!eligible) return;
    const { data } = await sb.rpc("monthly_pending");
    setPending((data as any) || []);
  }, [sb, eligible]);
  useEffect(() => {
    check();
    const f = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", f);
    const t = setInterval(check, 30 * 60 * 1000);
    return () => { document.removeEventListener("visibilitychange", f); clearInterval(t); };
  }, [check]);

  const cur = pending[0];
  useEffect(() => { setRent(blank()); setElec(blank()); setNet(blank()); setSal([blank()]); setErr(""); }, [cur?.branch_id, cur?.period]);
  if (!eligible || !cur) return null;

  const branch = branches.find((b) => b.id === cur.branch_id)?.name_ar || "";
  const [y, mo] = cur.period.split("-").map(Number);
  const monthName = new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "ar-OM-u-nu-latn", { month: "long", year: "numeric" }).format(new Date(y, mo - 1, 1));
  const num = (s: string) => Number(s);
  const okAmt = (s: string) => Number.isFinite(num(s)) && num(s) > 0;
  const ready = okAmt(rent.amount) && okAmt(elec.amount) && sal.some((s) => okAmt(s.amount)) && sal.every((s) => !s.amount || okAmt(s.amount)) && (!net.amount || okAmt(net.amount));

  async function save() {
    setErr(""); setBusy(true);
    const items = [
      { kind: "rent", amount: num(rent.amount), method: rent.method, payee: rent.payee },
      { kind: "electricity", amount: num(elec.amount), method: elec.method, payee: elec.payee },
      ...(net.amount ? [{ kind: "internet", amount: num(net.amount), method: net.method, payee: net.payee }] : []),
      ...sal.filter((s) => s.amount).map((s) => ({ kind: "salary", amount: num(s.amount), method: s.method, payee: s.payee })),
    ];
    const { error } = await sb.rpc("submit_monthly_expenses", { p_branch: cur.branch_id, p_period: cur.period, p_items: items });
    setBusy(false);
    if (error) { setErr(errMsg(error)); return; }
    check();
  }

  const line = (label: string, v: Row, set: (r: Row) => void, opt?: boolean, namePh?: string) => (
    <div className="grid grid-cols-12 gap-2 items-end">
      <div className="col-span-12 sm:col-span-4"><label className="label">{label}{opt ? "" : " *"}</label>
        <input className="input num" type="number" min="0" step="0.001" inputMode="decimal" placeholder={opt ? "اختياري" : "0.000"} value={v.amount} onChange={(e) => set({ ...v, amount: e.target.value })} /></div>
      <div className="col-span-6 sm:col-span-4"><label className="label">طريقة الدفع</label>
        <select className="input" value={v.method} onChange={(e) => set({ ...v, method: e.target.value })}>{Object.entries(METHODS).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></div>
      <div className="col-span-6 sm:col-span-4"><label className="label">{namePh || "المستفيد"}</label>
        <input className="input" maxLength={120} value={v.payee} onChange={(e) => set({ ...v, payee: e.target.value })} /></div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[70] bg-brand-900/80 backdrop-blur-sm flex items-start justify-center p-3 overflow-auto no-print" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-6">
        <div className="bg-gradient-to-l from-brand-900 to-[#0f2a4d] text-white rounded-t-2xl px-5 py-4 flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl bg-gold-500 text-brand-900 flex items-center justify-center shrink-0"><I n="calendar" size={22} /></span>
          <div className="min-w-0 flex-1">
            <h3 className="font-extrabold text-lg">إقفال المصروفات الشهرية</h3>
            <div className="text-sm text-gold-400">{monthName} — {branch}</div>
          </div>
          {pending.length > 1 && <span className="badge badge-warn shrink-0">متبقي {pending.length}</span>}
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-600">هذه المصروفات إلزامية، ولا يمكن متابعة العمل قبل إدخالها. الحقول المعلّمة بـ * مطلوبة.</p>
          {err && <div className="rounded-xl px-3 py-2 text-sm bg-red-50 text-red-700 border border-red-200"><I n="alert" className="inline me-1" />{err}</div>}
          <section className="rounded-xl border border-gold-100 bg-gold-50/40 p-3 space-y-2"><div className="font-bold text-brand-900 flex items-center gap-1.5"><I n="store" />إيجار المحل</div>{line("المبلغ", rent, setRent, false, "المؤجّر")}</section>
          <section className="rounded-xl border border-gold-100 bg-gold-50/40 p-3 space-y-2"><div className="font-bold text-brand-900 flex items-center gap-1.5"><I n="sparkle" />فاتورة الكهرباء</div>{line("المبلغ", elec, setElec)}</section>
          <section className="rounded-xl border border-gold-100 p-3 space-y-2"><div className="font-bold text-brand-900 flex items-center gap-1.5"><I n="globe" />فاتورة الإنترنت <span className="text-xs font-normal text-slate-500">(اختياري)</span></div>{line("المبلغ", net, setNet, true)}</section>
          <section className="rounded-xl border border-gold-100 bg-gold-50/40 p-3 space-y-3">
            <div className="font-bold text-brand-900 flex items-center gap-1.5"><I n="users" />رواتب الموظفين</div>
            {sal.map((s, i) => (
              <div key={i} className="space-y-1">{line(`راتب موظف ${i + 1}`, s, (r) => setSal(sal.map((x, j) => (j === i ? r : x))), false, "اسم الموظف")}
                {sal.length > 1 && <button className="text-xs text-red-600 underline" onClick={() => setSal(sal.filter((_, j) => j !== i))}>حذف</button>}</div>
            ))}
            <button className="btn btn-sec btn-sm" onClick={() => setSal([...sal, blank()])}><I n="plus" size={14} /> موظف آخر</button>
          </section>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button className="btn flex-1" disabled={!ready || busy} onClick={save}><I n="save" /> {busy ? "جاري الحفظ…" : "حفظ وإقفال الشهر"}</button>
            <button className="btn btn-sec" onClick={logout}><I n="logout" /> تسجيل الخروج</button>
          </div>
        </div>
      </div>
    </div>
  );
}
