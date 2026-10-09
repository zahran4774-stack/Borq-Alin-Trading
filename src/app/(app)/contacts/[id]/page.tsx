"use client";
import { I } from "@/components/Icon";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useApp } from "@/lib/app-context";
import { fdate, INV_STATUS, METHODS, money } from "@/lib/format";
import { Empty, PageHeader, usePaged } from "@/components/ui";

export default function Statement() {
  const { id } = useParams<{ id: string }>();
  const { sb } = useApp();
  const [c, setC] = useState<any>(null); const [inv, setInv] = useState<any[]>([]); const [pay, setPay] = useState<any[]>([]);
  const pgI = usePaged(inv), pgP = usePaged(pay);
  useEffect(() => {
    (async () => {
      const [a, b, p] = await Promise.all([
        sb.from("contacts").select("*").eq("id", id).maybeSingle(),
        sb.from("invoices").select("*, branches(name_ar)").eq("contact_id", id).order("invoice_date", { ascending: false }).limit(1000),
        sb.from("payments").select("*").eq("contact_id", id).eq("voided", false).order("payment_date", { ascending: false }).limit(1000),
      ]);
      setC(a.data); setInv((b.data as any) || []); setPay((p.data as any) || []);
    })();
  }, [sb, id]);
  if (!c) return <div>…</div>;
  const open = inv.filter((i) => i.status !== "cancelled");
  const recv = open.filter((i) => i.kind === "sales").reduce((s, i) => s + Number(i.total) - Number(i.amount_paid), 0);
  const owed = open.filter((i) => i.kind === "purchase").reduce((s, i) => s + Number(i.total) - Number(i.amount_paid), 0);
  return (
    <div>
      <PageHeader title={`كشف حساب: ${c.name_ar}`}><button className="btn btn-sec" onClick={() => window.print()}><I n="printer" /> طباعة</button><Link href="/payments" className="btn">سند قبض/صرف</Link></PageHeader>
      <div className="hidden print-only mb-2 text-lg font-bold">كشف حساب: {c.name_ar}</div>
      <div className="grid sm:grid-cols-3 gap-3 mb-4">
        <div className="card"><div className="text-xs text-slate-500">مستحق لنا (مبيعات)</div><div className="text-xl font-bold num">{money(recv)}</div></div>
        <div className="card"><div className="text-xs text-slate-500">مستحق للمورد (مشتريات)</div><div className="text-xl font-bold num">{money(owed)}</div></div>
        <div className="card"><div className="text-xs text-slate-500">الصافي</div><div className="text-xl font-bold num">{money(recv - owed)}</div></div>
      </div>
      <div className="card overflow-x-auto mb-4">
        <h3 className="font-semibold mb-2">الفواتير</h3>
        <table className="tbl"><thead><tr><th>الرقم</th><th>النوع</th><th>التاريخ</th><th>الفرع</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th><th>الحالة</th></tr></thead>
          <tbody>{pgI.rows.map((i) => <tr key={i.id} className={i.status === "cancelled" ? "opacity-50" : ""}><td><Link className="text-brand-600 underline num" href={`/invoices/${i.id}`}>{i.invoice_number}</Link></td><td>{i.kind === "sales" ? "بيع" : "شراء"}</td><td>{fdate(i.invoice_date)}</td><td>{i.branches?.name_ar}</td><td className="num">{money(i.total)}</td><td className="num">{money(i.amount_paid)}</td><td className="num">{money(Number(i.total) - Number(i.amount_paid))}</td><td>{INV_STATUS[i.status]}</td></tr>)}</tbody></table>{pgI.bar}
        {!inv.length && <Empty />}
      </div>
      <div className="card overflow-x-auto">
        <h3 className="font-semibold mb-2">الدفعات</h3>
        <table className="tbl"><thead><tr><th>التاريخ</th><th>الاتجاه</th><th>الطريقة</th><th>المبلغ</th><th>المرجع</th></tr></thead>
          <tbody>{pgP.rows.map((p) => <tr key={p.id}><td>{fdate(p.payment_date)}</td><td>{p.direction === "in" ? "قبض" : "صرف"}</td><td>{METHODS[p.method]}</td><td className="num">{money(p.amount)}</td><td>{p.reference}</td></tr>)}</tbody></table>{pgP.bar}
        {!pay.length && <Empty />}
      </div>
    </div>
  );
}
