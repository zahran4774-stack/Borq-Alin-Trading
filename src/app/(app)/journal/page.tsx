"use client";
import { I } from "@/components/Icon";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/lib/app-context";
import { errMsg, fdate, money, monthStart, today, r3 } from "@/lib/format";
import { Empty, Modal, Msg, NeedBranch, PageHeader, usePaged } from "@/components/ui";

export default function Journal() {
  const { sb, branchId, opBranch, branches, can } = useApp();
  const [rows, setRows] = useState<any[]>([]);
  const pg = usePaged(rows, 50);
  const [from, setFrom] = useState(monthStart()); const [to, setTo] = useState(today());
  const [open, setOpen] = useState<string | null>(null);
  const [lines, setLines] = useState<any[]>([]);
  const [accts, setAccts] = useState<any[]>([]);
  const [m, setM] = useState<any>(null); const [err, setErr] = useState("");

  const load = useCallback(async () => {
    let q = sb.from("journal_entries").select("*").gte("entry_date", from).lte("entry_date", to).order("entry_date", { ascending: false }).order("created_at", { ascending: false }).limit(500);
    if (branchId !== "all") q = q.eq("branch_id", branchId);
    const { data } = await q; setRows((data as any) || []);
  }, [sb, from, to, branchId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { sb.from("accounts").select("id,code,name_ar").eq("is_group", false).eq("is_active", true).order("code").then(({ data }) => setAccts((data as any) || [])); }, [sb]);
  async function toggle(id: string) {
    if (open === id) { setOpen(null); return; }
    const { data } = await sb.from("journal_lines").select("*, accounts(code,name_ar)").eq("journal_entry_id", id);
    setLines((data as any) || []); setOpen(id);
  }
  const td = m ? r3(m.lines.reduce((s: number, l: any) => s + Number(l.debit || 0), 0)) : 0;
  const tc = m ? r3(m.lines.reduce((s: number, l: any) => s + Number(l.credit || 0), 0)) : 0;
  async function save() {
    setErr("");
    const { error } = await sb.rpc("create_manual_journal", { p_branch: opBranch, p_date: m.date, p_memo: m.memo, p_lines: m.lines.filter((l: any) => l.account_id).map((l: any) => ({ account_id: l.account_id, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0, memo: l.memo || null })) });
    if (error) { setErr(errMsg(error)); return; }
    setM(null); load();
  }
  return (
    <div>
      <PageHeader title="القيود اليومية">
        {can("admin", "accountant") && <button className="btn" onClick={() => { setErr(""); setM({ date: today(), memo: "", lines: [{ account_id: "", debit: 0, credit: 0 }, { account_id: "", debit: 0, credit: 0 }] }); }}><I n="plus" /> قيد يدوي</button>}
      </PageHeader>
      <div className="card mb-3 flex gap-3 items-end"><div><label className="label">من</label><input type="date" lang="en-GB" dir="ltr" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></div><div><label className="label">إلى</label><input type="date" lang="en-GB" dir="ltr" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></div></div>
      <div className="card overflow-x-auto">
        <table className="tbl"><thead><tr><th>التاريخ</th><th>المرجع</th><th>البيان</th><th>الفرع</th><th>المصدر</th><th></th></tr></thead>
          <tbody>{pg.rows.map((r) => (<>
            <tr key={r.id} className={`cursor-pointer ${r.is_reversed ? "opacity-50" : ""}`} onClick={() => toggle(r.id)}>
              <td>{fdate(r.entry_date)}</td><td className="num">{r.reference}</td><td>{r.memo_ar}</td><td>{branches.find((b) => b.id === r.branch_id)?.name_ar}</td><td>{r.source_type}</td>
              <td>{r.source_type === "manual" && !r.is_reversed && can("admin", "accountant") && <button className="text-red-600 text-xs underline" onClick={async (e) => { e.stopPropagation(); const x = prompt("سبب العكس؟"); if (!x) return; const { error } = await sb.rpc("reverse_manual_journal", { p_entry: r.id, p_reason: x }); if (error) alert(errMsg(error)); else load(); }}>عكس</button>}</td></tr>
            {open === r.id && <tr key={r.id + "l"}><td colSpan={6} className="bg-slate-50"><table className="tbl"><tbody>{lines.map((l) => <tr key={l.id}><td className="num">{l.accounts?.code}</td><td>{l.accounts?.name_ar}</td><td>{l.memo}</td><td className="num">{Number(l.debit) ? money(l.debit) : ""}</td><td className="num">{Number(l.credit) ? money(l.credit) : ""}</td></tr>)}</tbody></table>{pg.bar}</td></tr>}
          </>))}</tbody></table>
        {!rows.length && <Empty />}
      </div>
      {m && (!opBranch ? <Modal title="قيد يدوي" onClose={() => setM(null)}><NeedBranch /></Modal> :
        <Modal title="قيد يومية يدوي" onClose={() => setM(null)} wide>
          <div className="space-y-3"><Msg error={err} />
            <div className="grid grid-cols-3 gap-3"><div><label className="label">التاريخ</label><input type="date" lang="en-GB" dir="ltr" className="input" value={m.date} onChange={(e) => setM({ ...m, date: e.target.value })} /></div><div className="col-span-2"><label className="label">البيان</label><input className="input" value={m.memo} onChange={(e) => setM({ ...m, memo: e.target.value })} /></div></div>
            <table className="tbl"><thead><tr><th>الحساب</th><th>مدين</th><th>دائن</th><th>بيان</th></tr></thead>
              <tbody>{m.lines.map((l: any, i: number) => { const set = (p: any) => setM({ ...m, lines: m.lines.map((x: any, j: number) => (j === i ? { ...x, ...p } : x)) }); return (
                <tr key={i}><td><select className="input" value={l.account_id} onChange={(e) => set({ account_id: e.target.value })}><option value="">—</option>{accts.map((a) => <option key={a.id} value={a.id}>{a.code} {a.name_ar}</option>)}</select></td>
                  <td><input type="number" step="0.001" className="input num" value={l.debit} onChange={(e) => set({ debit: e.target.value, credit: 0 })} /></td>
                  <td><input type="number" step="0.001" className="input num" value={l.credit} onChange={(e) => set({ credit: e.target.value, debit: 0 })} /></td>
                  <td><input className="input" value={l.memo || ""} onChange={(e) => set({ memo: e.target.value })} /></td></tr>); })}</tbody></table>
            <button className="btn btn-sec btn-sm" onClick={() => setM({ ...m, lines: [...m.lines, { account_id: "", debit: 0, credit: 0 }] })}><I n="plus" /> سطر</button>
            <div className={`text-sm ${td === tc && td > 0 ? "text-emerald-700" : "text-red-600"}`}>مدين {money(td)} / دائن {money(tc)}</div>
            <button className="btn w-full" disabled={td !== tc || td === 0} onClick={save}>ترحيل القيد</button></div>
        </Modal>)}
    </div>
  );
}
