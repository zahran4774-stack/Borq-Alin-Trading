"use client";
import { I } from "@/components/Icon";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/app-context";
import { errMsg, METHODS, money, r3, today } from "@/lib/format";
import type { Contact, Product } from "@/lib/types";
import { Modal } from "@/components/ui";

// نافذة إدخال مشتريات سريعة لمنتج غير متوفر في الفرع — حتى تبقى المحاسبة والمخزون سليمين (لا بيع بالسالب)
export default function QuickPurchase({ product, needQty, onClose, onDone, branchId }: {
  product: Product; needQty: number; onClose: () => void; onDone: () => void; branchId?: string;
}) {
  const { sb, opBranch: ctxBranch, company, can } = useApp();
  const opBranch = branchId || ctxBranch;
  const canBuy = can("admin", "accountant", "branch_manager");
  const [suppliers, setSuppliers] = useState<Contact[]>([]);
  const [supplier, setSupplier] = useState(""); const [newName, setNewName] = useState("");
  const [qty, setQty] = useState(String(Math.max(1, Math.ceil(needQty))));
  const [cost, setCost] = useState(product.cost_price ? String(product.cost_price) : "");
  const [rate, setRate] = useState(String(product.tax_rate ?? company.default_vat_rate));
  const [invNo, setInvNo] = useState(""); const [pay, setPay] = useState("cash");
  const [serials, setSerials] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);

  useEffect(() => {
    sb.from("contacts").select("*").eq("is_active", true).in("type", ["supplier", "both"]).order("name_ar").limit(2000)
      .then(({ data }) => setSuppliers((data as any) || []));
  }, [sb]);

  const serialList = serials.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
  const q = product.track_serial ? serialList.length : Number(qty);
  const c = Number(cost); const rt = Number(rate) || 0;
  const base = r3((q || 0) * (c || 0)); const total = r3(base + base * rt / 100);

  async function save() {
    setErr("");
    if (!opBranch) return;
    if (!Number.isFinite(q) || q <= 0) { setErr(product.track_serial ? "أدخل الأرقام التسلسلية/IMEI (واحد في كل سطر)" : "الكمية غير صحيحة"); return; }
    if (!Number.isFinite(c) || c <= 0) { setErr("أدخل تكلفة الشراء للوحدة (أكبر من صفر)"); return; }
    if (!supplier && !newName.trim()) { setErr("اختر المورد أو اكتب اسم مورد جديد"); return; }
    setBusy(true);
    let sid = supplier;
    if (!sid) {
      const { data, error } = await sb.from("contacts").insert({ name_ar: newName.trim(), type: "supplier", credit_limit: 0, is_active: true }).select("id").single();
      if (error) { setBusy(false); setErr(errMsg(error)); return; }
      sid = (data as any).id;
    }
    const { error } = await sb.rpc("create_purchase_invoice", {
      p_branch_id: opBranch, p_contact_id: sid, p_supplier_invoice_no: invNo || null, p_invoice_date: today(), p_due_date: null,
      p_lines: [{ product_id: product.id, quantity: q, unit_price: c, tax_rate: rt, serials: product.track_serial ? serialList : undefined }],
      p_payments: pay === "credit" ? [] : [{ method: pay, amount: total }],
      p_notes: "مشتريات سريعة",
    });
    setBusy(false);
    if (error) { setErr(errMsg(error)); return; }
    onDone();
  }

  return (
    <Modal title="المنتج غير متوفر — أدخل المشتريات أولاً" onClose={onClose}>
      <div className="space-y-3">
        <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm px-3 py-2 flex gap-2">
          <I n="alert" className="mt-0.5" />
          <div>المنتج <b>{product.name_ar}</b> غير متوفر في هذا الفرع. لا يمكن بيع منتج لم تُسجَّل مشترياته، حتى تبقى المحاسبة والمخزون صحيحين.</div>
        </div>
        {!canBuy ? (
          <div className="text-sm text-slate-700">صلاحيتك لا تسمح بتسجيل المشتريات. اطلب من مدير الفرع أو المحاسب إدخال مشتريات هذا المنتج، ثم أعد المحاولة.</div>
        ) : (
          <>
            {err && <div className="rounded-xl px-3 py-2 text-sm bg-red-50 text-red-700 border border-red-200">{err}</div>}
            <div className="grid sm:grid-cols-2 gap-3">
              <div><label className="label">المورد *</label>
                <select className="input" value={supplier} onChange={(e) => setSupplier(e.target.value)}>
                  <option value="">— مورد جديد —</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name_ar}</option>)}
                </select></div>
              {!supplier && <div><label className="label">اسم المورد الجديد *</label><input className="input" maxLength={120} value={newName} onChange={(e) => setNewName(e.target.value)} /></div>}
              <div><label className="label">رقم فاتورة المورد</label><input className="input" maxLength={60} value={invNo} onChange={(e) => setInvNo(e.target.value)} /></div>
              {!product.track_serial && <div><label className="label">الكمية *</label><input className="input num" type="number" min="0" step="any" value={qty} onChange={(e) => setQty(e.target.value)} /></div>}
              <div><label className="label">تكلفة الوحدة (بدون ضريبة) *</label><input className="input num" type="number" min="0" step="0.001" value={cost} onChange={(e) => setCost(e.target.value)} /></div>
              <div><label className="label">الضريبة %</label><input className="input num" type="number" min="0" step="any" value={rate} onChange={(e) => setRate(e.target.value)} /></div>
              <div><label className="label">طريقة الدفع</label>
                <select className="input" value={pay} onChange={(e) => setPay(e.target.value)}>
                  {Object.entries(METHODS).filter(([k]) => k !== "other").map(([k, t]) => <option key={k} value={k}>{t}</option>)}
                  <option value="credit">آجل (دين على المورد)</option>
                </select></div>
            </div>
            {product.track_serial && (
              <div><label className="label">الأرقام التسلسلية / IMEI * <span className="text-xs text-slate-500">(واحد في كل سطر — العدد: {serialList.length})</span></label>
                <textarea className="input num" rows={4} value={serials} onChange={(e) => setSerials(e.target.value)} /></div>
            )}
            <div className="flex items-center justify-between text-sm bg-gold-50 rounded-xl px-3 py-2"><span>الإجمالي شامل الضريبة</span><b className="num">{money(total)} ر.ع</b></div>
            <button className="btn w-full" disabled={busy} onClick={save}><I n="save" /> {busy ? "جاري الحفظ…" : "حفظ المشتريات والمتابعة"}</button>
          </>
        )}
      </div>
    </Modal>
  );
}
