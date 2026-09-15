import { redirect } from "next/navigation";
import type { Locale } from "@/i18n/dictionaries";

export default async function LocaleRoot({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = (await params) as { locale: Locale };

  redirect(`/${locale}/dashboard`);
}
