import { getDictionary, type Locale } from "@/i18n/dictionaries";
import LoginForm from "@/components/LoginForm";

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = (await params) as { locale: Locale };

  const dict = getDictionary(locale);

  return (
    <div className="mx-auto max-w-sm py-16">
      <h2 className="mb-6 text-xl font-semibold text-navy">{dict.common.login}</h2>
      <LoginForm dict={dict} />
    </div>
  );
}
