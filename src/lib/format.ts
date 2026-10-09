export const CURRENCY = "ر.ع";

export function money(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}
export function num(n: number | string | null | undefined, d = 0): string {
  const v = Number(n ?? 0);
  return v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: d || 3 });
}
export function today(): string {
  const d = new Date();
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}
export function monthStart(): string {
  return today().slice(0, 8) + "01";
}
export function fdate(s: string | null | undefined): string {
  if (!s) return "";
  const d = new Date(s);
  if (isNaN(+d)) return s;
  return d.toLocaleDateString("en-GB");
}
export function fdt(s: string | null | undefined): string {
  if (!s) return "";
  const d = new Date(s);
  return d.toLocaleDateString("en-GB") + " " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
export const r3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;

export const METHODS: Record<string, string> = {
  cash: "نقداً", card: "بطاقة", bank_transfer: "تحويل بنكي", cheque: "شيك", other: "أخرى",
};
export const INV_STATUS: Record<string, string> = {
  draft: "مسودة", confirmed: "غير مدفوعة", partially_paid: "مدفوعة جزئياً", paid: "مدفوعة", cancelled: "ملغاة",
};
export const REPAIR_STATUS: Record<string, string> = {
  received: "تم الاستلام", diagnosing: "قيد الفحص", waiting_approval: "بانتظار موافقة العميل",
  waiting_parts: "بانتظار قطع", in_repair: "قيد الإصلاح", ready: "جاهز للتسليم", delivered: "تم التسليم", cancelled: "ملغي",
};
export const ROLES: Record<string, string> = {
  admin: "مدير النظام", accountant: "محاسب", viewer: "مشاهد فقط",
  branch_manager: "مدير فرع", cashier: "كاشير", technician: "فني صيانة",
};
export const ACCOUNT_TYPES: Record<string, string> = {
  asset: "أصول", liability: "خصوم", equity: "حقوق ملكية", revenue: "إيرادات", expense: "مصروفات",
};

export function errMsg(e: any): string {
  const m: string = e?.message || String(e);
  return m.replace(/^.*?ERROR:\s*/, "");
}

export function downloadCSV(name: string, rows: (string | number)[][]) {
  const esc = (v: any) => {
    let t = String(v ?? "");
    if (typeof v === "string" && /^[=+\-@\t\r]/.test(t) && !/^-?\d+(\.\d+)?$/.test(t)) t = "'" + t;
    return `"${t.replace(/"/g, '""')}"`;
  };
  const csv = "﻿" + rows.map((r) => r.map(esc).join(",")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = name;
  a.click();
}
