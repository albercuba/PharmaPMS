import { FormEvent, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

type InventoryState = "available" | "quarantined" | "damaged" | "expired";
type InventoryRow = {
  id: string;
  product: string;
  lot: string;
  expiry: string;
  location: string;
  quantity: number;
  state: InventoryState;
};

const initialRows: InventoryRow[] = [
  {
    id: "stock-1",
    product: "Amoxicillin 500 mg",
    lot: "AMX-2408-A",
    expiry: "2026-10-04",
    location: "Main pharmacy",
    quantity: 18,
    state: "available",
  },
  {
    id: "stock-2",
    product: "Metformin 850 mg",
    lot: "MET-2407-C",
    expiry: "2026-11-19",
    location: "Main pharmacy",
    quantity: 44,
    state: "available",
  },
  {
    id: "stock-3",
    product: "Vitamin D3 2000 IU",
    lot: "VD3-2501-B",
    expiry: "2027-01-22",
    location: "Main pharmacy",
    quantity: 126,
    state: "available",
  },
];

export function InventoryView() {
  const { t } = useTranslation();
  const [rows, setRows] = useState(initialRows);
  const [filter, setFilter] = useState<"all" | InventoryState>("all");
  const [query, setQuery] = useState("");
  const [adjustment, setAdjustment] = useState<InventoryRow | null>(null);
  const [notice, setNotice] = useState("");
  const visibleRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          (filter === "all" || row.state === filter) &&
          `${row.product} ${row.lot} ${row.location}`
            .toLocaleLowerCase()
            .includes(query.toLocaleLowerCase()),
      ),
    [rows, filter, query],
  );

  function saveAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!adjustment) return;
    setRows((current) =>
      current.map((row) => (row.id === adjustment.id ? adjustment : row)),
    );
    setAdjustment(null);
    setNotice(t("inventory.adjustmentSaved"));
  }

  return (
    <section className="inventory-workspace">
      <div className="catalog-header">
        <div>
          <p className="eyebrow">{t("navigation.inventory")}</p>
          <h1>{t("inventory.title")}</h1>
          <p className="summary">{t("inventory.subtitle")}</p>
        </div>
        <button
          className="primary-action"
          onClick={() => setAdjustment(rows[0])}
        >
          {t("inventory.adjustStock")}
        </button>
      </div>
      <div className="inventory-metrics">
        <Metric
          label={t("inventory.totalUnits")}
          value={rows.reduce((sum, row) => sum + row.quantity, 0).toString()}
        />
        <Metric
          label={t("inventory.expiringSoon")}
          value={rows
            .filter((row) => row.expiry < "2026-12-31")
            .length.toString()}
        />
        <Metric
          label={t("inventory.lowStock")}
          value={rows.filter((row) => row.quantity < 25).length.toString()}
        />
      </div>
      <div className="catalog-toolbar">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("inventory.searchPlaceholder")}
        />
        <select
          value={filter}
          onChange={(event) =>
            setFilter(event.target.value as "all" | InventoryState)
          }
        >
          <option value="all">{t("inventory.allStates")}</option>
          <option value="available">{t("inventory.available")}</option>
          <option value="quarantined">{t("inventory.quarantined")}</option>
          <option value="damaged">{t("inventory.damaged")}</option>
          <option value="expired">{t("inventory.expired")}</option>
        </select>
      </div>
      {notice && (
        <p className="catalog-notice" role="status">
          {notice}
        </p>
      )}
      <article className="panel inventory-table-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{t("inventory.currentStock")}</p>
            <h2>{t("inventory.batchStock")}</h2>
          </div>
          <span className="inventory-ledger-note">
            {t("inventory.ledgerNote")}
          </span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("inventory.product")}</th>
                <th>{t("inventory.lot")}</th>
                <th>{t("inventory.expiry")}</th>
                <th>{t("inventory.location")}</th>
                <th>{t("inventory.quantity")}</th>
                <th>{t("inventory.state")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.product}</td>
                  <td>{row.lot}</td>
                  <td>{row.expiry}</td>
                  <td>{row.location}</td>
                  <td>{row.quantity}</td>
                  <td>
                    <span
                      className={`status-badge ${row.state === "available" ? "ok" : "watch"}`}
                    >
                      {t(`inventory.${row.state}`)}
                    </span>
                  </td>
                  <td>
                    <button
                      className="ghost-button compact-button"
                      onClick={() => setAdjustment(row)}
                    >
                      {t("inventory.adjust")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
      {adjustment && (
        <div className="catalog-modal-backdrop">
          <form className="panel catalog-editor" onSubmit={saveAdjustment}>
            <div className="panel-heading">
              <h2>{t("inventory.adjustmentTitle")}</h2>
              <button
                type="button"
                className="ghost-button"
                onClick={() => setAdjustment(null)}
              >
                {t("catalog.close")}
              </button>
            </div>
            <p className="summary">
              {adjustment.product} · {adjustment.lot}
            </p>
            <div className="form-grid">
              <label className="form-field">
                <span>{t("inventory.quantity")}</span>
                <input
                  type="number"
                  min="0"
                  value={adjustment.quantity}
                  onChange={(event) =>
                    setAdjustment({
                      ...adjustment,
                      quantity: Number(event.target.value),
                    })
                  }
                />
              </label>
              <label className="form-field">
                <span>{t("inventory.state")}</span>
                <select
                  value={adjustment.state}
                  onChange={(event) =>
                    setAdjustment({
                      ...adjustment,
                      state: event.target.value as InventoryState,
                    })
                  }
                >
                  <option value="available">{t("inventory.available")}</option>
                  <option value="quarantined">
                    {t("inventory.quarantined")}
                  </option>
                  <option value="damaged">{t("inventory.damaged")}</option>
                  <option value="expired">{t("inventory.expired")}</option>
                </select>
              </label>
            </div>
            <div className="editor-actions">
              <button
                type="button"
                className="ghost-button"
                onClick={() => setAdjustment(null)}
              >
                {t("catalog.cancel")}
              </button>
              <button className="primary-action">
                {t("inventory.saveAdjustment")}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="metric-card info">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
