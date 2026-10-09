"use client";
import { I } from "@/components/Icon";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LangToggle } from "@/lib/i18n";
import { getSupabase } from "@/lib/supabase/client";

export default function Login() {
  const sb = getSupabase();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [setup, setSetup] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [info, setInfo] = useState("");

  useEffect(() => {
    sb.rpc("needs_setup").then(({ data }) => setSetup(data === true));
  }, [sb]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(""); setInfo("");
    if (forgot) {
      await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
      setBusy(false);
      setInfo("إذا كان البريد مسجلاً لدينا فسيصلك رابط إعادة تعيين كلمة المرور. افتحه من نفس هذا المتصفح.");
      return;
    }
    const { error } = await sb.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) { setErr("البريد الإلكتروني أو كلمة المرور غير صحيحة"); return; }
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative bg-gradient-to-br from-brand-900 via-[#12315a] to-brand-600">
      <LangToggle className="absolute top-4 end-4" />
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gold-500 flex items-center justify-center text-3xl shadow mb-2"><I n="store" size={34} className="text-brand-900" /></div><div className="text-2xl font-extrabold text-brand-900">بروق العين للتجارة</div>
          <div className="text-sm text-gold-700">أهلاً بك، سجّل دخولك للمتابعة</div>
        </div>
        {err && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{err}</div>}
        {info && <div className="rounded-lg bg-green-50 text-green-700 text-sm px-3 py-2">{info}</div>}
        <div><label className="label">البريد الإلكتروني</label>
          <input className="input num" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" /></div>
        {!forgot && <div><label className="label">كلمة المرور</label>
          <input className="input num" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></div>}
        <button className="btn w-full" disabled={busy}>{busy ? "…" : forgot ? "إرسال رابط الاستعادة" : <><I n="key" /> دخول</>}</button>
        <button type="button" className="block w-full text-center text-sm text-brand-600 underline" onClick={() => { setForgot(!forgot); setErr(""); setInfo(""); }}>{forgot ? "العودة لتسجيل الدخول" : "نسيت كلمة المرور؟"}</button>
        {setup && <Link href="/setup" className="block text-center text-sm text-brand-600 underline">إعداد النظام لأول مرة (إنشاء المدير)</Link>}
      </form>
    </div>
  );
}
