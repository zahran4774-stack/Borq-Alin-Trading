"use client";
import { I } from "@/components/Icon";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/lib/app-context";
import { errMsg, money } from "@/lib/format";
import type { Contact } from "@/lib/types";
import { Empty, Field, Modal, Msg, PageHeader, usePaged } from "@/components/ui";

const TYPES: Record<string, string> = { customer: "عميل", supplier: "مورد", both: "عميل ومورد" };

export default function Contacts() {
  const { sb, can } = useApp();
  const canEdit = can("admin", "accountant", "branch_manager", "cashier");
  const [rows, setRows] = useState<Contact[]>([]);
  const [bal, setBal] = useState<Record<string, number>>({});
  const [q, setQ] = useState(""); const [type, setType] = useState("");
  const [edit, setEdit] = useState<any>(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const [c, i] = await Promise.all([
      sb.from("contacts").select("*").order("name_ar").limit(5000),
      sb.rpc("contact_balances"),
    ]);
    setRows((c.data as any) || []);
    const m: Record<string, number> = {};
    ((i.data as any[]) || []).forEach((x) => { m[x.contact_id] = Number(x.balance); });
    setBal(m);
  }, [sb]);
  useEffect(() => { load(); }, [load]);

  async function save() {
    setErr("");
    if (!edit.name_ar?.trim()) { setErr("الاسم مطلوب"); return; }
    const payload = { name_ar: edit.name_ar.trim(), type: edit.type, phone: edit.phone || null, email: edit.email || null, address_ar: edit.address_ar || null, tax_number: edit.tax_number || null, credit_limit: Number(edit.credit_limit) || 0, is_active: !!edit.is_active };
    const r = edit.id ? await sb.from("contacts").update(payload).eq("id", edit.id) : await sb.from("contacts").insert(payload);
    if (r.error) { setErr(errMsg(r.error)); return; }
    setEdit(null); load();
  }
  const list = rows.filter((r) => (!type || r.type === type || (type !== "supplier" && type !== "customer" ? false : r.type === "both")) && (!q || r.name_ar.includes(q) || r.phone?.includes(q)));
  const pg = usePaged(list, 50);
  return (
    <div>
      <PageHeader title="العملاء والموردون">
        {canEdit && <button className="btn" onClick={() => { setErr(""); setEdit({ name_ar: "", type: "customer", credit_limit: 0, is_active: true }); }}><I n="plus" /> جديد</button>}
      </PageHeader>
      <div className="card mb-3 flex gap-3 flex-wrap">
        <input className="input !w-64" placeholder="بحث بالاسم أو الهاتف" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input !w-40" value={type} onChange={(e) => setType(e.target.value)}><option value="">الكل</option><option value="customer">عملاء</option><option value="supplier">موردون</option></select>
      </div>
      <div className="card overflow-x-auto">
        <table className="tbl"><thead><tr><th>الاسم</th><th>النوع</th><th>الهاتف</th><th>الرصيد</th><th></th></tr></thead>
          <tbody>{pg.rows.map((c) => {
            const b = bal[c.id] || 0;
            return (<tr key={c.id} className={c.is_active ? "" : "opacity-50"}>
              <td className="font-medium">{c.name_ar}</td><td>{TYPES[c.type]}</td><td className="num">{c.phone}</td>
              <td className={`num ${b > 0 ? "text-amber-600" : b < 0 ? "text-red-600" : ""}`}>{money(Math.abs(b))} <span className="text-xs">{b > 0 ? "(مستحق لنا)" : b < 0 ? "(مستحق للمورد)" : ""}</span></td>
              <td className="space-x-2 space-x-reverse"><Link className="text-brand-600 underline" href={`/contacts/${c.id}`}>كشف حساب</Link>
                {canEdit && c.code !== "CASH" && <button className="text-brand-600 underline" onClick={() => { setErr(""); setEdit(c); }}>تعديل</button>}</td>
            </tr>);
          })}</tbody></table>{pg.bar}
        {!list.length && <Empty />}
      </div>
      {edit && (
        <Modal title={edit.id ? "تعديل" : "جهة جديدة"} onClose={() => setEdit(null)}>
          <div className="space-y-3"><Msg error={err} />
            <Field label="الاسم *"><input className="input" value={edit.name_ar} onChange={(e) => setEdit({ ...edit, name_ar: e.target.value })} /></Field>
            <Field label="النوع"><select className="input" value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value })}>{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="الهاتف"><input className="input num" value={edit.phone || ""} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></Field>
            <Field label="البريد"><input className="input num" value={edit.email || ""} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>
            <Field label="العنوان"><input className="input" value={edit.address_ar || ""} onChange={(e) => setEdit({ ...edit, address_ar: e.target.value })} /></Field>
            <Field label="الرقم الضريبي"><input className="input num" value={edit.tax_number || ""} onChange={(e) => setEdit({ ...edit, tax_number: e.target.value })} /></Field>
            <Field label="حد الائتمان"><input type="number" step="0.001" className="input num" value={edit.credit_limit} onChange={(e) => setEdit({ ...edit, credit_limit: e.target.value })} /></Field>
            <label className="flex gap-2 text-sm"><input type="checkbox" checked={edit.is_active} onChange={(e) => setEdit({ ...edit, is_active: e.target.checked })} /> فعّال</label>
            <button className="btn w-full" onClick={save}><I n="save" /> حفظ</button></div>
        </Modal>
      )}
    </div>
  );
}
