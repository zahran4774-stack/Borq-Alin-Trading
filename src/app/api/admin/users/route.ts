import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const store = cookies();
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll: () => store.getAll(), setAll: () => {} },
  });
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return null;
  const { data: p } = await sb.from("profiles").select("role,is_active").eq("id", u.user.id).maybeSingle();
  return p && (p as any).role === "admin" && (p as any).is_active ? u.user : null;
}

function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

// حماية CSRF: نقبل الطلبات من نفس الأصل فقط، ونشترط JSON
function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (!origin || !host) return false;
  try { return new URL(origin).host === host; } catch { return false; }
}
function guard(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "طلب مرفوض" }, { status: 403 });
  if (!(req.headers.get("content-type") || "").includes("application/json")) return NextResponse.json({ error: "نوع الطلب غير مدعوم" }, { status: 415 });
  return null;
}
const bad = (msg: string, s = 400) => NextResponse.json({ error: msg }, { status: s });

const ROLES = ["admin", "accountant", "viewer", "branch_manager", "cashier", "technician"];

export async function POST(req: Request) {
  const g = guard(req); if (g) return g;
  if (!(await requireAdmin())) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  const svc = admin();
  if (!svc) return NextResponse.json({ error: "لم يتم ضبط SUPABASE_SERVICE_ROLE_KEY على الخادم" }, { status: 500 });
  const b = await req.json().catch(() => null);
  if (!b?.email || !b?.password || !b?.full_name || !ROLES.includes(b.role)) return NextResponse.json({ error: "بيانات غير مكتملة" }, { status: 400 });
  if (typeof b.email !== "string" || !EMAIL.test(b.email.trim()) || typeof b.full_name !== "string" || b.full_name.length > 120) return bad("بيانات غير صحيحة");
  if (typeof b.password !== "string" || b.password.length < 8 || b.password.length > 72) return bad("كلمة المرور بين 8 و72 حرفاً");
  if (b.branch_id && !UUID.test(String(b.branch_id))) return bad("فرع غير صحيح");
  b.email = b.email.trim().toLowerCase();
  const needsBranch = ["branch_manager", "cashier", "technician"].includes(b.role);
  if (needsBranch && !b.branch_id) return NextResponse.json({ error: "هذا الدور يتطلب تحديد فرع" }, { status: 400 });

  const { data, error } = await svc.auth.admin.createUser({
    email: b.email, password: b.password, email_confirm: true,
    user_metadata: { full_name: b.full_name }, app_metadata: { provisioned: "true" },
  });
  if (error || !data.user) return bad("تعذر إنشاء المستخدم (قد يكون البريد مستخدماً)");
  const { error: e2 } = await svc.from("profiles").update({
    full_name: b.full_name, role: b.role, branch_id: needsBranch ? b.branch_id : b.branch_id || null, is_active: true, email: b.email,
  }).eq("id", data.user.id);
  if (e2) return bad("تم إنشاء الحساب لكن تعذر ضبط الدور", 500);
  return NextResponse.json({ ok: true, id: data.user.id });
}

export async function PATCH(req: Request) {
  const g = guard(req); if (g) return g;
  const me = await requireAdmin();
  if (!me) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  const svc = admin();
  if (!svc) return NextResponse.json({ error: "لم يتم ضبط SUPABASE_SERVICE_ROLE_KEY على الخادم" }, { status: 500 });
  const b = await req.json().catch(() => null);
  if (!b?.id || !UUID.test(String(b.id))) return bad("معرّف غير صحيح");
  if (b.branch_id && !UUID.test(String(b.branch_id))) return bad("فرع غير صحيح");
  if (b.full_name && (typeof b.full_name !== "string" || b.full_name.length > 120)) return bad("اسم غير صحيح");
  if (b.id === me.id && (b.is_active === false || (b.role && b.role !== "admin")))
    return NextResponse.json({ error: "لا يمكنك تعطيل نفسك أو إزالة صلاحية المدير عن حسابك" }, { status: 400 });
  if (b.password) {
    if (typeof b.password !== "string" || b.password.length < 8 || b.password.length > 72) return bad("كلمة المرور بين 8 و72 حرفاً");
    const { error } = await svc.auth.admin.updateUserById(b.id, { password: b.password });
    if (error) return bad("تعذر تغيير كلمة المرور");
  }
  const patch: any = {};
  if (b.role) { if (!ROLES.includes(b.role)) return NextResponse.json({ error: "دور غير صحيح" }, { status: 400 }); patch.role = b.role; }
  if ("branch_id" in b) patch.branch_id = b.branch_id || null;
  if (typeof b.is_active === "boolean") patch.is_active = b.is_active;
  if (b.full_name) patch.full_name = b.full_name;
  if (Object.keys(patch).length) {
    const { error } = await svc.from("profiles").update(patch).eq("id", b.id);
    if (error) return bad("تعذر حفظ التعديلات");
  }
  if (b.is_active === false) await svc.auth.admin.updateUserById(b.id, { ban_duration: "876000h" });
  if (b.is_active === true) await svc.auth.admin.updateUserById(b.id, { ban_duration: "none" });
  return NextResponse.json({ ok: true });
}
