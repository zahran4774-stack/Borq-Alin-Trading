"use client";
import { I } from "@/components/Icon";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/app-context";
import { fdate, money, REPAIR_STATUS } from "@/lib/format";
import { Empty, PageHeader, usePaged } from "@/components/ui";

const tone = (s: string) => (s === "ready" ? "badge-ok" : s === "delivered" ? "badge" : s === "cancelled" ? "badge-bad" : s === "received" ? "badge-info" : "badge-warn");

export default function Repairs() {
  const { sb, branchId, can } = useApp();
  const [rows, setRows] = useState<any[]>([]);
  const [status, setStatus] = useState("open");
  const [q, setQ] = useState("");
  useEffect(() => {
    let query = sb.from("repair_orders").select("*, branches(name_ar)").order("received_at", { ascending: false }).limit(500);
    if (branchId !== "all") query = query.eq("branch_id", branchId);
    if (status === "open") query = query.not("status", "in", "(delivered,cancelled)");
    else if (status) query = query.eq("status", status);
    query.then(({ data }) => setRows((data as any) || []));
  }, [sb, branchId, status]);
  const list = rows.filter((r) => !q || [r.order_no, r.customer_name, r.customer_phone, r.serial_no, r.model].some((x) => x?.includes(q)));
  const pg = usePaged(list, 50);
  return (
    <div>
      <PageHeader title="أوامر الصيانة">
        {can("admin", "accountant", "branch_manager", "cashier", "technician") && <Link href="/repairs/new" className="btn"><I n="plus" /> استلام جهاز</Link>}
      </PageHeader>
      <div className="card mb-3 flex gap-3 flex-wrap">
        <input className="input !w-64" placeholder="بحث: رقم / عميل / هاتف / IMEI" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input !w-48" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="open">المفتوحة</option><option value="">الكل</option>
          {Object.entries(REPAIR_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div className="card overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>الرقم</th><th>العميل</th><th>الجهاز</th><th>العطل</th><th>الفرع</th><th>الاستلام</th><th>الموعد</th><th>العربون</th><th>الحالة</th><th></th></tr></thead>
          <tbody>{pg.rows.map((r) => (
            <tr key={r.id}>
              <td className="num font-medium">{r.order_no}</td>
              <td>{r.customer_name}<div className="text-xs text-slate-500 num">{r.customer_phone}</div></td>
              <td>{[r.device_type, r.brand, r.model].filter(Boolean).join(" ")}</td>
              <td className="max-w-[200px] truncate">{r.problem_ar}</td>
              <td>{r.branches?.name_ar}</td><td>{fdate(r.received_at)}</td><td>{fdate(r.promised_at)}</td>
              <td className="num">{money(r.deposit_amount)}</td>
              <td><span className={`badge ${tone(r.status)}`}>{REPAIR_STATUS[r.status]}</span></td>
              <td><Link className="text-brand-600 underline" href={`/repairs/${r.id}`}>فتح</Link></td>
            </tr>))}</tbody>
        </table>{pg.bar}
        {!list.length && <Empty />}
      </div>
    </div>
  );
}
