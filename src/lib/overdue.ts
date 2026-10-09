"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/app-context";

export type OverdueRow = {
  contact_id: string; name: string; phone: string | null; invoices: number; amount: number;
  oldest: string; daysLate: number; branchIds: string[];
};

const DAY = 86400000;

// المتأخر = فاتورة غير مسددة بالكامل مضى على تاريخ استحقاقها (أو تاريخها إن لم يوجد استحقاق) أكثر من N يوماً
export function useOverdue(kind: "sales" | "purchase", minDays = 30) {
  const { sb, branchId } = useApp();
  const [rows, setRows] = useState<OverdueRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      let q = sb.from("invoices")
        .select("contact_id,invoice_date,due_date,total,amount_paid,branch_id,contacts(name_ar,phone,code)")
        .eq("kind", kind).in("status", ["confirmed", "partially_paid"]).limit(20000);
      if (branchId !== "all") q = q.eq("branch_id", branchId);
      const { data } = await q;
      const m = new Map<string, OverdueRow>();
      const now = Date.now();
      ((data as any[]) || []).forEach((i) => {
        const rem = Number(i.total) - Number(i.amount_paid);
        if (rem <= 0.0005 || i.contacts?.code === "CASH") return;
        const base = new Date((i.due_date || i.invoice_date) + "T00:00:00").getTime();
        const late = Math.floor((now - base) / DAY);
        if (late < minDays) return;
        const r: OverdueRow = m.get(i.contact_id) || { contact_id: i.contact_id, name: i.contacts?.name_ar || "—", phone: i.contacts?.phone || null, invoices: 0, amount: 0, oldest: i.invoice_date, daysLate: 0, branchIds: [] };
        r.invoices += 1; r.amount += rem; r.daysLate = Math.max(r.daysLate, late);
        if (i.invoice_date < r.oldest) r.oldest = i.invoice_date;
        if (!r.branchIds.includes(i.branch_id)) r.branchIds.push(i.branch_id);
        m.set(i.contact_id, r);
      });
      if (alive) { setRows([...m.values()].sort((a, b) => b.daysLate - a.daysLate)); setLoading(false); }
    })();
    return () => { alive = false; };
  }, [sb, branchId, kind, minDays]);

  return { rows, loading, total: rows.reduce((s, r) => s + r.amount, 0) };
}

export function waLink(phone: string | null, text: string): string | null {
  if (!phone) return null;
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 8) d = "968" + d;
  if (d.length < 9) return null;
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}
