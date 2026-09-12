import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import i18n, {
  applyDocumentLocale,
  supportedLocales,
  SupportedLocale,
} from "./i18n/config";
import { CatalogView } from "./CatalogView";
import { InventoryView } from "./InventoryView";
import { PurchasingView } from "./PurchasingView";
import { PosView } from "./PosView";
import { PatientsView } from "./PatientsView";
import { PrescriptionsView } from "./PrescriptionsView";
import { ReportingView } from "./ReportingView";
import { IdentityView } from "./IdentityView";

type View =
  | "dashboard"
  | "catalog"
  | "inventory"
  | "purchasing"
  | "pos"
  | "patients"
  | "prescriptions"
  | "reports"
  | "identity";
type IconName =
  | "home"
  | "catalog"
  | "inventory"
  | "purchasing"
  | "pos"
  | "patients"
  | "prescriptions"
  | "reports"
  | "settings"
  | "search"
  | "bell"
  | "plus"
  | "menu"
  | "sun"
  | "moon"
  | "chevron";

const navItems: Array<{ key: View; label: string; icon: IconName }> = [
  { key: "dashboard", label: "dashboard", icon: "home" },
  { key: "catalog", label: "catalog", icon: "catalog" },
  { key: "inventory", label: "inventory", icon: "inventory" },
  { key: "purchasing", label: "suppliers", icon: "purchasing" },
  { key: "pos", label: "pos", icon: "pos" },
  { key: "patients", label: "patients", icon: "patients" },
  { key: "prescriptions", label: "prescriptions", icon: "prescriptions" },
  { key: "reports", label: "reports", icon: "reports" },
];
const navGroups: Array<{ label: string; icon: IconName; items: View[] }> = [
  { label: "stock", icon: "inventory", items: ["catalog", "inventory"] },
  { label: "sales", icon: "pos", items: ["prescriptions", "pos"] },
  { label: "purchase", icon: "purchasing", items: ["purchasing"] },
  { label: "reports", icon: "reports", items: ["reports"] },
];

export function App() {
  const { t } = useTranslation();
  const [activeView, setActiveView] = useState<View>("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    { stock: false, sales: false, purchase: false, reports: false },
  );
  const [dark, setDark] = useState(
    () => window.localStorage.getItem("pharmapms.theme") === "dark",
  );
  const locale = (i18n.resolvedLanguage ?? "en-US") as SupportedLocale;

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    window.localStorage.setItem("pharmapms.theme", dark ? "dark" : "light");
  }, [dark]);

  function navigate(view: View) {
    setActiveView(view);
    setMobileOpen(false);
    window.history.replaceState(null, "", `#${view}`);
  }

  function handleLocaleChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextLocale = event.target.value as SupportedLocale;
    void i18n
      .changeLanguage(nextLocale)
      .then(() => applyDocumentLocale(nextLocale));
  }

  function handleGlobalSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = searchQuery.trim().toLowerCase();
    if (!query) return;
    const destination: View = query.includes("patient") || query.includes("phone")
      ? "patients"
      : query.includes("prescription") || query.includes("rx")
        ? "prescriptions"
        : query.includes("sale") || query.includes("cart") || query.includes("checkout")
          ? "pos"
          : "catalog";
    navigate(destination);
  }

  return (
    <div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
      {mobileOpen && (
        <button
          className="drawer-scrim"
          aria-label={t("actions.closeMenu")}
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}
        aria-label={t("navigation.primaryNavigation")}
      >
        <button className="new-action" onClick={() => navigate("pos")}>
          <Icon name="plus" />
          <span>{t("actions.newSale")}</span>
        </button>
        <div className="nav-section">
          <span className="nav-section-title">{t("navigation.workspace")}</span>
          <nav className="nav-list">
            <button
              className={`nav-item ${activeView === "dashboard" ? "active" : ""}`}
              onClick={() => navigate("dashboard")}
              title={collapsed ? t("navigation.dashboard") : undefined}
            >
              <Icon name="home" />
              <span>{t("navigation.dashboard")}</span>
            </button>
            {navGroups.map((group) => {
              const expanded = expandedGroups[group.label] ?? false;
              return (
                <div className="sidebar-group" key={group.label}>
                  <button
                    className="nav-item sidebar-group-toggle"
                    aria-expanded={expanded}
                    onClick={() =>
                      setExpandedGroups((current) => ({
                        ...current,
                        [group.label]: !expanded,
                      }))
                    }
                    title={
                      collapsed ? t(`navigation.${group.label}`) : undefined
                    }
                  >
                    <Icon name={group.icon} />
                    <span>{t(`navigation.${group.label}`)}</span>
                    <Icon name="chevron" />
                  </button>
                  <div className={`sidebar-submenu ${expanded ? "open" : ""}`}>
                    {group.items.map((key) => {
                      const item = navItems.find(
                        (candidate) => candidate.key === key,
                      )!;
                      return (
                        <button
                          key={key}
                          className={`nav-item sub-item ${activeView === key ? "active" : ""}`}
                          onClick={() => navigate(key)}
                          title={
                            collapsed
                              ? t(`navigation.${item.label}`)
                              : undefined
                          }
                        >
                          <span>{t(`navigation.${item.label}`)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <button
              className={`nav-item ${activeView === "patients" ? "active" : ""}`}
              onClick={() => navigate("patients")}
            >
              <Icon name="patients" />
              <span>{t("navigation.patients")}</span>
            </button>
          </nav>
        </div>
        <div className="sidebar-spacer" />
        <div className="sidebar-footer">
          <button
            className="nav-item"
            onClick={() => navigate("identity")}
            title={collapsed ? t("navigation.settings") : undefined}
          >
            <Icon name="settings" />
            <span>{t("navigation.settings")}</span>
          </button>
        </div>
      </aside>
      <main className="workspace">
        <header className="workspace-header">
          <button
            className="icon-button mobile-menu"
            onClick={() => setMobileOpen(true)}
            aria-label={t("actions.openMenu")}
          >
            <Icon name="menu" />
          </button>
          <button
            className="topbar-brand"
            onClick={() => navigate("dashboard")}
            aria-label={t("app.name")}
          >
            <span className="brand-mark" aria-hidden="true">
              <Icon name="plus" />
            </span>
            <strong>{t("app.name")}</strong>
          </button>
          <button
            className="icon-button sidebar-toggle"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={t("actions.toggleSidebar")}
            title={t("actions.toggleSidebar")}
          >
            <Icon name="chevron" />
          </button>
          <form className="navbar-search" onSubmit={handleGlobalSearch} role="search">
            <span>{t("dashboard.searchPlaceholder")}</span>
            <Icon name="search" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t("dashboard.searchPlaceholder")}
              aria-label={t("dashboard.searchPlaceholder")}
            />
          </form>
          <div className="header-actions">
            <button
              className="icon-button"
              aria-label={t("actions.notifications")}
              title={t("actions.notifications")}
            >
              <Icon name="bell" />
            </button>
            <button
              className="icon-button"
              onClick={() => navigate("identity")}
              aria-label={t("navigation.settings")}
              title={t("navigation.settings")}
            >
              <Icon name="settings" />
            </button>
            <label className="locale-picker">
              <span>{t("language.label")}</span>
              <select value={locale} onChange={handleLocaleChange}>
                {Object.entries(supportedLocales).map(([code, metadata]) => (
                  <option value={code} key={code}>
                    {metadata.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="icon-button"
              onClick={() => setDark((value) => !value)}
              aria-label={t("actions.toggleTheme")}
              title={t("actions.toggleTheme")}
            >
              <Icon name={dark ? "sun" : "moon"} />
            </button>
            <button
              className="topbar-avatar"
              aria-label={t("actions.accountMenu")}
              title={t("actions.accountMenu")}
              onClick={() => navigate("identity")}
            >
              P
            </button>
          </div>
        </header>
        <div className="content-frame">
          {activeView === "catalog" ? (
            <CatalogView />
          ) : activeView === "inventory" ? (
            <InventoryView />
          ) : activeView === "purchasing" ? (
            <PurchasingView />
          ) : activeView === "pos" ? (
            <PosView />
          ) : activeView === "patients" ? (
            <PatientsView />
          ) : activeView === "prescriptions" ? (
            <PrescriptionsView />
          ) : activeView === "identity" ? (
            <IdentityView />
          ) : (
            <ReportingView />
          )}
        </div>
      </main>
    </div>
  );
}

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, string> = {
    home: "M3 10.5 12 3l9 7.5M5.5 9v10h13V9M9 19v-6h6v6",
    catalog:
      "M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5V5.5ZM4 5.5v16",
    inventory: "M4 7h16M6 4h12v16H6zM9 11h6M9 15h4",
    purchasing: "M4 5h16v14H4zM8 3v4M16 3v4M4 9h16",
    pos: "M5 4h14v16H5zM8 8h8M8 12h2M12 12h4M8 16h2M12 16h4",
    patients:
      "M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20M9.5 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM16 3.5a3.5 3.5 0 0 1 0 7M17 14.5a4 4 0 0 1 4 4V20",
    prescriptions: "M6 3h9l3 3v15H6zM14 3v4h4M9 12h6M9 16h4",
    reports: "M5 20V10M12 20V4M19 20v-7",
    settings:
      "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.14.36.5.6.9.6H21a2 2 0 0 1 0 4h-.09c-.4 0-.76.24-.9.6zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
    search: "m21 21-4.35-4.35M10.8 18a7.2 7.2 0 1 1 0-14.4 7.2 7.2 0 0 1 0 14.4Z",
    bell: "M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0",
    plus: "M12 5v14M5 12h14",
    menu: "M4 7h16M4 12h16M4 17h16",
    sun: "M12 4V2M12 22v-2M4.93 4.93 3.52 3.52M20.48 20.48l-1.41-1.41M4 12H2M22 12h-2M4.93 19.07l-1.41 1.41M20.48 3.52l-1.41 1.41M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
    moon: "M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5 8.5 8.5 0 1 0 20.5 15.5Z",
    chevron: "m9 18 6-6-6-6",
  };
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
