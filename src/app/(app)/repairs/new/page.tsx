"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/app-context";
import { errMsg, METHODS } from "@/lib/format";
import { Field, Msg, NeedBranch, PageHeader } from "@/components/ui";

export default function NewRepair() {
  const { sb, opBranch } = useApp();
  const router = useRouter();
  const [f, setF] = useState<any>({ customer_name: "", customer_phone: "", device_type: "هاتف", brand: "", model: "", serial_no: "", problem: "", accessories: "", condition: "", estimated: 0, promised: "", deposit: 0, method: "cash" });
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const set = (k: string, v: any) => setF({ ...f, [k]: v });
  if (!opBranch) return <NeedBranch />;
  async function save() {
    setErr("");
    if (!f.customer_name.trim() || !f.problem.trim()) { setErr("اسم العميل ووصف العطل مطلوبان"); return; }
    setBusy(true);
    const { data, error } = await sb.rpc("create_repair_order", {
      p_branch_id: opBranch, p_customer_name: f.customer_name, p_customer_phone: f.customer_phone || null, p_device_type: f.device_type || null,
      p_brand: f.brand || null, p_model: f.model || null, p_serial_no: f.serial_no || null, p_problem: f.problem, p_accessories: f.accessories || null,
      p_condition: f.condition || null, p_estimated: Number(f.estimated) || 0, p_promised: f.promised || null,
      p_deposit: Number(f.deposit) || 0, p_deposit_method: f.method, p_contact_id: null,
    });
    setBusy(false);
    if (error) { setErr(errMsg(error)); return; }
    window.open(`/print/repair/${data}?auto=1`, "_blank");
    router.push(`/repairs/${data}`);
  }
  return (
    <div>
      <PageHeader title="استلام جهاز للصيانة" />
      <Msg error={err} />
      <div className="card grid sm:grid-cols-3 gap-3">
        <Field label="اسم العميل *"><input className="input" value={f.customer_name} onChange={(e) => set("customer_name", e.target.value)} /></Field>
        <Field label="هاتف العميل"><input className="input num" value={f.customer_phone} onChange={(e) => set("customer_phone", e.target.value)} /></Field>
        <Field label="نوع الجهاز"><input className="input" value={f.device_type} onChange={(e) => set("device_type", e.target.value)} placeholder="هاتف / طابعة / لابتوب" /></Field>
        <Field label="الماركة"><input className="input" value={f.brand} onChange={(e) => set("brand", e.target.value)} /></Field>
        <Field label="الموديل"><input className="input" value={f.model} onChange={(e) => set("model", e.target.value)} /></Field>
        <Field label="IMEI / رقم تسلسلي"><input className="input num" value={f.serial_no} onChange={(e) => set("serial_no", e.target.value)} /></Field>
        <Field label="وصف العطل *" className="sm:col-span-3"><textarea className="input" rows={2} value={f.problem} onChange={(e) => set("problem", e.target.value)} /></Field>
        <Field label="الملحقات المستلمة"><input className="input" value={f.accessories} onChange={(e) => set("accessories", e.target.value)} placeholder="شاحن، جراب، شريحة…" /></Field>
        <Field label="حالة الجهاز عند الاستلام" className="sm:col-span-2"><input className="input" value={f.condition} onChange={(e) => set("condition", e.target.value)} placeholder="خدوش، شاشة مكسورة…" /></Field>
        <Field label="التكلفة التقديرية"><input type="number" step="0.001" className="input num" value={f.estimated} onChange={(e) => set("estimated", e.target.value)} /></Field>
        <Field label="موعد التسليم المتوقع"><input type="date" className="input" value={f.promised} onChange={(e) => set("promised", e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="عربون"><input type="number" step="0.001" className="input num" value={f.deposit} onChange={(e) => set("deposit", e.target.value)} /></Field>
          <Field label="طريقة الدفع"><select className="input" value={f.method} onChange={(e) => set("method", e.target.value)}>{Object.entries(METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        </div>
        <div className="sm:col-span-3"><button className="btn btn-ok" disabled={busy} onClick={save}>{busy ? "…" : "حفظ وطباعة إيصال الاستلام"}</button></div>
      </div>
    </div>
  );
}
