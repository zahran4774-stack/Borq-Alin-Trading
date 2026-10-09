"use client";
import { I } from "@/components/Icon";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LangToggle } from "@/lib/i18n";
import { getSupabase } from "@/lib/supabase/client";

export default function Setup() {
  const sb = getSupabase();
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { sb.rpc("needs_setup").then(({ data }) => setAllowed(data === true)); }, [sb]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (f.password.length < 8) { setErr("كلمة المرور 8 أحرف على الأقل"); return; }
    setBusy(true); setErr("");
    const { data, error } = await sb.auth.signUp({ email: f.email, password: f.password, options: { data: { full_name: f.name } } });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    if (data.session) { router.replace("/settings"); router.refresh(); }
    else setInfo("تم إنشاء الحساب. إن كان تأكيد البريد مفعّلاً في Supabase فأكّده من الرسالة (أو عطّل Confirm email من لوحة Supabase) ثم سجّل الدخول.");
  }

  if (allowed === null) return <div className="min-h-screen flex items-center justify-center text-slate-500">…</div>;
  if (!allowed)
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card max-w-sm text-center">تم إعداد النظام مسبقاً. <a className="text-brand-600 underline" href="/login">تسجيل الدخول</a></div>
      </div>
    );
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative bg-gradient-to-br from-brand-900 via-[#12315a] to-brand-600">
      <LangToggle className="absolute top-4 end-4" />
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gold-500 flex items-center justify-center text-3xl shadow mb-2"><I n="rocket" size={34} className="text-brand-900" /></div><div className="text-xl font-extrabold text-brand-900">إعداد النظام لأول مرة</div>
          <div className="text-sm text-slate-500">أنشئ حساب مدير النظام</div>
        </div>
        {err && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{err}</div>}
        {info && <div className="rounded-lg bg-emerald-50 text-emerald-700 text-sm px-3 py-2">{info}</div>}
        <div><label className="label">الاسم</label><input className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div><label className="label">البريد الإلكتروني</label><input className="input num" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        <div><label className="label">كلمة المرور</label><input className="input num" type="password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
        <button className="btn w-full" disabled={busy}>{busy ? "…" : <><I n="sparkle" /> إنشاء المدير</>}</button>
      </form>
    </div>
  );
}
