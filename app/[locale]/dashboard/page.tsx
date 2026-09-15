import { createClient } from "@/lib/supabase/server";
import { getDictionary, type Locale } from "@/i18n/dictionaries";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = (await params) as { locale: Locale };

  const dict = getDictionary(locale);
  const supabase = await createClient();

  const { data: balanceSheet } = await supabase.from("balance_sheet").select("*");

  const cash =
    balanceSheet
      ?.filter((r: any) => r.code === "1110" || r.code === "1120")
      .reduce((sum: number, r: any) => sum + Number(r.amount), 0) ?? 0;

  const receivables =
    balanceSheet?.find((r: any) => r.code === "1130")?.amount ?? 0;

  const payables =
    balanceSheet?.find((r: any) => r.code === "2110")?.amount ?? 0;

  const cards = [
    { label: dict.dashboard.cashAndBank, value: cash },
    { label: dict.dashboard.totalReceivables, value: receivables },
    { label: dict.dashboard.totalPayables, value: payables },
  ];

  return (
    <div>
      <h2 className="text-xl font-semibold text-navy mb-6">{dict.common.dashboard}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-navy/10 bg-white p-5"
          >
            <p className="text-sm text-navy/60">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold text-navy">
              {Number(card.value).toLocaleString(locale === "ar" ? "ar-OM" : "en-US", {
                minimumFractionDigits: 3,
              })}{" "}
              <span className="text-sm text-navy/50">OMR</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
