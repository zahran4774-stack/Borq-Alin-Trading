"use client";
import { I } from "@/components/Icon";
import { useEffect, useState } from "react";
import Link from "next/link";
import { LangToggle } from "@/lib/i18n";
import { getSupabase } from "@/lib/supabase/client";
import { errMsg } from "@/lib/format";

export default function ResetPassword() {
  const sb = getSupabase();
  const [ready, setReady] = useState(false);
  const [p1, setP1] = useState(""); const [p2, setP2] = useState("");
  const [err, setErr] = useState(""); const [done, setDone] = useState(false); const [busy, setBusy] = useState(false);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const { data: sub } = sb.auth.onAuthStateChange((ev, s) => { if (ev === "PASSWORD_RECOVERY" || (ev === "SIGNED_IN" && s)) setReady(true); });
    const t = setTimeout(async () => {
      const { data } = await sb.auth.getSession();
      if (data.session) setReady(true); else setExpired(true);
    }, 2500);
    return () => { sub.subscription.unsubscribe(); clearTimeout(t); };
  }, [sb]);

  async function save(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    if (p1.length < 8 || p1.length > 72) return setErr("كلمة المرور يجب أن تكون بين 8 و72 حرفاً");
    if (p1 !== p2) return setErr("تأكيد كلمة المرور غير مطابق");
    setBusy(true);
    const { error } = await sb.auth.updateUser({ password: p1 });
    if (error) { setBusy(false); return setErr(errMsg(error)); }
    await sb.auth.signOut();
    setBusy(false); setDone(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative bg-gradient-to-br from-brand-900 via-[#12315a] to-brand-600">
      <LangToggle className="absolute top-4 end-4" />
      <form onSubmit={save} className="card w-full max-w-sm space-y-4">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gold-500 flex items-center justify-center shadow mb-2"><I n="key" size={34} className="text-brand-900" /></div>
          <div className="text-xl font-extrabold text-brand-900">تعيين كلمة مرور جديدة</div>
        </div>
        {done ? (
          <>
            <div className="rounded-lg bg-green-50 text-green-700 text-sm px-3 py-2">تم تغيير كلمة المرور. سجّل دخولك بالجديدة.</div>
            <Link href="/login" className="btn w-full block text-center">تسجيل الدخول</Link>
          </>
        ) : ready ? (
          <>
            {err && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{err}</div>}
            <div><label className="label">كلمة المرور الجديدة (8 أحرف على الأقل)</label>
              <input className="input num" type="password" required minLength={8} maxLength={72} autoComplete="new-password" value={p1} onChange={(e) => setP1(e.target.value)} /></div>
            <div><label className="label">تأكيد كلمة المرور</label>
              <input className="input num" type="password" required autoComplete="new-password" value={p2} onChange={(e) => setP2(e.target.value)} /></div>
            <button className="btn w-full" disabled={busy}>{busy ? "…" : "حفظ"}</button>
          </>
        ) : expired ? (
          <>
            <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">الرابط غير صالح أو منتهي. افتح الرابط من نفس المتصفح الذي طلبت منه الاستعادة، أو اطلب رابطاً جديداً.</div>
            <Link href="/login" className="block text-center text-sm text-brand-600 underline">العودة لتسجيل الدخول</Link>
          </>
        ) : <div className="text-center text-sm text-slate-500">جارٍ التحقق من الرابط…</div>}
      </form>
    </div>
  );
}
