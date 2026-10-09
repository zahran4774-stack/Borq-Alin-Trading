"use client";
import { I } from "@/components/Icon";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase/client";

export type Branch = { id: string; code: string; name_ar: string; address_ar: string | null; phone: string | null; is_active: boolean };
export type Profile = { id: string; full_name: string | null; role: string; branch_id: string | null; email: string | null; is_active: boolean };
export type Company = {
  id: string; name_ar: string; name_en: string | null; cr_number: string | null; tax_number: string | null;
  address_ar: string | null; phone: string | null; email: string | null; default_vat_rate: number;
  allow_negative_stock: boolean; books_locked_until: string | null; invoice_footer_ar: string | null; repair_terms_ar: string | null;
};

type Ctx = {
  sb: ReturnType<typeof getSupabase>;
  profile: Profile; branches: Branch[]; company: Company;
  branchId: string; // 'all' or uuid
  setBranchId: (b: string) => void;
  opBranch: string | null; // concrete branch for write operations
  role: string;
  canSelectBranch: boolean;
  can: (...roles: string[]) => boolean;
  reloadCompany: () => Promise<void>;
  reloadBranches: () => Promise<void>;
  logout: () => Promise<void>;
};

const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => {
  const c = useContext(AppCtx);
  if (!c) throw new Error("no app context");
  return c;
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const sb = getSupabase();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [branchId, setBranchState] = useState("all");
  const [err, setErr] = useState("");

  const reloadCompany = useCallback(async () => {
    const { data } = await sb.from("company_settings").select("*").limit(1).maybeSingle();
    if (data) setCompany(data as any);
  }, [sb]);
  const reloadBranches = useCallback(async () => {
    const { data } = await sb.from("branches").select("*").order("code");
    setBranches((data as any) || []);
  }, [sb]);

  useEffect(() => {
    (async () => {
      const { data: u } = await sb.auth.getUser();
      if (!u.user) { router.replace("/login"); return; }
      const { data: p } = await sb.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
      if (!p) { setErr("لا يوجد ملف مستخدم لحسابك. تواصل مع مدير النظام."); return; }
      if (!(p as any).is_active) { setErr("حسابك غير مفعّل. تواصل مع مدير النظام لتفعيله."); return; }
      setProfile(p as any);
      await Promise.all([reloadCompany(), reloadBranches()]);
      const saved = typeof window !== "undefined" ? localStorage.getItem("branch") : null;
      if ((p as any).branch_id) setBranchState((p as any).branch_id);
      else if (saved) setBranchState(saved);
    })();
  }, [sb, router, reloadCompany, reloadBranches]);

  if (err)
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="card max-w-md text-center space-y-3">
          <p className="text-red-600">{err}</p>
          <button className="btn btn-sec" onClick={async () => { await sb.auth.signOut(); router.replace("/login"); }}>تسجيل الخروج</button>
        </div>
      </div>
    );
  if (!profile || !company)
    return <div className="min-h-screen flex items-center justify-center text-slate-500"><I n="loader" /> جاري التحميل…</div>;

  const canSelectBranch = !profile.branch_id;
  const setBranchId = (b: string) => {
    if (!canSelectBranch) return;
    setBranchState(b);
    try { localStorage.setItem("branch", b); } catch {}
  };
  const effective = profile.branch_id || branchId;
  const value: Ctx = {
    sb, profile, branches, company,
    branchId: effective, setBranchId,
    opBranch: effective !== "all" ? effective : null,
    role: profile.role, canSelectBranch,
    can: (...r) => r.includes(profile.role),
    reloadCompany, reloadBranches,
    logout: async () => { await sb.auth.signOut(); router.replace("/login"); },
  };
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
