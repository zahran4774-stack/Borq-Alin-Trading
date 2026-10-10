"use client";
import { I } from "@/components/Icon";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/lib/app-context";
import { errMsg, ROLES } from "@/lib/format";
import { ChangePasswordForm } from "@/components/ChangePassword";
import { Field, Modal, Msg, PageHeader } from "@/components/ui";

export default function Settings() {
  const { role } = useApp();
  const [tab, setTab] = useState<"co" | "br" | "us" | "bk" | "pw">("co");
  if (role !== "admin") return <Msg error="هذه الصفحة للمدير فقط" />;
  return (
    <div>
      <PageHeader title="الإعدادات" />
      <div className="flex gap-2 mb-3">{[["co", "بيانات المنشأة"], ["br", "الفروع"], ["us", "المستخدمون"], ["bk", "نسخة احتياطية"], ["pw", "كلمة المرور"]].map(([k, v]) => <button key={k} className={`btn ${tab === k ? "" : "btn-sec"}`} onClick={() => setTab(k as any)}>{v}</button>)}</div>
      {tab === "co" && <Company />}{tab === "br" && <Branches />}{tab === "us" && <Users />}{tab === "bk" && <Backup />}{tab === "pw" && <div className="card"><ChangePasswordForm /></div>}
    </div>
  );
}

function Company() {
  const { sb, company, reloadCompany } = useApp();
  const [f, setF] = useState<any>(company); const [err, setErr] = useState(""); const [ok, setOk] = useState("");
  const set = (k: string, v: any) => setF({ ...f, [k]: v });
  async function save() {
    setErr(""); setOk("");
    const { error } = await sb.from("company_settings").update({
      name_ar: f.name_ar, name_en: f.name_en || null, cr_number: f.cr_number || null, tax_number: f.tax_number || null, address_ar: f.address_ar || null,
      phone: f.phone || null, email: f.email || null, default_vat_rate: Number(f.default_vat_rate),
      books_locked_until: f.books_locked_until || null, invoice_footer_ar: f.invoice_footer_ar || null, repair_terms_ar: f.repair_terms_ar || null,
    }).eq("id", company.id);
    if (error) { setErr(errMsg(error)); return; }
    setOk("تم الحفظ"); reloadCompany();
  }
  return (
    <div className="card grid sm:grid-cols-2 gap-3">
      <div className="sm:col-span-2"><Msg error={err} ok={ok} /></div>
      <Field label="اسم المنشأة (عربي)"><input className="input" value={f.name_ar || ""} onChange={(e) => set("name_ar", e.target.value)} /></Field>
      <Field label="الاسم بالإنجليزية"><input className="input" value={f.name_en || ""} onChange={(e) => set("name_en", e.target.value)} /></Field>
      <Field label="الرقم الضريبي (VATIN)"><input className="input num" value={f.tax_number || ""} onChange={(e) => set("tax_number", e.target.value)} /></Field>
      <Field label="السجل التجاري"><input className="input num" value={f.cr_number || ""} onChange={(e) => set("cr_number", e.target.value)} /></Field>
      <Field label="الهاتف"><input className="input num" value={f.phone || ""} onChange={(e) => set("phone", e.target.value)} /></Field>
      <Field label="البريد"><input className="input num" value={f.email || ""} onChange={(e) => set("email", e.target.value)} /></Field>
      <Field label="العنوان" className="sm:col-span-2"><input className="input" value={f.address_ar || ""} onChange={(e) => set("address_ar", e.target.value)} /></Field>
      <Field label="نسبة الضريبة الافتراضية %"><input type="number" step="0.01" className="input num" value={f.default_vat_rate} onChange={(e) => set("default_vat_rate", e.target.value)} /></Field>
      <Field label="إقفال الدفاتر حتى تاريخ (لا يُسمح بقيود قبله)"><input type="date" className="input" value={f.books_locked_until || ""} onChange={(e) => set("books_locked_until", e.target.value)} /></Field>
      <Field label="تذييل الفاتورة" className="sm:col-span-2"><input className="input" value={f.invoice_footer_ar || ""} onChange={(e) => set("invoice_footer_ar", e.target.value)} placeholder="شكراً لتعاملكم معنا — البضاعة المباعة لا ترد ولا تستبدل بعد 7 أيام" /></Field>
      <Field label="شروط الصيانة (تظهر في إيصال الاستلام)" className="sm:col-span-2"><textarea className="input" rows={4} value={f.repair_terms_ar || ""} onChange={(e) => set("repair_terms_ar", e.target.value)} /></Field>
      <div className="sm:col-span-2"><button className="btn" onClick={save}><I n="save" /> حفظ</button></div>
    </div>
  );
}

function Branches() {
  const { sb, branches, reloadBranches } = useApp();
  const [m, setM] = useState<any>(null); const [err, setErr] = useState("");
  async function save() {
    setErr("");
    const payload = { name_ar: m.name_ar, address_ar: m.address_ar || null, phone: m.phone || null, is_active: !!m.is_active };
    const r = m.id ? await sb.from("branches").update(payload).eq("id", m.id) : await sb.from("branches").insert({ ...payload, code: m.code });
    if (r.error) { setErr(errMsg(r.error)); return; }
    setM(null); reloadBranches();
  }
  return (
    <div className="card">
      <table className="tbl"><thead><tr><th>الرمز</th><th>الاسم</th><th>العنوان</th><th>الهاتف</th><th>الحالة</th><th></th></tr></thead>
        <tbody>{branches.map((b) => <tr key={b.id}><td className="num">{b.code}</td><td>{b.name_ar}</td><td>{b.address_ar}</td><td className="num">{b.phone}</td><td>{b.is_active ? "فعّال" : "موقوف"}</td><td><button className="text-brand-600 underline" onClick={() => { setErr(""); setM(b); }}>تعديل</button></td></tr>)}</tbody></table>
      <p className="text-xs text-slate-500 mt-2">الفرعان B1 و B2 جاهزان. ينصح بتسمية الفرعين وإدخال عنوان وهاتف كل فرع ليظهرا في الفواتير.</p>
      {m && <Modal title="تعديل فرع" onClose={() => setM(null)}><div className="space-y-3"><Msg error={err} />
        <Field label="الاسم"><input className="input" value={m.name_ar} onChange={(e) => setM({ ...m, name_ar: e.target.value })} /></Field>
        <Field label="العنوان"><input className="input" value={m.address_ar || ""} onChange={(e) => setM({ ...m, address_ar: e.target.value })} /></Field>
        <Field label="الهاتف"><input className="input num" value={m.phone || ""} onChange={(e) => setM({ ...m, phone: e.target.value })} /></Field>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={m.is_active} onChange={(e) => setM({ ...m, is_active: e.target.checked })} /> فعّال</label>
        <button className="btn w-full" onClick={save}><I n="save" /> حفظ</button></div></Modal>}
    </div>
  );
}

function Users() {
  const { sb, branches, profile } = useApp();
  const [rows, setRows] = useState<any[]>([]);
  const [m, setM] = useState<any>(null); const [err, setErr] = useState(""); const [ok, setOk] = useState("");
  const load = useCallback(() => { sb.from("profiles").select("*").order("created_at").then(({ data }) => setRows((data as any) || [])); }, [sb]);
  useEffect(load, [load]);
  const needsBranch = m && ["branch_manager", "cashier", "technician"].includes(m.role);
  async function save() {
    setErr(""); setOk("");
    const res = await fetch("/api/admin/users", { method: m.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(m) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setErr(j.error || "فشلت العملية"); return; }
    setM(null); setOk("تم الحفظ"); load();
  }
  return (
    <div className="card">
      <div className="flex justify-between mb-3"><Msg error={!m ? err : ""} ok={ok} /><button className="btn" onClick={() => { setErr(""); setM({ email: "", password: "", full_name: "", role: "cashier", branch_id: branches[0]?.id || "" }); }}><I n="plus" /> مستخدم</button></div>
      <table className="tbl"><thead><tr><th>الاسم</th><th>البريد</th><th>الدور</th><th>الفرع</th><th>الحالة</th><th></th></tr></thead>
        <tbody>{rows.map((u) => <tr key={u.id}><td>{u.full_name}</td><td className="num">{u.email}</td><td>{ROLES[u.role]}</td><td>{branches.find((b) => b.id === u.branch_id)?.name_ar || "كل الفروع"}</td><td>{u.is_active ? <span className="badge badge-ok">فعّال</span> : <span className="badge badge-bad">معطّل</span>}</td>
          <td><button className="text-brand-600 underline" onClick={() => { setErr(""); setM({ id: u.id, full_name: u.full_name, role: u.role, branch_id: u.branch_id || "", is_active: u.is_active, password: "" }); }}>تعديل</button></td></tr>)}</tbody></table>
      {m && <Modal title={m.id ? "تعديل مستخدم" : "مستخدم جديد"} onClose={() => setM(null)}><div className="space-y-3"><Msg error={err} />
        {!m.id && <Field label="البريد الإلكتروني"><input className="input num" type="email" value={m.email} onChange={(e) => setM({ ...m, email: e.target.value })} /></Field>}
        <Field label="الاسم"><input className="input" value={m.full_name} onChange={(e) => setM({ ...m, full_name: e.target.value })} /></Field>
        <Field label={m.id ? "كلمة مرور جديدة (اتركها فارغة لعدم التغيير)" : "كلمة المرور (8 أحرف على الأقل)"}><input className="input num" type="text" value={m.password} onChange={(e) => setM({ ...m, password: e.target.value })} /></Field>
        <Field label="الدور"><select className="input" value={m.role} onChange={(e) => setM({ ...m, role: e.target.value })}>{Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label={needsBranch ? "الفرع (إجباري)" : "الفرع (اختياري — فارغ = كل الفروع)"}><select className="input" value={m.branch_id} onChange={(e) => setM({ ...m, branch_id: e.target.value })}>{!needsBranch && <option value="">كل الفروع</option>}{branches.map((b) => <option key={b.id} value={b.id}>{b.name_ar}</option>)}</select></Field>
        {m.id && m.id !== profile.id && <label className="flex gap-2 text-sm"><input type="checkbox" checked={m.is_active} onChange={(e) => setM({ ...m, is_active: e.target.checked })} /> الحساب فعّال</label>}
        <button className="btn w-full" onClick={save}><I n="save" /> حفظ</button>
        <p className="text-xs text-slate-500">يتطلب إنشاء المستخدمين ضبط SUPABASE_SERVICE_ROLE_KEY في إعدادات الاستضافة.</p></div></Modal>}
    </div>
  );
}

const BACKUP_TABLES = [
  "company_settings", "branches", "accounts", "product_categories", "products", "product_serials", "branch_stock", "contacts",
  "invoices", "invoice_lines", "payments", "payment_allocations", "expenses", "monthly_closings", "journal_entries", "journal_lines",
  "stock_movements", "stock_transfers", "repair_orders", "repair_parts", "repair_events",
];

function Backup() {
  const { sb } = useApp();
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [prog, setProg] = useState("");
  const [last, setLast] = useState(() => { try { return localStorage.getItem("last_backup") || ""; } catch { return ""; } });

  async function run() {
    setErr(""); setBusy(true);
    try {
      const out: Record<string, any[]> = {};
      for (const tb of BACKUP_TABLES) {
        setProg(tb);
        const rows: any[] = [];
        for (let from = 0; ; from += 1000) {
          const { data, error } = await sb.from(tb).select("*").order("created_at" as any, { ascending: true, nullsFirst: true }).range(from, from + 999);
          if (error) {
            // بعض الجداول بلا created_at: نعيد المحاولة بلا ترتيب
            let r2: any = await sb.from(tb).select("*").order("id" as any, { ascending: true }).range(from, from + 999);
            if (r2.error) r2 = await sb.from(tb).select("*").range(from, from + 999);
            if (r2.error) throw new Error(tb + ": " + r2.error.message);
            rows.push(...((r2.data as any[]) || [])); if (((r2.data as any[]) || []).length < 1000) break; continue;
          }
          rows.push(...((data as any[]) || [])); if (((data as any[]) || []).length < 1000) break;
        }
        out[tb] = rows;
      }
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
      const blob = new Blob([JSON.stringify({ app: "buroq-al-ain", exported_at: new Date().toISOString(), tables: out }, null, 1)], { type: "application/json" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `buroq-backup-${stamp}.json`; a.click();
      const msg = new Date().toLocaleString("en-GB"); setLast(msg);
      try { localStorage.setItem("last_backup", msg); } catch {}
      setProg("");
    } catch (e: any) { setErr(e?.message || "تعذر إنشاء النسخة"); }
    setBusy(false);
  }
  return (
    <div className="card space-y-3 max-w-2xl">
      <h3 className="font-extrabold text-brand-900 flex items-center gap-2"><I n="save" /> نسخة احتياطية من كل البيانات</h3>
      <p className="text-sm text-slate-600">تنزّل ملفاً واحداً يحتوي كل البيانات: المنتجات والمخزون والفواتير والسندات والمصروفات والقيود والصيانة والعملاء. احفظه خارج الجهاز (فلاشة أو Google Drive) ويُنصح بنسخة أسبوعياً على الأقل.</p>
      {err && <Msg error={err} />}
      <button className="btn" disabled={busy} onClick={run}><I n="upload" /> {busy ? `جاري النسخ… ${prog}` : "تنزيل نسخة احتياطية الآن"}</button>
      <div className="text-xs text-slate-500">{last ? `آخر نسخة من هذا المتصفح: ${last}` : "لم تُنزَّل أي نسخة من هذا المتصفح بعد."}</div>
      <div className="text-xs text-slate-500 border-t pt-2">النسخ التلقائي اليومي لقاعدة البيانات نفسها يتبع خطة Supabase المشترك فيها (راجع Project Settings ثم Database ثم Backups). هذا الملف نسخة إضافية بيدك.</div>
    </div>
  );
}
