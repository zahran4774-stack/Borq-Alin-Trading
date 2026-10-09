"use client";
import { I } from "@/components/Icon";
import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/lib/app-context";
import { downloadCSV, fdate, money, today } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { useOverdue, waLink } from "@/lib/overdue";
import { Empty, PageHeader, StatCard, usePaged } from "@/components/ui";

export default function Overdue() {
  const { company } = useApp();
  const { lang } = useLang();
  const [kind, setKind] = useState<"sales" | "purchase">("sales");
  const [days, setDays] = useState(30);
  const { rows, loading, total } = useOverdue(kind, days);
  const pg = usePaged(rows, 50);

  const msg = (r: { name: string; amount: number; daysLate: number }) =>
    lang === "en"
      ? `Hello ${r.name}, this is a friendly reminder from ${company.name_en || company.name_ar}: an outstanding balance of ${money(r.amount)} OMR is overdue by ${r.daysLate} days. Kindly arrange payment at your earliest convenience. Thank you.`
      : `مرحباً ${r.name}، نذكّركم من ${company.name_ar} بوجود مبلغ مستحق قدره ${money(r.amount)} ر.ع متأخر السداد منذ ${r.daysLate} يوماً. نرجو التكرم بالسداد في أقرب وقت. شكراً لتعاونكم.`;

  return (
    <div>
      <PageHeader title="المتأخرون عن السداد">
        <button className="btn btn-sec" onClick={() => window.print()}><I n="printer" /> طباعة</button>
        <button className="btn btn-sec" onClick={() => downloadCSV(`overdue-${today()}.csv`, [["name", "phone", "invoices", "oldest", "days_late", "amount"], ...rows.map((r) => [r.name, r.phone || "", r.invoices, r.oldest, r.daysLate, r.amount.toFixed(3)])])}><I n="upload" /> تصدير CSV</button>
      </PageHeader>
      <div className="flex flex-wrap gap-2 mb-3 no-print">
        <button className={`btn ${kind === "sales" ? "" : "btn-sec"}`} onClick={() => setKind("sales")}><I n="users" /> عملاء متأخرون عن السداد لنا</button>
        <button className={`btn ${kind === "purchase" ? "" : "btn-sec"}`} onClick={() => setKind("purchase")}><I n="truck" /> مستحقات موردين متأخرة علينا</button>
        <div className="flex items-center gap-2 ms-auto">
          <span className="text-sm text-slate-600">متأخر أكثر من</span>
          <select className="input !w-28" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {[7, 15, 30, 45, 60, 90].map((d) => <option key={d} value={d}>{d} يوم</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <StatCard icon="clock" label="عدد المتأخرين" value={String(rows.length)} tone={rows.length ? "bad" : "ok"} />
        <StatCard icon="wallet" label="إجمالي المبالغ المتأخرة" value={money(total)} tone={total ? "bad" : "ok"} />
      </div>
      <div className="card overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>{kind === "sales" ? "العميل" : "المورد"}</th><th>الهاتف</th><th>الفواتير</th><th>أقدم فاتورة</th><th>أيام التأخير</th><th>المبلغ المتأخر</th><th className="no-print"></th></tr></thead>
          <tbody>
            {pg.rows.map((r) => {
              const wa = kind === "sales" ? waLink(r.phone, msg(r)) : null;
              return (
                <tr key={r.contact_id}>
                  <td className="font-medium">{r.name}</td>
                  <td className="num">{r.phone}</td>
                  <td className="num">{r.invoices}</td>
                  <td>{fdate(r.oldest)}</td>
                  <td><span className={`badge ${r.daysLate > 60 ? "badge-bad" : "badge-warn"}`}>{r.daysLate} يوم</span></td>
                  <td className="num font-bold text-red-600">{money(r.amount)}</td>
                  <td className="no-print whitespace-nowrap space-x-2 space-x-reverse">
                    {wa && <a className="btn btn-ok btn-sm" href={wa} target="_blank" rel="noreferrer"><I n="chat" /> واتساب</a>}
                    {r.phone && <a className="btn btn-sec btn-sm" href={`tel:${r.phone}`}><I n="phone" /> </a>}
                    <Link className="btn btn-sec btn-sm" href={`/contacts/${r.contact_id}`}><I n="bookOpen" /> كشف حساب</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>{pg.bar}
        {!loading && !rows.length && <Empty text="لا يوجد متأخرون — ممتاز" />}
      </div>
      <p className="text-xs text-slate-500 mt-3">يُحسب التأخير من تاريخ استحقاق الفاتورة، وإن لم يكن لها تاريخ استحقاق فمن تاريخ الفاتورة. العميل النقدي مستثنى.</p>
    </div>
  );
}
