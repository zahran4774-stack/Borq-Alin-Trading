"use client";
import { I } from "@/components/Icon";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/lib/app-context";
import { ACCOUNT_TYPES, downloadCSV, errMsg, money, monthStart, today, fdate } from "@/lib/format";
import { Empty, Msg, PageHeader } from "@/components/ui";

const TABS = [
  ["tb", "ميزان المراجعة"], ["pl", "قائمة الدخل"], ["bs", "المركز المالي"], ["branch", "مقارنة الفروع"],
  ["cat", "المبيعات حسب التصنيف"], ["vat", "ضريبة القيمة المضافة"], ["ar", "أعمار الذمم"], ["inv", "تقييم المخزون"],
] as const;

export default function Reports() {
  const { sb, branchId, branches, company } = useApp();
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("pl");
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [tb, setTb] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [err, setErr] = useState("");
  const b = branchId === "all" ? null : branchId;
  const bname = b ? branches.find((x) => x.id === b)?.name_ar : "كل الفروع";

  const load = useCallback(async () => {
    setErr(""); setRows([]);
    const run = async (fn: string, args: any) => { const r = await sb.rpc(fn, args); if (r.error) { setErr(errMsg(r.error)); return []; } return (r.data as any[]) || []; };
    if (tab === "tb") setTb(await run("report_trial_balance", { p_from: "1900-01-01", p_to: to, p_branch: b }));
    if (tab === "pl" || tab === "vat") setTb(await run("report_trial_balance", { p_from: from, p_to: to, p_branch: b }));
    if (tab === "bs") setTb(await run("report_trial_balance", { p_from: "1900-01-01", p_to: to, p_branch: b }));
    if (tab === "branch") setRows(await run("report_branch_summary", { p_from: from, p_to: to }));
    if (tab === "cat") setRows(await run("report_sales_by_category", { p_from: from, p_to: to, p_branch: b }));
    if (tab === "ar") {
      let q = sb.from("invoices").select("invoice_number,kind,invoice_date,due_date,total,amount_paid,contacts(name_ar),branch_id").in("status", ["confirmed", "partially_paid"]).limit(5000);
      if (b) q = q.eq("branch_id", b);
      setRows(((await q).data as any[]) || []);
    }
    if (tab === "inv") {
      let q = sb.from("branch_stock").select("branch_id,quantity,products(name_ar,cost_price,sale_price)").gt("quantity", 0).limit(20000);
      if (b) q = q.eq("branch_id", b);
      setRows(((await q).data as any[]) || []);
    }
  }, [sb, tab, from, to, b]);
  useEffect(() => { load(); }, [load]);

  const bal = (r: any) => Number(r.debit) - Number(r.credit);
  const csv = (name: string, data: (string | number)[][]) => downloadCSV(`${name}-${today()}.csv`, data);

  return (
    <div>
      <PageHeader title="التقارير">
        <button className="btn btn-sec" onClick={() => window.print()}><I n="printer" /> طباعة</button>
      </PageHeader>
      <div className="flex flex-wrap gap-2 mb-3 no-print">
        {TABS.map(([k, v]) => <button key={k} className={`btn ${tab === k ? "" : "btn-sec"}`} onClick={() => setTab(k)}>{v}</button>)}
      </div>
      <div className="card mb-3 flex flex-wrap gap-3 items-end no-print">
        {!["tb", "bs", "ar", "inv"].includes(tab) && <div><label className="label">من</label><input type="date" lang="en-GB" dir="ltr" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></div>}
        {!["ar", "inv"].includes(tab) && <div><label className="label">{["tb", "bs"].includes(tab) ? "حتى تاريخ" : "إلى"}</label><input type="date" lang="en-GB" dir="ltr" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></div>}
        <div className="text-sm text-slate-500">الفرع: <b>{bname}</b> (غيّره من أعلى الصفحة)</div>
      </div>
      <Msg error={err} />
      <div className="card print-area">
        <div className="text-center mb-3"><div className="font-bold text-lg">{company.name_ar}</div><div className="text-sm text-slate-500">{TABS.find((t) => t[0] === tab)?.[1]} — {bname}{!["ar", "inv"].includes(tab) ? ` — ${["tb", "bs"].includes(tab) ? "حتى " : `${fdate(from)} إلى `}${fdate(to)}` : ""}</div></div>

        {tab === "tb" && (<>
          <table className="tbl"><thead><tr><th>الرمز</th><th>الحساب</th><th>مدين</th><th>دائن</th></tr></thead>
            <tbody>{tb.filter((r) => Number(r.debit) || Number(r.credit)).map((r) => <tr key={r.account_id}><td className="num">{r.code}</td><td>{r.name_ar}</td><td className="num">{bal(r) > 0 ? money(bal(r)) : ""}</td><td className="num">{bal(r) < 0 ? money(-bal(r)) : ""}</td></tr>)}</tbody>
            <tfoot><tr className="font-bold bg-slate-50"><td colSpan={2}>الإجمالي</td><td className="num">{money(tb.reduce((s, r) => s + Math.max(0, bal(r)), 0))}</td><td className="num">{money(tb.reduce((s, r) => s + Math.max(0, -bal(r)), 0))}</td></tr></tfoot></table>
          <Exp onClick={() => csv("trial-balance", [["code", "account", "debit", "credit"], ...tb.map((r) => [r.code, r.name_ar, Math.max(0, bal(r)), Math.max(0, -bal(r))])])} />
        </>)}

        {tab === "pl" && (() => {
          const rev = tb.filter((r) => r.type === "revenue"); const exp = tb.filter((r) => r.type === "expense");
          const tr = rev.reduce((s, r) => s - bal(r), 0); const te = exp.reduce((s, r) => s + bal(r), 0);
          const cogs = exp.filter((r) => r.code === "5100").reduce((s, r) => s + bal(r), 0);
          return (<>
            <Section title="الإيرادات" rows={rev.map((r) => [r.name_ar, -bal(r)])} total={["إجمالي الإيرادات", tr]} />
            <Section title="المصروفات" rows={exp.map((r) => [r.name_ar, bal(r)])} total={["إجمالي المصروفات", te]} />
            <div className="flex justify-between text-sm mt-3"><span>مجمل الربح (الإيرادات − تكلفة المبيعات)</span><b className="num">{money(tr - cogs)}</b></div>
            <div className={`flex justify-between text-lg font-bold mt-1 border-t-2 pt-2 ${tr - te >= 0 ? "text-emerald-700" : "text-red-600"}`}><span>صافي {tr - te >= 0 ? "الربح" : "الخسارة"}</span><span className="num">{money(tr - te)}</span></div>
            <Exp onClick={() => csv("income-statement", [["account", "amount"], ...rev.map((r) => [r.name_ar, -bal(r)]), ...exp.map((r) => [r.name_ar, bal(r)]), ["net", tr - te]])} />
          </>);
        })()}

        {tab === "bs" && (() => {
          const a = tb.filter((r) => r.type === "asset"); const l = tb.filter((r) => r.type === "liability"); const e = tb.filter((r) => r.type === "equity");
          const ni = tb.filter((r) => r.type === "revenue").reduce((s, r) => s - bal(r), 0) - tb.filter((r) => r.type === "expense").reduce((s, r) => s + bal(r), 0);
          const ta = a.reduce((s, r) => s + bal(r), 0), tl = l.reduce((s, r) => s - bal(r), 0), te = e.reduce((s, r) => s - bal(r), 0) + ni;
          return (<>
            <Section title="الأصول" rows={a.filter((r) => bal(r)).map((r) => [r.name_ar, bal(r)])} total={["إجمالي الأصول", ta]} />
            <Section title="الخصوم" rows={l.filter((r) => bal(r)).map((r) => [r.name_ar, -bal(r)])} total={["إجمالي الخصوم", tl]} />
            <Section title="حقوق الملكية" rows={[...e.filter((r) => bal(r)).map((r) => [r.name_ar, -bal(r)] as [string, number]), ["صافي ربح/خسارة الفترة", ni] as [string, number]]} total={["إجمالي حقوق الملكية", te]} />
            <div className={`flex justify-between font-bold mt-3 ${Math.abs(ta - tl - te) < 0.001 ? "text-emerald-700" : "text-red-600"}`}><span>الأصول − (الخصوم + الملكية)</span><span className="num">{money(ta - tl - te)}</span></div>
            <Exp onClick={() => csv("balance-sheet", [["account", "amount"], ...a.map((r) => [r.name_ar, bal(r)]), ...l.map((r) => [r.name_ar, -bal(r)]), ...e.map((r) => [r.name_ar, -bal(r)]), ["net income", ni]])} />
          </>);
        })()}

        {tab === "branch" && (<>
          <table className="tbl"><thead><tr><th>الفرع</th><th>الفواتير</th><th>صافي المبيعات</th><th>الضريبة</th><th>تكلفة المبيعات</th><th>مجمل الربح</th><th>المصروفات</th><th>الصافي</th></tr></thead>
            <tbody>{rows.map((r) => <tr key={r.branch_id}><td>{r.branch_name}</td><td className="num">{r.invoices_count}</td><td className="num">{money(r.sales_net)}</td><td className="num">{money(r.vat)}</td><td className="num">{money(r.cogs)}</td><td className="num">{money(r.gross_profit)}</td><td className="num">{money(r.expenses_total)}</td><td className="num font-bold">{money(Number(r.gross_profit) - Number(r.expenses_total))}</td></tr>)}</tbody></table>
          {!rows.length && <Empty />}
          <Exp onClick={() => csv("branches", [["branch", "invoices", "sales_net", "vat", "cogs", "gross_profit", "expenses"], ...rows.map((r) => [r.branch_name, r.invoices_count, r.sales_net, r.vat, r.cogs, r.gross_profit, r.expenses_total])])} />
        </>)}

        {tab === "cat" && (<>
          <table className="tbl"><thead><tr><th>التصنيف</th><th>الكمية</th><th>صافي المبيعات</th><th>التكلفة</th><th>الربح</th><th>الهامش</th></tr></thead>
            <tbody>{rows.map((r, i) => { const p = Number(r.net_sales) - Number(r.cogs); return <tr key={i}><td>{r.category || "بدون تصنيف"}</td><td className="num">{Number(r.qty)}</td><td className="num">{money(r.net_sales)}</td><td className="num">{money(r.cogs)}</td><td className="num">{money(p)}</td><td className="num">{Number(r.net_sales) ? ((p / Number(r.net_sales)) * 100).toFixed(1) : 0}%</td></tr>; })}</tbody></table>
          {!rows.length && <Empty />}
          <Exp onClick={() => csv("sales-by-category", [["category", "qty", "net_sales", "cogs"], ...rows.map((r) => [r.category, r.qty, r.net_sales, r.cogs])])} />
        </>)}

        {tab === "vat" && (() => {
          const out = tb.filter((r) => r.code === "2120").reduce((s, r) => s - bal(r), 0);
          const inp = tb.filter((r) => r.code === "1150").reduce((s, r) => s + bal(r), 0);
          return (<div className="max-w-md mx-auto space-y-2 text-sm">
            <div className="flex justify-between"><span>ضريبة المخرجات (المبيعات)</span><b className="num">{money(out)}</b></div>
            <div className="flex justify-between"><span>ضريبة المدخلات (المشتريات والمصروفات)</span><b className="num">{money(inp)}</b></div>
            <div className="flex justify-between border-t-2 pt-2 text-lg font-bold"><span>{out - inp >= 0 ? "الضريبة المستحقة السداد" : "ضريبة قابلة للاسترداد"}</span><span className="num">{money(Math.abs(out - inp))}</span></div>
            <p className="text-xs text-slate-500 pt-2">للمراجعة الداخلية فقط — تحقق من متطلبات الإقرار الضريبي الرسمي لدى جهاز الضرائب.</p>
          </div>);
        })()}

        {tab === "ar" && (() => {
          const age = (r: any) => Math.floor((Date.now() - +new Date(r.due_date || r.invoice_date)) / 86400000);
          const bucket = (d: number) => (d <= 0 ? 0 : d <= 30 ? 1 : d <= 60 ? 2 : 3);
          const build = (kind: string) => {
            const m: Record<string, number[]> = {};
            rows.filter((r) => r.kind === kind).forEach((r) => { const n = r.contacts?.name_ar || "—"; (m[n] ||= [0, 0, 0, 0])[bucket(age(r))] += Number(r.total) - Number(r.amount_paid); });
            return Object.entries(m);
          };
          const T = ({ title, data }: { title: string; data: [string, number[]][] }) => (
            <div className="mb-6"><h3 className="font-semibold mb-1">{title}</h3>
              <table className="tbl"><thead><tr><th>الجهة</th><th>غير مستحق</th><th>1–30 يوم</th><th>31–60</th><th>+60</th><th>الإجمالي</th></tr></thead>
                <tbody>{data.map(([n, v]) => <tr key={n}><td>{n}</td>{v.map((x, i) => <td key={i} className="num">{x ? money(x) : ""}</td>)}<td className="num font-bold">{money(v.reduce((a, b) => a + b, 0))}</td></tr>)}</tbody></table>
              {!data.length && <Empty text="لا ذمم مفتوحة" />}</div>);
          return (<><T title="ذمم العملاء" data={build("sales")} /><T title="ذمم الموردين" data={build("purchase")} /></>);
        })()}

        {tab === "inv" && (() => {
          const m: Record<string, { n: string; q: number; c: number; s: number }> = {};
          rows.forEach((r) => { const p = r.products; if (!p) return; const x = (m[p.name_ar] ||= { n: p.name_ar, q: 0, c: Number(p.cost_price), s: Number(p.sale_price) }); x.q += Number(r.quantity); });
          const list = Object.values(m).sort((a, b) => b.q * b.c - a.q * a.c);
          return (<>
            <table className="tbl"><thead><tr><th>المنتج</th><th>الكمية</th><th>متوسط التكلفة</th><th>قيمة المخزون</th><th>القيمة بسعر البيع</th></tr></thead>
              <tbody>{list.map((x) => <tr key={x.n}><td>{x.n}</td><td className="num">{x.q}</td><td className="num">{money(x.c)}</td><td className="num">{money(x.q * x.c)}</td><td className="num">{money(x.q * x.s)}</td></tr>)}</tbody>
              <tfoot><tr className="font-bold bg-slate-50"><td colSpan={3}>الإجمالي</td><td className="num">{money(list.reduce((s, x) => s + x.q * x.c, 0))}</td><td className="num">{money(list.reduce((s, x) => s + x.q * x.s, 0))}</td></tr></tfoot></table>
            {!list.length && <Empty />}
            <Exp onClick={() => csv("inventory", [["product", "qty", "cost", "value"], ...list.map((x) => [x.n, x.q, x.c, x.q * x.c])])} />
          </>);
        })()}
      </div>
    </div>
  );
}

function Section({ title, rows, total }: { title: string; rows: [string, number][]; total: [string, number] }) {
  return (
    <div className="mb-4">
      <h3 className="font-semibold bg-slate-100 px-3 py-1 rounded">{title}</h3>
      <table className="tbl"><tbody>{rows.map(([n, v], i) => <tr key={i}><td>{n}</td><td className="num w-40">{money(v)}</td></tr>)}</tbody>
        <tfoot><tr className="font-bold"><td>{total[0]}</td><td className="num">{money(total[1])}</td></tr></tfoot></table>
    </div>
  );
}
const Exp = ({ onClick }: { onClick: () => void }) => <div className="mt-3 no-print"><button className="btn btn-sec btn-sm" onClick={onClick}><I n="upload" /> تصدير CSV</button></div>;
