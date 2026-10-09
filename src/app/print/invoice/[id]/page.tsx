"use client";
import { I } from "@/components/Icon";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { LangToggle, useLang } from "@/lib/i18n";
import { getSupabase } from "@/lib/supabase/client";
import { fdate, METHODS, money } from "@/lib/format";

function Inner() {
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const fmt = sp.get("fmt") === "thermal" ? "thermal" : "a4";
  const sb = getSupabase();
  const { lang } = useLang();
  const lname = (l: any) => (lang === "en" && l.products?.name_en ? l.products.name_en : l.description_ar);
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      const [i, l, a, c] = await Promise.all([
        sb.from("invoices").select("*, contacts(name_ar,phone,tax_number,address_ar), branches(name_ar,address_ar,phone)").eq("id", id).maybeSingle(),
        sb.from("invoice_lines").select("*, products(name_en)").eq("invoice_id", id).order("id"),
        sb.from("payment_allocations").select("amount, payments(method,voided)").eq("invoice_id", id),
        sb.from("company_settings").select("*").limit(1).maybeSingle(),
      ]);
      if (!i.data) { setErr("الفاتورة غير موجودة أو لا تملك صلاحية عرضها"); return; }
      setD({ inv: i.data, lines: l.data || [], pays: ((a.data as any[]) || []).filter((x) => !x.payments?.voided), co: c.data });
    })();
  }, [sb, id]);

  useEffect(() => {
    if (d && sp.get("auto") === "1") setTimeout(() => window.print(), 400);
  }, [d, sp]);

  if (err) return <div className="p-6 text-red-600">{err}</div>;
  if (!d) return <div className="p-6 text-slate-500">…</div>;
  const { inv, lines, pays, co } = d;
  const sales = inv.kind === "sales";
  const title = inv.status === "cancelled" ? "فاتورة ملغاة" : sales ? "فاتورة ضريبية" : "فاتورة شراء";
  const rem = Number(inv.total) - Number(inv.amount_paid);
  const vatTotal = Number(inv.tax_amount);

  const toolbar = (
    <div className="no-print flex gap-2 justify-center p-3 bg-slate-100">
      <LangToggle />
      <button className="btn" onClick={() => window.print()}><I n="printer" /> طباعة</button>
      <a className="btn btn-sec" href={`?fmt=${fmt === "a4" ? "thermal" : "a4"}`}>{fmt === "a4" ? "عرض إيصال 80mm" : "عرض A4"}</a>
      <button className="btn btn-sec" onClick={() => window.close()}>إغلاق</button>
    </div>
  );

  if (fmt === "thermal")
    return (
      <div>
        {toolbar}
        <style>{`@page{size:80mm auto;margin:0}`}</style>
        <div className="sheet-80 print-area" style={{ lineHeight: 1.45 }}>
          <div className="text-center">
            <div className="font-bold text-sm">{co?.name_ar}</div>
            <div>{inv.branches?.name_ar}</div>
            {inv.branches?.address_ar && <div>{inv.branches.address_ar}</div>}
            {(inv.branches?.phone || co?.phone) && <div className="num">{inv.branches?.phone || co?.phone}</div>}
            {co?.tax_number && <div>الرقم الضريبي: <span className="num">{co.tax_number}</span></div>}
            <div className="font-bold mt-1">{title}</div>
          </div>
          <hr className="my-1 border-dashed border-black" />
          <div className="flex justify-between"><span>رقم:</span><span className="num">{inv.invoice_number}</span></div>
          <div className="flex justify-between"><span>التاريخ:</span><span className="num">{fdate(inv.invoice_date)}</span></div>
          <div className="flex justify-between"><span>العميل:</span><span>{inv.contacts?.name_ar}</span></div>
          <hr className="my-1 border-dashed border-black" />
          {lines.map((l: any) => (
            <div key={l.id} className="mb-1">
              <div>{lname(l)}</div>
              <div className="flex justify-between num"><span>{Number(l.quantity)} × {money(l.unit_price)}{Number(l.discount_amount) > 0 ? ` (-${money(l.discount_amount)})` : ""}</span><span>{money(Number(l.line_total) + Number(l.tax_amount))}</span></div>
              {l.serial_numbers?.length > 0 && <div className="num" style={{ fontSize: 10 }}>S/N: {l.serial_numbers.join(", ")}</div>}
            </div>
          ))}
          <hr className="my-1 border-dashed border-black" />
          <div className="flex justify-between"><span>قبل الضريبة</span><span className="num">{money(inv.subtotal)}</span></div>
          <div className="flex justify-between"><span>الضريبة</span><span className="num">{money(vatTotal)}</span></div>
          <div className="flex justify-between font-bold text-sm"><span>الإجمالي</span><span className="num">{money(inv.total)}</span></div>
          {Number(inv.deposit_applied) > 0 && <div className="flex justify-between"><span>عربون</span><span className="num">{money(inv.deposit_applied)}</span></div>}
          {pays.map((p: any, i: number) => <div key={i} className="flex justify-between"><span>{METHODS[p.payments?.method]}</span><span className="num">{money(p.amount)}</span></div>)}
          {rem > 0.0005 && inv.status !== "cancelled" && <div className="flex justify-between font-bold"><span>المتبقي</span><span className="num">{money(rem)}</span></div>}
          <hr className="my-1 border-dashed border-black" />
          <div className="text-center">{co?.invoice_footer_ar || "شكراً لتعاملكم معنا"}</div>
        </div>
      </div>
    );

  return (
    <div className="bg-slate-200 min-h-screen">
      {toolbar}
      <div className="sheet-a4 print-area shadow my-3 text-[13px]">
        <div className="flex justify-between items-start border-b-2 border-brand-700 pb-3">
          <div>
            <div className="text-2xl font-bold text-brand-700">{co?.name_ar}</div>
            {co?.name_en && <div className="text-slate-500">{co.name_en}</div>}
            <div className="mt-1">{inv.branches?.name_ar}{inv.branches?.address_ar ? ` — ${inv.branches.address_ar}` : ""}</div>
            <div className="num">{inv.branches?.phone || co?.phone}</div>
            {co?.tax_number && <div>الرقم الضريبي: <span className="num">{co.tax_number}</span></div>}
            {co?.cr_number && <div>السجل التجاري: <span className="num">{co.cr_number}</span></div>}
          </div>
          <div className="text-end">
            <div className="text-xl font-bold">{title}</div>
            <div>رقم: <span className="num font-bold">{inv.invoice_number}</span></div>
            <div>التاريخ: <span className="num">{fdate(inv.invoice_date)}</span></div>
            {inv.supplier_invoice_no && <div>فاتورة المورد: <span className="num">{inv.supplier_invoice_no}</span></div>}
          </div>
        </div>
        <div className="my-3 p-2 bg-slate-50 rounded">
          <span className="text-slate-500">{sales ? "العميل" : "المورد"}: </span><b>{inv.contacts?.name_ar}</b>
          {inv.contacts?.phone && <span className="mr-4 num">{inv.contacts.phone}</span>}
          {inv.contacts?.tax_number && <span className="mr-4">الرقم الضريبي: <span className="num">{inv.contacts.tax_number}</span></span>}
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-brand-700 text-white">
              {["#", "البيان", "الكمية", "السعر", "الخصم", "الصافي", "الضريبة", "الإجمالي"].map((h) => <th key={h} className="p-2 text-right">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {lines.map((l: any, i: number) => (
              <tr key={l.id} className="border-b">
                <td className="p-2 num">{i + 1}</td>
                <td className="p-2">{lname(l)}{l.serial_numbers?.length > 0 && <div className="text-xs text-slate-500 num">S/N: {l.serial_numbers.join(" , ")}</div>}</td>
                <td className="p-2 num">{Number(l.quantity)}</td><td className="p-2 num">{money(l.unit_price)}</td>
                <td className="p-2 num">{money(l.discount_amount)}</td><td className="p-2 num">{money(l.line_total)}</td>
                <td className="p-2 num">{money(l.tax_amount)}</td><td className="p-2 num">{money(Number(l.line_total) + Number(l.tax_amount))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-between mt-4">
          <div className="text-xs text-slate-600 max-w-sm">
            {inv.notes && <div className="mb-2"><b>ملاحظات:</b> {inv.notes}</div>}
            {pays.length > 0 && <div><b>الدفع:</b> {pays.map((p: any) => `${METHODS[p.payments?.method]} ${money(p.amount)}`).join(" ، ")}</div>}
          </div>
          <div className="w-64 space-y-1">
            <div className="flex justify-between"><span>المجموع قبل الضريبة</span><span className="num">{money(inv.subtotal)}</span></div>
            <div className="flex justify-between"><span>ضريبة القيمة المضافة</span><span className="num">{money(vatTotal)}</span></div>
            <div className="flex justify-between font-bold text-base border-t-2 border-black pt-1"><span>الإجمالي (ر.ع)</span><span className="num">{money(inv.total)}</span></div>
            {Number(inv.deposit_applied) > 0 && <div className="flex justify-between"><span>عربون مخصوم</span><span className="num">{money(inv.deposit_applied)}</span></div>}
            <div className="flex justify-between"><span>المدفوع</span><span className="num">{money(inv.amount_paid)}</span></div>
            {rem > 0.0005 && inv.status !== "cancelled" && <div className="flex justify-between font-bold text-red-700"><span>المتبقي</span><span className="num">{money(rem)}</span></div>}
          </div>
        </div>
        <div className="mt-16 flex justify-between text-xs text-slate-600">
          <div>توقيع المستلم: ____________</div><div>الختم والتوقيع: ____________</div>
        </div>
        <div className="mt-6 text-center text-xs text-slate-500 border-t pt-2">{co?.invoice_footer_ar || "شكراً لتعاملكم معنا"}</div>
      </div>
    </div>
  );
}

export default function PrintInvoice() {
  return <Suspense fallback={null}><Inner /></Suspense>;
}
