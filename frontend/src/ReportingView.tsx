import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "./i18n/config";
import { formatCurrency, formatNumber } from "./i18n/format";

type Dashboard = { awaitingPrescriptions: number; lowStock: number; expiringSoon: number; expiredStock: number; pendingPurchaseOrders: number; openCounts: number; inventoryDiscrepancies: number };
type SalesReport = { count: number; units: number; revenue: number; grossProfit: number };

export function ReportingView() {
  const { t } = useTranslation();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [sales, setSales] = useState<SalesReport | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const options = { credentials: "include" as RequestCredentials, headers: { "X-UI-Locale": i18n.resolvedLanguage ?? "en-US" } };
    Promise.all([fetch("/api/v1/dashboard", options), fetch("/api/v1/reports/sales", options)])
      .then(async ([dashboardResponse, salesResponse]) => {
        if (!dashboardResponse.ok || !salesResponse.ok) throw new Error("request failed");
        const dashboardPayload = await dashboardResponse.json() as Dashboard;
        const salesPayload = await salesResponse.json() as { report: SalesReport };
        setDashboard(dashboardPayload); setSales(salesPayload.report);
      }).catch(() => setError(true));
  }, []);
  const locale = i18n.resolvedLanguage ?? "en-US";
  const value = (key: keyof Dashboard) => dashboard ? formatNumber(dashboard[key], locale) : "—";
  return <>
    <header className="topbar"><div><p className="eyebrow">{t("reports.eyebrow")}</p><h1>{t("reports.title")}</h1><p className="summary">{t("reports.subtitle")}</p></div></header>
    {error && <p role="status" className="panel">{t("reports.unavailable")}</p>}
    <section className="metric-grid" aria-label={t("reports.attention")}>
      <ReportCard label={t("reports.awaitingPrescriptions")} value={value("awaitingPrescriptions")} />
      <ReportCard label={t("reports.lowStock")} value={value("lowStock")} />
      <ReportCard label={t("reports.expiringSoon")} value={value("expiringSoon")} />
      <ReportCard label={t("reports.expiredStock")} value={value("expiredStock")} />
      <ReportCard label={t("reports.pendingPurchaseOrders")} value={value("pendingPurchaseOrders")} />
      <ReportCard label={t("reports.openCounts")} value={value("openCounts")} />
      <ReportCard label={t("reports.inventoryDiscrepancies")} value={value("inventoryDiscrepancies")} />
    </section>
    <section className="content-grid"><article className="panel"><div className="panel-heading"><h2>{t("reports.salesSummary")}</h2></div><div className="report-summary"><strong>{sales ? formatCurrency(sales.revenue, locale, "USD") : "—"}</strong><span>{t("reports.revenue")}</span><strong>{sales ? formatCurrency(sales.grossProfit, locale, "USD") : "—"}</strong><span>{t("reports.grossProfit")}</span><strong>{sales ? formatNumber(sales.units, locale) : "—"}</strong><span>{t("reports.unitsSold")}</span></div></article><article className="panel"><h2>{t("reports.safeReporting")}</h2><p>{t("reports.safeReportingDescription")}</p><a href="/api/v1/audit/events.csv" className="ghost-button">{t("reports.exportAudit")}</a></article></section>
  </>;
}
function ReportCard({ label, value }: { label: string; value: string }) { return <article className="metric-card info"><span>{label}</span><strong>{value}</strong></article>; }
