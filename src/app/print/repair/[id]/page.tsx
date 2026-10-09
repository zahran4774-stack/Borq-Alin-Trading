"use client";
import { I } from "@/components/Icon";
import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { LangToggle } from "@/lib/i18n";
import { getSupabase } from "@/lib/supabase/client";
import { fdate, fdt, money } from "@/lib/format";

function Inner() {
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const sb = getSupabase();
  const [d, setD] = useState<any>(null);
  useEffect(() => {
    (async () => {
      const [o, c] = await Promise.all([
        sb.from("repair_orders").select("*, branches(name_ar,address_ar,phone)").eq("id", id).maybeSingle(),
        sb.from("company_settings").select("*").limit(1).maybeSingle(),
      ]);
      setD({ o: o.data, co: c.data });
    })();
  }, [sb, id]);
  useEffect(() => { if (d?.o && sp.get("auto") === "1") setTimeout(() => window.print(), 400); }, [d, sp]);
  if (!d) return <div className="p-6">…</div>;
  if (!d.o) return <div className="p-6 text-red-600">غير موجود</div>;
  const { o, co } = d;
  return (
    <div className="bg-slate-200 min-h-screen">
      <div className="no-print flex gap-2 justify-center p-3 bg-slate-100">
        <LangToggle />
      <button className="btn" onClick={() => window.print()}><I n="printer" /> طباعة</button>
        <button className="btn btn-sec" onClick={() => window.close()}>إغلاق</button>
      </div>
      <div className="sheet-a4 print-area shadow my-3 text-[13px]">
        <div className="flex justify-between border-b-2 border-brand-700 pb-3">
          <div>
            <div className="text-2xl font-bold text-brand-700">{co?.name_ar}</div>
            <div>{o.branches?.name_ar}{o.branches?.address_ar ? ` — ${o.branches.address_ar}` : ""}</div>
            <div className="num">{o.branches?.phone || co?.phone}</div>
          </div>
          <div className="text-end">
            <div className="text-xl font-bold">إيصال استلام جهاز للصيانة</div>
            <div>رقم الأمر: <b className="num">{o.order_no}</b></div>
            <div>التاريخ: <span className="num">{fdt(o.received_at)}</span></div>
          </div>
        </div>
        <table className="w-full mt-4 border-collapse">
          <tbody>
            {[
              ["العميل", o.customer_name, "الهاتف", o.customer_phone],
              ["الجهاز", [o.device_type, o.brand, o.model].filter(Boolean).join(" "), "IMEI / السيريال", o.serial_no],
              ["الملحقات المستلمة", o.accessories_received, "حالة الجهاز", o.condition_notes],
              ["التكلفة التقديرية", money(o.estimated_cost), "موعد التسليم المتوقع", o.promised_at ? fdate(o.promised_at) : ""],
              ["العربون المدفوع", money(o.deposit_amount), "", ""],
            ].map((r, i) => (
              <tr key={i} className="border">
                <td className="p-2 bg-slate-50 w-32 font-medium">{r[0]}</td><td className="p-2">{r[1]}</td>
                <td className="p-2 bg-slate-50 w-36 font-medium">{r[2]}</td><td className="p-2 num">{r[3]}</td>
              </tr>))}
            <tr className="border"><td className="p-2 bg-slate-50 font-medium">العطل المبلّغ عنه</td><td className="p-2" colSpan={3}>{o.problem_ar}</td></tr>
          </tbody>
        </table>
        <div className="mt-4 p-3 border rounded text-xs leading-6">
          <b>شروط الصيانة:</b>
          <div style={{ whiteSpace: "pre-line" }}>{co?.repair_terms_ar || "يلتزم العميل باستلام جهازه خلال 30 يوماً من إشعاره بجاهزيته، وإلا لا تتحمل المنشأة مسؤولية الجهاز بعد ذلك.\nلا تتحمل المنشأة مسؤولية البيانات المخزنة على الجهاز.\nيُبرز هذا الإيصال عند الاستلام."}</div>
        </div>
        <div className="mt-16 flex justify-between text-xs">
          <div>توقيع العميل: ____________</div><div>الموظف المستلم: ____________</div>
        </div>
      </div>
    </div>
  );
}
export default function PrintRepair() { return <Suspense fallback={null}><Inner /></Suspense>; }
