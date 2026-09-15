"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Locale } from "@/i18n/dictionaries";

export default function CompanySettingsForm({
  dict,
  locale,
  settings,
}: {
  dict: any;
  locale: Locale;
  settings: any;
}) {
  const [nameAr, setNameAr] = useState(settings?.name_ar ?? "");
  const [nameEn, setNameEn] = useState(settings?.name_en ?? "");
  const [crNumber, setCrNumber] = useState(settings?.cr_number ?? "");
  const [taxNumber, setTaxNumber] = useState(settings?.tax_number ?? "");
  const [phone, setPhone] = useState(settings?.phone ?? "");
  const [email, setEmail] = useState(settings?.email ?? "");
  const [defaultLanguage, setDefaultLanguage] = useState(settings?.default_language ?? "ar");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(false);

    const supabase = createClient();
    const { error } = await supabase
      .from("company_settings")
      .update({
        name_ar: nameAr,
        name_en: nameEn,
        cr_number: crNumber || null,
        tax_number: taxNumber || null,
        phone: phone || null,
        email: email || null,
        default_language: defaultLanguage,
      })
      .eq("id", settings.id);

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex max-w-2xl flex-col gap-4 rounded-lg border border-navy/10 bg-white p-6"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm text-navy/70">{dict.common.name} (AR)</label>
          <input
            required
            value={nameAr}
            onChange={(e) => setNameAr(e.target.value)}
            className="w-full rounded border border-navy/20 px-3 py-2 text-sm outline-none focus:border-gold"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-navy/70">{dict.common.name} (EN)</label>
          <input
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            className="w-full rounded border border-navy/20 px-3 py-2 text-sm outline-none focus:border-gold"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-navy/70">
            {locale === "ar" ? "السجل التجاري" : "CR Number"}
          </label>
          <input
            value={crNumber}
            onChange={(e) => setCrNumber(e.target.value)}
            className="w-full rounded border border-navy/20 px-3 py-2 text-sm outline-none focus:border-gold"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-navy/70">
            {locale === "ar" ? "الرقم الضريبي" : "Tax Number"}
          </label>
          <input
            value={taxNumber}
            onChange={(e) => setTaxNumber(e.target.value)}
            className="w-full rounded border border-navy/20 px-3 py-2 text-sm outline-none focus:border-gold"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-navy/70">
            {locale === "ar" ? "الهاتف" : "Phone"}
          </label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded border border-navy/20 px-3 py-2 text-sm outline-none focus:border-gold"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-navy/70">{dict.common.email}</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-navy/20 px-3 py-2 text-sm outline-none focus:border-gold"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-navy/70">
            {locale === "ar" ? "اللغة الافتراضية" : "Default Language"}
          </label>
          <select
            value={defaultLanguage}
            onChange={(e) => setDefaultLanguage(e.target.value)}
            className="w-full rounded border border-navy/20 px-3 py-2 text-sm outline-none focus:border-gold"
          >
            <option value="ar">العربية</option>
            <option value="en">English</option>
          </select>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && !error && (
        <p className="text-sm text-green-700">
          {locale === "ar" ? "تم الحفظ بنجاح" : "Saved successfully"}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="self-start rounded bg-navy px-5 py-2.5 text-sm font-medium text-white hover:bg-navy/90 disabled:opacity-50 transition-colors"
      >
        {dict.common.save}
      </button>
    </form>
  );
}
