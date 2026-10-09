"use client";
import { I } from "@/components/Icon";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/lib/app-context";
import { errMsg, fdt, money, today } from "@/lib/format";
import type { Product } from "@/lib/types";
import { Empty, Field, Msg, PageHeader, usePaged } from "@/components/ui";

const MT: Record<string, string> = {
  purchase_in: "شراء", sale_out: "بيع", adjustment_in: "تسوية (زيادة)", adjustment_out: "تسوية (نقص)", opening_balance: "رصيد افتتاحي",
  transfer_out: "تحويل صادر", transfer_in: "تحويل وارد", sale_return_in: "مرتجع بيع", purchase_return_out: "مرتجع شراء",
};

export default function Stock() {
  const { sb, branches, branchId, can, opBranch } = useApp();
  const canWrite = can("admin", "accountant", "branch_manager");
  const [tab, setTab] = useState<"bal" | "transfer" | "adjust" | "moves">("bal");
  const [products, setProducts] = useState<Product[]>([]);
  useEffect(() => { sb.from("products").select("*").eq("is_active", true).eq("is_service", false).order("name_ar").limit(5000).then(({ data }) => setProducts((data as any) || [])); }, [sb]);

  return (
    <div>
      <PageHeader title="المخزون والتحويلات" />
      <div className="flex gap-2 mb-3 no-print flex-wrap">
        {[["bal", "الأرصدة"], ["transfer", "تحويل بين الفروع"], ["adjust", "رصيد افتتاحي / تسوية"], ["moves", "حركة المخزون"]].map(([k, v]) => (
          <button key={k} className={`btn ${tab === k ? "" : "btn-sec"}`} onClick={() => setTab(k as any)}>{v}</button>
        ))}
      </div>
      {tab === "bal" && <Balances products={products} />}
      {tab === "transfer" && <Transfer products={products} canWrite={canWrite} />}
      {tab === "adjust" && <Adjust products={products} canWrite={canWrite} />}
      {tab === "moves" && <Moves products={products} />}
    </div>
  );
}

function Balances({ products }: { products: Product[] }) {
  const { sb, branches, branchId, can } = useApp();
  const [st, setSt] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [low, setLow] = useState(false);
  useEffect(() => { sb.from("branch_stock").select("*").limit(20000).then(({ data }) => setSt((data as any) || [])); }, [sb]);
  const showBranches = branchId === "all" ? branches : branches.filter((b) => b.id === branchId);
  const qty = (pid: string, bid: string) => Number(st.find((s) => s.product_id === pid && s.branch_id === bid)?.quantity || 0);
  const showCost = can("admin", "accountant", "branch_manager", "viewer");
  let value = 0;
  const rows = products.filter((p) => !q || p.name_ar.includes(q) || p.barcode?.includes(q) || p.sku?.includes(q)).map((p) => {
    const tot = showBranches.reduce((s, b) => s + qty(p.id, b.id), 0);
    value += tot * Number(p.cost_price);
    return { p, tot };
  }).filter((r) => !low || r.tot <= Number(r.p.reorder_level));
  const pgB = usePaged(rows, 50);
  return (
    <div className="card overflow-x-auto">
      <div className="flex gap-3 mb-3 flex-wrap items-center">
        <input className="input !w-64" placeholder="بحث" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="text-sm flex items-center gap-1"><input type="checkbox" checked={low} onChange={(e) => setLow(e.target.checked)} /> النواقص فقط</label>
        {showCost && <span className="text-sm mr-auto">قيمة المخزون (بالتكلفة): <b className="num">{money(value)}</b></span>}
      </div>
      <table className="tbl">
        <thead><tr><th>المنتج</th>{showBranches.map((b) => <th key={b.id}>{b.name_ar}</th>)}<th>الإجمالي</th>{showCost && <th>متوسط التكلفة</th>}</tr></thead>
        <tbody>{pgB.rows.map(({ p, tot }) => (
          <tr key={p.id}><td>{p.name_ar}</td>{showBranches.map((b) => <td key={b.id} className="num">{qty(p.id, b.id)}</td>)}
            <td className={`num font-bold ${tot <= Number(p.reorder_level) ? "text-red-600" : ""}`}>{tot}</td>{showCost && <td className="num">{money(p.cost_price)}</td>}</tr>
        ))}</tbody>
      </table>{pgB.bar}
      {!rows.length && <Empty />}
    </div>
  );
}

function Transfer({ products, canWrite }: { products: Product[]; canWrite: boolean }) {
  const { sb, branches, opBranch } = useApp();
  const [from, setFrom] = useState(opBranch || branches[0]?.id || "");
  const [to, setTo] = useState("");
  const [pid, setPid] = useState("");
  const [qty, setQty] = useState(1);
  const [serials, setSerials] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState(""); const [ok, setOk] = useState("");
  const [hist, setHist] = useState<any[]>([]);
  const pgH = usePaged(hist);
  const p = products.find((x) => x.id === pid);
  const load = useCallback(() => { sb.from("stock_transfers").select("*, products(name_ar)").order("created_at", { ascending: false }).limit(100).then(({ data }) => setHist((data as any) || [])); }, [sb]);
  useEffect(load, [load]);
  async function go() {
    setErr(""); setOk("");
    const sl = serials.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
    const { error } = await sb.rpc("transfer_stock", { p_from: from, p_to: to, p_product: pid, p_qty: p?.track_serial ? sl.length : qty, p_serials: p?.track_serial ? sl : null, p_note: note || null });
    if (error) { setErr(errMsg(error)); return; }
    setOk("تم التحويل"); setSerials(""); setNote(""); load();
  }
  const bn = (id: string) => branches.find((b) => b.id === id)?.name_ar;
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="card space-y-3">
        <Msg error={err} ok={ok} />
        {!canWrite && <p className="text-amber-600 text-sm">ليس لديك صلاحية التحويل.</p>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="من فرع"><select className="input" value={from} onChange={(e) => setFrom(e.target.value)}>{branches.map((b) => <option key={b.id} value={b.id}>{b.name_ar}</option>)}</select></Field>
          <Field label="إلى فرع"><select className="input" value={to} onChange={(e) => setTo(e.target.value)}><option value="">—</option>{branches.filter((b) => b.id !== from).map((b) => <option key={b.id} value={b.id}>{b.name_ar}</option>)}</select></Field>
        </div>
        <Field label="المنتج"><select className="input" value={pid} onChange={(e) => setPid(e.target.value)}><option value="">—</option>{products.map((x) => <option key={x.id} value={x.id}>{x.name_ar}</option>)}</select></Field>
        {p?.track_serial ? <Field label="الأرقام التسلسلية (IMEI) المراد تحويلها"><textarea className="input num" rows={3} value={serials} onChange={(e) => setSerials(e.target.value)} /></Field>
          : <Field label="الكمية"><input type="number" min={1} step="any" className="input num" value={qty} onChange={(e) => setQty(Number(e.target.value))} /></Field>}
        <Field label="ملاحظة"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <button className="btn w-full" disabled={!canWrite || !from || !to || !pid} onClick={go}>تنفيذ التحويل</button>
        <p className="text-xs text-slate-500">التحويل فوري، ويُنقل بنفس متوسط تكلفة الفرع المرسل.</p>
      </div>
      <div className="card overflow-x-auto">
        <h3 className="font-semibold mb-2">آخر التحويلات</h3>
        <table className="tbl"><thead><tr><th>الرقم</th><th>التاريخ</th><th>المنتج</th><th>الكمية</th><th>من → إلى</th></tr></thead>
          <tbody>{pgH.rows.map((h) => <tr key={h.id}><td className="num">{h.transfer_no}</td><td>{fdt(h.created_at)}</td><td>{h.products?.name_ar}</td><td className="num">{Number(h.quantity)}</td><td>{bn(h.from_branch_id)} ← {bn(h.to_branch_id)}</td></tr>)}</tbody></table>{pgH.bar}
        {!hist.length && <Empty />}
      </div>
    </div>
  );
}

function Adjust({ products, canWrite }: { products: Product[]; canWrite: boolean }) {
  const { sb, opBranch, can } = useApp();
  const [kind, setKind] = useState("opening");
  const [pid, setPid] = useState(""); const [qty, setQty] = useState(1); const [cost, setCost] = useState(0);
  const [date, setDate] = useState(today()); const [note, setNote] = useState(""); const [serials, setSerials] = useState("");
  const [err, setErr] = useState(""); const [ok, setOk] = useState("");
  const p = products.find((x) => x.id === pid);
  const allowed = canWrite && can("admin", "accountant", "branch_manager");
  if (!opBranch) return <div className="card text-slate-600">اختر فرعاً محدداً من أعلى الصفحة لإجراء التسوية.</div>;
  async function go() {
    setErr(""); setOk("");
    const sl = serials.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
    const { error } = await sb.rpc("adjust_stock", { p_branch: opBranch, p_product: pid, p_kind: kind, p_qty: p?.track_serial ? sl.length : qty, p_unit_cost: kind === "loss" ? null : cost, p_date: date, p_note: note || null, p_serials: p?.track_serial ? sl : null });
    if (error) { setErr(errMsg(error)); return; }
    setOk("تم تسجيل التسوية"); setSerials(""); setNote("");
  }
  return (
    <div className="card max-w-xl space-y-3">
      <Msg error={err} ok={ok} />
      <Field label="النوع"><select className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
        <option value="opening">رصيد افتتاحي</option><option value="gain">زيادة (جرد)</option><option value="loss">نقص / تالف (جرد)</option></select></Field>
      <Field label="المنتج"><select className="input" value={pid} onChange={(e) => { setPid(e.target.value); setCost(Number(products.find((x) => x.id === e.target.value)?.cost_price || 0)); }}><option value="">—</option>{products.map((x) => <option key={x.id} value={x.id}>{x.name_ar}</option>)}</select></Field>
      {p?.track_serial ? <Field label="الأرقام التسلسلية"><textarea className="input num" rows={3} value={serials} onChange={(e) => setSerials(e.target.value)} /></Field>
        : <Field label="الكمية"><input type="number" min={0} step="any" className="input num" value={qty} onChange={(e) => setQty(Number(e.target.value))} /></Field>}
      {kind !== "loss" && <Field label="تكلفة الوحدة (قبل الضريبة)"><input type="number" step="0.001" className="input num" value={cost} onChange={(e) => setCost(Number(e.target.value))} /></Field>}
      <Field label="التاريخ"><input type="date" lang="en-GB" dir="ltr" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <Field label="ملاحظة"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      <button className="btn w-full" disabled={!allowed || !pid} onClick={go}><I n="save" /> حفظ</button>
      <p className="text-xs text-slate-500">الرصيد الافتتاحي يقيَّد مقابل حساب حقوق الملكية/الافتتاحي، وفروقات الجرد تُقيَّد في حساب فروقات المخزون.</p>
    </div>
  );
}

function Moves({ products }: { products: Product[] }) {
  const { sb, branches, branchId } = useApp();
  const [rows, setRows] = useState<any[]>([]);
  const [pid, setPid] = useState("");
  useEffect(() => {
    let q = sb.from("stock_movements").select("*, products(name_ar)").order("created_at", { ascending: false }).limit(300);
    if (branchId !== "all") q = q.eq("branch_id", branchId);
    if (pid) q = q.eq("product_id", pid);
    q.then(({ data }) => setRows((data as any) || []));
  }, [sb, branchId, pid]);
  const pgM = usePaged(rows, 50);
  return (
    <div className="card overflow-x-auto">
      <select className="input !w-64 mb-3" value={pid} onChange={(e) => setPid(e.target.value)}><option value="">كل المنتجات</option>{products.map((x) => <option key={x.id} value={x.id}>{x.name_ar}</option>)}</select>
      <table className="tbl"><thead><tr><th>التاريخ</th><th>المنتج</th><th>النوع</th><th>الفرع</th><th>الكمية</th><th>التكلفة</th></tr></thead>
        <tbody>{pgM.rows.map((r) => <tr key={r.id}><td>{fdt(r.created_at)}</td><td>{r.products?.name_ar}</td><td>{MT[r.type]}</td><td>{branches.find((b) => b.id === r.branch_id)?.name_ar}</td><td className="num">{Number(r.quantity)}</td><td className="num">{money(r.unit_cost)}</td></tr>)}</tbody></table>{pgM.bar}
      {!rows.length && <Empty />}
    </div>
  );
}
