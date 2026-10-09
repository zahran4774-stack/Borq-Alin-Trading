"use client";
import { ChangePasswordModal } from "@/components/ChangePassword";
import { I } from "@/components/Icon";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/lib/app-context";
import { ROLES } from "@/lib/format";
import { LangToggle, useLang } from "@/lib/i18n";
import { useOverdue } from "@/lib/overdue";
import MonthlyGate from "@/components/MonthlyGate";

const ALL = ["admin", "accountant", "viewer", "branch_manager", "cashier", "technician"];
const MGMT = ["admin", "accountant", "viewer", "branch_manager"];
const MENU: { href: string; label: string; icon: string; roles: string[] }[] = [
  { href: "/", label: "لوحة التحكم", icon: "dashboard", roles: MGMT },
  { href: "/pos", label: "نقطة البيع", icon: "receipt", roles: ["admin", "accountant", "branch_manager", "cashier"] },
  { href: "/invoices", label: "فواتير البيع", icon: "file", roles: ["admin", "accountant", "viewer", "branch_manager", "cashier"] },
  { href: "/purchases", label: "المشتريات", icon: "cart", roles: ["admin", "accountant", "viewer", "branch_manager"] },
  { href: "/repairs", label: "الصيانة", icon: "wrench", roles: ALL },
  { href: "/products", label: "المنتجات", icon: "box", roles: ["admin", "accountant", "viewer", "branch_manager", "cashier"] },
  { href: "/stock", label: "المخزون والتحويلات", icon: "store", roles: MGMT },
  { href: "/overdue", label: "المتأخرون عن السداد", icon: "clock", roles: ["admin", "accountant", "viewer", "branch_manager", "cashier"] },
  { href: "/contacts", label: "العملاء والموردون", icon: "users", roles: ["admin", "accountant", "viewer", "branch_manager", "cashier"] },
  { href: "/payments", label: "السندات (قبض/صرف)", icon: "wallet", roles: ["admin", "accountant", "branch_manager"] },
  { href: "/expenses", label: "المصروفات", icon: "trendDown", roles: ["admin", "accountant", "viewer", "branch_manager"] },
  { href: "/reports", label: "التقارير", icon: "trendUp", roles: MGMT },
  { href: "/journal", label: "القيود اليومية", icon: "book", roles: ["admin", "accountant", "viewer"] },
  { href: "/settings", label: "الإعدادات", icon: "sliders", roles: ["admin"] },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const { profile, role, branches, branchId, setBranchId, canSelectBranch, company, logout } = useApp();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState(false);
  const { lang } = useLang();
  const en = lang === "en";
  const od = useOverdue("sales", 30);
  const showBell = ["admin", "accountant", "viewer", "branch_manager", "cashier"].includes(role);
  const items = MENU.filter((m) => m.roles.includes(role));
  const active = (h: string) => (h === "/" ? path === "/" : path.startsWith(h));
  const cur = branches.find((b) => b.id === branchId);

  return (
    <div className="min-h-screen flex">
      <aside className={`no-print fixed lg:static inset-y-0 ${en ? "left-0" : "right-0"} z-40 w-64 bg-gradient-to-b from-brand-900 to-[#0f2a4d] text-white flex flex-col shadow-xl transition-transform ${open ? "translate-x-0" : en ? "-translate-x-full lg:translate-x-0" : "translate-x-full lg:translate-x-0"}`}>
        <div className="px-4 py-5 border-b border-white/10 flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gold-500 text-brand-900 flex items-center justify-center text-2xl shadow"><I n="store" size={26} /></div>
          <div>
            <div className="font-extrabold text-base leading-tight">{company.name_ar}</div>
            <div className="text-[11px] text-gold-400 mt-0.5">نظام المحاسبة والمبيعات</div>
          </div>
        </div>
        <nav className="flex-1 overflow-auto py-2">
          {items.map((m) => (
            <Link key={m.href} href={m.href} onClick={() => setOpen(false)}
              className={`flex items-center gap-3 mx-2 my-0.5 px-3 py-2.5 rounded-xl text-sm hover:bg-white/10 transition ${active(m.href) ? "bg-gold-500 text-brand-900 font-bold shadow" : "text-white/90"}`}>
              <I n={m.icon} size={19} />{m.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-white/10 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-gold-100 text-brand-900 flex items-center justify-center text-lg"><I n="user" size={20} /></div>
            <div><div className="font-semibold">{profile.full_name || profile.email}</div>
            <div className="text-white/60">{ROLES[role]}{cur && !canSelectBranch ? ` — ${cur.name_ar}` : ""}</div></div>
          </div>
          <button onClick={() => setPw(true)} className="mt-3 w-full rounded-xl bg-white/10 hover:bg-white/20 py-2"><I n="key" /> تغيير كلمة المرور</button>
          <button onClick={logout} className="mt-2 w-full rounded-xl bg-white/10 hover:bg-white/20 py-2"><I n="logout" /> تسجيل الخروج</button>
        </div>
      </aside>
      {pw && <ChangePasswordModal onClose={() => setPw(false)} />}
      {open && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden no-print" onClick={() => setOpen(false)} />}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="no-print sticky top-0 z-20 bg-white/95 backdrop-blur border-b-2 border-gold-100 px-4 py-2 flex items-center gap-3">
          <button className="lg:hidden w-10 h-10 flex items-center justify-center text-brand-900 rounded-xl bg-gold-50" onClick={() => setOpen(true)}><I n="menu" size={22} /></button><div className="hidden sm:block text-sm font-bold text-brand-900">أهلاً {profile.full_name?.split(" ")[0]}</div>
          <div className="flex-1" />
          <LangToggle />
          {showBell && (
            <Link href="/overdue" title="المتأخرون عن السداد" className="relative no-print w-9 h-9 rounded-xl bg-gold-50 text-brand-900 flex items-center justify-center">
              <I n="bell" size={19} />{od.rows.length > 0 && <span className="absolute -top-1 -end-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{od.rows.length}</span>}
            </Link>
          )}
          <span className="text-xs text-slate-500"><I n="store" /> الفرع:</span>
          {canSelectBranch ? (
            <select className="input !w-auto !py-1" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="all">كل الفروع</option>
              {branches.filter((b) => b.is_active).map((b) => <option key={b.id} value={b.id}>{b.name_ar}</option>)}
            </select>
          ) : <span className="badge badge-info">{cur?.name_ar}</span>}
        </header>
        <main className="p-4 flex-1">{children}</main>
        <MonthlyGate />
      </div>
    </div>
  );
}
