"use client";
import { useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { useApp } from "@/lib/app-context";
import { errMsg } from "@/lib/format";
import { Field, Modal, Msg } from "@/components/ui";

export function ChangePasswordForm({ onDone }: { onDone?: () => void }) {
  const sb = getSupabase();
  const { profile } = useApp();
  const [cur, setCur] = useState(""); const [p1, setP1] = useState(""); const [p2, setP2] = useState("");
  const [err, setErr] = useState(""); const [ok, setOk] = useState(""); const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setOk("");
    if (p1.length < 8 || p1.length > 72) return setErr("كلمة المرور الجديدة يجب أن تكون بين 8 و72 حرفاً");
    if (p1 !== p2) return setErr("تأكيد كلمة المرور غير مطابق");
    if (p1 === cur) return setErr("كلمة المرور الجديدة مطابقة للحالية");
    setBusy(true);
    const chk = await sb.auth.signInWithPassword({ email: profile.email || "", password: cur });
    if (chk.error) { setBusy(false); return setErr("كلمة المرور الحالية غير صحيحة"); }
    const { error } = await sb.auth.updateUser({ password: p1 });
    setBusy(false);
    if (error) return setErr(errMsg(error));
    setCur(""); setP1(""); setP2(""); setOk("تم تغيير كلمة المرور بنجاح");
    onDone?.();
  }

  return (
    <form onSubmit={save} className="space-y-3 max-w-sm">
      {err && <Msg error={err} />}{ok && <Msg ok={ok} />}
      <Field label="كلمة المرور الحالية"><input className="input num" type="password" required autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} /></Field>
      <Field label="كلمة المرور الجديدة (8 أحرف على الأقل)"><input className="input num" type="password" required minLength={8} maxLength={72} autoComplete="new-password" value={p1} onChange={(e) => setP1(e.target.value)} /></Field>
      <Field label="تأكيد كلمة المرور الجديدة"><input className="input num" type="password" required autoComplete="new-password" value={p2} onChange={(e) => setP2(e.target.value)} /></Field>
      <button className="btn" disabled={busy}>{busy ? "…" : "حفظ"}</button>
    </form>
  );
}

export function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  return <Modal title="تغيير كلمة المرور" onClose={onClose}><ChangePasswordForm /></Modal>;
}
