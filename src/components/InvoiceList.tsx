"use client";
import { I } from "@/components/Icon";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/lib/app-context";
import { fdate, INV_STATUS, money, monthStart, today } from "@/lib/format";
import { Empty, Pager, PageHeader } from "@/components/ui";

export default function InvoiceList({ kind }: { kind: "sales" | "purchase" }) {
  const { sb, branchId, can } = useApp();
  const [rows, setRows] = useState<any[]>([]);
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [dq, setDq] = useState("");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(50);
  const [count, setCount] = useState(0);
  const [sums, setSums] = useState({ total: 0, due: 0 });
  const [loading, setLoading] = useState(true);

  // تأخير بسيط للبحث حتى لا يُرسل طلب مع كل حرف
  useEffect(() => { const t = setTimeout(() => setDq(search.trim()), 350); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setPage(1); }, [kind, from, to, status, branchId, dq, size]);

  const load = useCallback(async () => {
    setLoading(true);
    // شرط البحث: رقم الفاتورة / رقم فاتورة المورد / اسم الجهة
    let orExpr = "";
    if (dq) {
      const t = dq.replace(/[,()%*\\]/g, " ").trim();
      if (t) {
        const { data: cs } = await sb.from("contacts").select("id").ilike("name_ar", `%${t}%`).limit(200);
        const ids = ((cs as any[]) || []).map((c) => c.id);
        orExpr = `invoice_number.ilike.%${t}%,supplier_invoice_no.ilike.%${t}%` + (ids.length ? `,contact_id.in.(${ids.join(",")})` : "");
      }
    }
    const base = (cols: string, opts?: any) => {
      let q: any = sb.from("invoices").select(cols, opts).eq("kind", kind).gte("invoice_date", from).lte("invoice_date", to);
      if (branchId !== "all") q = q.eq("branch_id", branchId);
      if (status) q = q.eq("status", status);
      if (orExpr) q = q.or(orExpr);
      return q;
    };
    const fromI = (page - 1) * size;
    const { data, count: c } = await base("*, contacts(name_ar), branches(name_ar)", { count: "exact" })
      .order("created_at", { ascending: false }).range(fromI, fromI + size - 1);
    setRows((data as any) || []);
    setCount(c || 0);
    // إجماليات كل النتائج (وليس الصفحة الحالية فقط)
    let t = 0, d = 0;
    for (let off = 0; off < 50000; off += 1000) {
      const { data: part } = await base("total,amount_paid,status").neq("status", "cancelled").order("id").range(off, off + 999);
      const arr = (part as any[]) || [];
      arr.forEach((r) => { t += Number(r.total); d += Number(r.total) - Number(r.amount_paid); });
      if (arr.length < 1000) break;
    }
    setSums({ total: t, due: d });
    setLoading(false);
  }, [sb, kind, from, to, status, branchId, dq, page, size]);
  useEffect(() => { load(); }, [load]);

  const filtered = rows;
  const total = sums.total;
  const due = sums.due;

  return (
    <div>
      <PageHeader title={kind === "sales" ? "فواتير البيع" : "فواتير الشراء"}>
        {kind === "sales" && can("admin", "accountant", "branch_manager", "cashier") && <Link href="/pos" className="btn"><I n="plus" /> فاتورة بيع (POS)</Link>}
        {kind === "purchase" && can("admin", "accountant", "branch_manager") && <Link href="/purchases/new" className="btn"><I n="plus" /> فاتورة شراء</Link>}
      </PageHeader>
      <div className="card mb-3 flex flex-wrap gap-3 items-end no-print">
        <div><label className="label">من</label><input type="date" lang="en-GB" dir="ltr" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><label className="label">إلى</label><input type="date" lang="en-GB" dir="ltr" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div><label className="label">الحالة</label>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">الكل</option>
            {Object.entries(INV_STATUS).filter(([k]) => k !== "draft").map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></div>
        <div className="flex-1 min-w-[160px]"><label className="label">بحث</label><input className="input" placeholder="رقم الفاتورة / الاسم" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      </div>
      <div className="card overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>الرقم</th><th>التاريخ</th><th>{kind === "sales" ? "العميل" : "المورد"}</th><th>الفرع</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th><th>الحالة</th><th></th></tr></thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className={r.status === "cancelled" ? "opacity-50" : ""}>
                <td className="num font-medium">{r.invoice_number}</td>
                <td>{fdate(r.invoice_date)}</td>
                <td>{r.contacts?.name_ar}</td>
                <td>{r.branches?.name_ar}</td>
                <td className="num">{money(r.total)}</td>
                <td className="num">{money(r.amount_paid)}</td>
                <td className="num">{money(Number(r.total) - Number(r.amount_paid))}</td>
                <td><span className={`badge ${r.status === "paid" ? "badge-ok" : r.status === "cancelled" ? "badge-bad" : "badge-warn"}`}>{INV_STATUS[r.status]}</span></td>
                <td><Link className="text-brand-600 underline" href={`/invoices/${r.id}`}>عرض</Link></td>
              </tr>
            ))}
          </tbody>
          {count > 0 && <tfoot><tr className="font-bold bg-slate-50"><td colSpan={4}>الإجمالي (بدون الملغاة)</td><td className="num">{money(total)}</td><td></td><td className="num">{money(due)}</td><td colSpan={2}></td></tr></tfoot>}
        </table>
        {!loading && !filtered.length && <Empty />}
        <Pager page={page} size={size} total={count} setPage={setPage} setSize={setSize} />
      </div>
    </div>
  );
}
