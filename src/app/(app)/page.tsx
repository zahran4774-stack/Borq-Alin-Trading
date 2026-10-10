"use client";
import { I } from "@/components/Icon";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/app-context";
import { money, monthStart, today } from "@/lib/format";
import { PageHeader, StatCard } from "@/components/ui";
import { useOverdue } from "@/lib/overdue";

export default function Dashboard() {
  const { sb, branchId, role, can } = useApp();
  const [sum, setSum] = useState<any[]>([]);
  const [d, setD] = useState({ todaySales: 0, todayCount: 0, repairs: 0, ready: 0, low: 0, recv: 0, pay: 0 });
  const [recent, setRecent] = useState<any[]>([]);
  const od = useOverdue("sales", 30);

  useEffect(() => {
    if (role === "cashier") return;
    (async () => {
      const b = branchId === "all" ? null : branchId;
      const { data } = await sb.rpc("report_branch_summary", { p_from: monthStart(), p_to: today() });
      setSum(((data as any[]) || []).filter((r) => !b || r.branch_id === b));

      const { data: st } = await sb.rpc("dashboard_stats", { p_branch: b, p_today: today() });
      const x: any = st || {};
      setD({
        todaySales: Number(x.today_sales || 0), todayCount: Number(x.today_count || 0),
        repairs: Number(x.repairs || 0), ready: Number(x.ready || 0), low: Number(x.low || 0),
        recv: Number(x.recv || 0), pay: Number(x.pay || 0),
      });
      let lq = sb.from("invoices").select("id,invoice_number,total,invoice_date,contacts(name_ar)").eq("kind", "sales").neq("status", "cancelled").order("created_at", { ascending: false }).limit(8);
      if (b) lq = lq.eq("branch_id", b);
      setRecent(((await lq).data as any[]) || []);
    })();
  }, [sb, branchId, role]);

  if (role === "cashier") return (
    <div className="card text-center space-y-3"><p>مرحباً — ابدأ البيع من نقطة البيع.</p><Link className="btn" href="/pos">فتح نقطة البيع</Link></div>
  );
  const tot = sum.reduce((a, r) => ({ sales: a.sales + Number(r.sales_net), vat: a.vat + Number(r.vat), gp: a.gp + Number(r.gross_profit), exp: a.exp + Number(r.expenses_total), n: a.n + Number(r.invoices_count) }), { sales: 0, vat: 0, gp: 0, exp: 0, n: 0 });
  return (
    <div>
      <PageHeader title="لوحة التحكم">
        {can("admin", "accountant", "branch_manager") && <Link href="/pos" className="btn"><I n="receipt" /> بيع جديد</Link>}
        <Link href="/repairs/new" className="btn btn-sec"><I n="wrench" /> استلام صيانة</Link>
      </PageHeader>
      {od.rows.length > 0 && (
        <Link href="/overdue" className="block mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 hover:bg-red-100 transition">
          <div className="font-extrabold text-red-700"><I n="clock" /> {od.rows.length} عميل متأخر عن السداد أكثر من 30 يوماً — إجمالي {money(od.total)} ر.ع</div>
          <div className="text-sm text-red-600 mt-1">{od.rows.slice(0, 3).map((r) => `${r.name} (${r.daysLate} يوم)`).join(" ، ")}{od.rows.length > 3 ? " …" : ""}</div>
        </Link>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard icon="wallet" label="مبيعات اليوم (شامل الضريبة)" value={money(d.todaySales)} sub={`${d.todayCount} فاتورة`} />
        <StatCard icon="calendar" label="مبيعات الشهر (صافي)" value={money(tot.sales)} sub={`${tot.n} فاتورة`} />
        <StatCard icon="trendUp" label="مجمل ربح الشهر" value={money(tot.gp)} tone="ok" />
        <StatCard icon="trendDown" label="مصروفات الشهر" value={money(tot.exp)} />
        <StatCard icon="trophy" label="صافي الربح التقديري للشهر" value={money(tot.gp - tot.exp)} tone={tot.gp - tot.exp >= 0 ? "ok" : "bad"} />
        <StatCard icon="users" label="ذمم العملاء" value={money(d.recv)} />
        <StatCard icon="truck" label="مستحق للموردين" value={money(d.pay)} />
        <StatCard icon="wrench" label="صيانة مفتوحة" value={String(d.repairs)} sub={`${d.ready} جاهزة للتسليم`} />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        {branchId === "all" && sum.length > 0 && (
          <div className="card overflow-x-auto"><h3 className="font-extrabold text-brand-900 mb-2"><I n="store" /> أداء الفروع (الشهر الحالي)</h3>
            <table className="tbl"><thead><tr><th>الفرع</th><th>الفواتير</th><th>صافي المبيعات</th><th>مجمل الربح</th><th>المصروفات</th></tr></thead>
              <tbody>{sum.map((r) => <tr key={r.branch_id}><td>{r.branch_name}</td><td className="num">{r.invoices_count}</td><td className="num">{money(r.sales_net)}</td><td className="num">{money(r.gross_profit)}</td><td className="num">{money(r.expenses_total)}</td></tr>)}</tbody></table></div>
        )}
        <div className="card"><h3 className="font-extrabold text-brand-900 mb-2"><I n="receipt" /> آخر الفواتير</h3>
          <table className="tbl"><tbody>{recent.map((r) => <tr key={r.id}><td><Link className="text-brand-600 num underline" href={`/invoices/${r.id}`}>{r.invoice_number}</Link></td><td>{r.contacts?.name_ar}</td><td className="num">{money(r.total)}</td></tr>)}</tbody></table></div>
        {d.low > 0 && <div className="card bg-amber-50 border-amber-200"><I n="alert" /> <b>{d.low}</b> منتج وصل إلى حد إعادة الطلب أو أقل. <Link className="underline text-brand-700" href="/stock">عرض الأرصدة</Link></div>}
      </div>
    </div>
  );
}
