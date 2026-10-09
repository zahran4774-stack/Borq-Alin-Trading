"use client";
import { I } from "@/components/Icon";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/lib/app-context";
import { errMsg, fdate, METHODS, money, monthStart, today } from "@/lib/format";
import { Empty, Field, Modal, Msg, NeedBranch, PageHeader, usePaged } from "@/components/ui";

export default function Expenses() {
  const { sb, opBranch, branchId, can, branches } = useApp();
  const canWrite = can("admin", "accountant", "branch_manager");
  const [rows, setRows] = useState<any[]>([]); const [accts, setAccts] = useState<any[]>([]);
  const pg = usePaged(rows, 50);
  const [from, setFrom] = useState(monthStart()); const [to, setTo] = useState(today());
  const [m, setM] = useState<any>(null); const [err, setErr] = useState("");

  const load = useCallback(async () => {
    let q = sb.from("expenses").select("*, accounts(name_ar,code)").gte("expense_date", from).lte("expense_date", to).order("expense_date", { ascending: false }).limit(500);
    if (branchId !== "all") q = q.eq("branch_id", branchId);
    const { data } = await q; setRows((data as any) || []);
  }, [sb, from, to, branchId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { sb.from("accounts").select("id,code,name_ar").eq("type", "expense").eq("is_group", false).eq("is_active", true).order("code").then(({ data }) => setAccts((data as any) || [])); }, [sb]);

  async function save() {
    setErr("");
    const { error } = await sb.rpc("create_expense", { p_branch: opBranch, p_account: m.account, p_date: m.date, p_amount: Number(m.amount), p_vat: Number(m.vat) || 0, p_method: m.method, p_payee: m.payee || null, p_memo: m.memo || null });
    if (error) { setErr(errMsg(error)); return; }
    setM(null); load();
  }
  const total = rows.filter((r) => !r.voided).reduce((s, r) => s + Number(r.amount), 0);
  return (
    <div>
      <PageHeader title="المصروفات">
        {canWrite && <button className="btn" onClick={() => { setErr(""); setM({ account: "", date: today(), amount: 0, vat: 0, method: "cash", payee: "", memo: "" }); }}><I n="plus" /> مصروف</button>}
      </PageHeader>
      {canWrite && !opBranch && <div className="mb-3"><NeedBranch /></div>}
      <div className="card mb-3 flex gap-3 items-end"><Field label="من"><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></Field><Field label="إلى"><input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></Field><div className="mr-auto text-sm">الإجمالي: <b className="num">{money(total)}</b></div></div>
      <div className="card overflow-x-auto">
        <table className="tbl"><thead><tr><th>الرقم</th><th>التاريخ</th><th>الحساب</th><th>المستفيد</th><th>البيان</th><th>الفرع</th><th>المبلغ</th><th>ضريبة</th><th></th></tr></thead>
          <tbody>{pg.rows.map((r) => (
            <tr key={r.id} className={r.voided ? "opacity-40 line-through" : ""}>
              <td className="num">{r.expense_no}</td><td>{fdate(r.expense_date)}</td><td>{r.accounts?.name_ar}</td><td>{r.payee}</td><td>{r.memo}</td>
              <td>{branches.find((b) => b.id === r.branch_id)?.name_ar}</td><td className="num">{money(r.amount)}</td><td className="num">{money(r.vat_amount)}</td>
              <td>{!r.voided && can("admin", "accountant") && <button className="text-red-600 text-xs underline" onClick={async () => {
                const x = prompt("سبب الإلغاء؟"); if (!x) return;
                const { error } = await sb.rpc("void_expense", { p_expense_id: r.id, p_reason: x });
                if (error) alert(errMsg(error)); else load();
              }}>إلغاء</button>}</td></tr>))}</tbody></table>{pg.bar}
        {!rows.length && <Empty />}
      </div>
      {m && (
        <Modal title="مصروف جديد" onClose={() => setM(null)}>
          <div className="space-y-3"><Msg error={err} />
            {!opBranch && <p className="text-red-600 text-sm">اختر فرعاً محدداً من أعلى الصفحة.</p>}
            <Field label="بند المصروف"><select className="input" value={m.account} onChange={(e) => setM({ ...m, account: e.target.value })}><option value="">—</option>{accts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name_ar}</option>)}</select></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="المبلغ (قبل الضريبة)"><input type="number" step="0.001" className="input num" value={m.amount} onChange={(e) => setM({ ...m, amount: e.target.value })} /></Field>
              <Field label="الضريبة"><input type="number" step="0.001" className="input num" value={m.vat} onChange={(e) => setM({ ...m, vat: e.target.value })} /></Field>
              <Field label="التاريخ"><input type="date" className="input" value={m.date} onChange={(e) => setM({ ...m, date: e.target.value })} /></Field>
              <Field label="الدفع"><select className="input" value={m.method} onChange={(e) => setM({ ...m, method: e.target.value })}>{Object.entries(METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            </div>
            <Field label="المستفيد"><input className="input" value={m.payee} onChange={(e) => setM({ ...m, payee: e.target.value })} /></Field>
            <Field label="البيان"><input className="input" value={m.memo} onChange={(e) => setM({ ...m, memo: e.target.value })} /></Field>
            <button className="btn w-full" disabled={!opBranch || !m.account} onClick={save}><I n="save" /> حفظ</button></div>
        </Modal>
      )}
    </div>
  );
}
