import { FormEvent, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

type CatalogStatus = "active" | "inactive" | "archived";
type CatalogProduct = {
  id: string;
  displayName: string;
  genericName: string;
  brandName: string;
  sku: string;
  barcode: string;
  manufacturer: string;
  status: CatalogStatus;
  type: "medicine" | "general";
  strength: string;
  dosageForm: string;
  packSize: string;
  storage: string;
  purchasePrice: string;
  sellingPrice: string;
  prescription: "otc" | "prescriptionOnly";
  controlled: boolean;
};

const initialProducts: CatalogProduct[] = [
  {
    id: "demo-amoxicillin",
    displayName: "Amoxicillin 500 mg",
    genericName: "Amoxicillin",
    brandName: "PharmaCare",
    sku: "MED-AMX-500",
    barcode: "04012345678901",
    manufacturer: "Example Pharma GmbH",
    status: "active",
    type: "medicine",
    strength: "500 mg",
    dosageForm: "Capsule",
    packSize: "20 capsules",
    storage: "Below 25°C",
    purchasePrice: "4.80",
    sellingPrice: "8.90",
    prescription: "prescriptionOnly",
    controlled: false,
  },
  {
    id: "demo-vitamin",
    displayName: "Vitamin D3 2000 IU",
    genericName: "Cholecalciferol",
    brandName: "DailyWell",
    sku: "SUP-VD3-2K",
    barcode: "04012345678918",
    manufacturer: "Wellness Labs",
    status: "active",
    type: "general",
    strength: "2000 IU",
    dosageForm: "Tablet",
    packSize: "60 tablets",
    storage: "Dry place",
    purchasePrice: "3.25",
    sellingPrice: "7.50",
    prescription: "otc",
    controlled: false,
  },
];

const emptyProduct: Omit<CatalogProduct, "id"> = {
  displayName: "",
  genericName: "",
  brandName: "",
  sku: "",
  barcode: "",
  manufacturer: "",
  status: "active",
  type: "medicine",
  strength: "",
  dosageForm: "",
  packSize: "",
  storage: "",
  purchasePrice: "",
  sellingPrice: "",
  prescription: "prescriptionOnly",
  controlled: false,
};

export function CatalogView() {
  const { t } = useTranslation();
  const [products, setProducts] = useState(initialProducts);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | CatalogStatus>(
    "all",
  );
  const [selectedId, setSelectedId] = useState(initialProducts[0].id);
  const [editor, setEditor] = useState<CatalogProduct | null>(null);
  const [notice, setNotice] = useState("");

  const filteredProducts = useMemo(
    () =>
      products.filter((product) => {
        const searchable = [
          product.displayName,
          product.genericName,
          product.brandName,
          product.sku,
          product.barcode,
        ]
          .join(" ")
          .toLocaleLowerCase();
        return (
          (statusFilter === "all" || product.status === statusFilter) &&
          searchable.includes(query.toLocaleLowerCase())
        );
      }),
    [products, query, statusFilter],
  );
  const selected =
    products.find((product) => product.id === selectedId) ??
    filteredProducts[0];

  function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    setProducts((current) =>
      current.some((product) => product.id === editor.id)
        ? current.map((product) =>
            product.id === editor.id ? editor : product,
          )
        : [...current, editor],
    );
    setSelectedId(editor.id);
    setEditor(null);
    setNotice(t("catalog.productSaved"));
  }

  return (
    <section className="catalog-workspace">
      <div className="catalog-header">
        <div>
          <p className="eyebrow">{t("navigation.catalog")}</p>
          <h1>{t("catalog.title")}</h1>
          <p className="summary">{t("catalog.subtitle")}</p>
        </div>
        <button
          className="primary-action"
          onClick={() =>
            setEditor({ id: `local-${Date.now()}`, ...emptyProduct })
          }
        >
          {t("catalog.newProduct")}
        </button>
      </div>

      <div className="catalog-toolbar">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("catalog.searchPlaceholder")}
        />
        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value as "all" | CatalogStatus)
          }
        >
          <option value="all">{t("catalog.allStatuses")}</option>
          <option value="active">{t("catalog.active")}</option>
          <option value="inactive">{t("catalog.inactive")}</option>
          <option value="archived">{t("catalog.archived")}</option>
        </select>
      </div>
      {notice && (
        <p className="catalog-notice" role="status">
          {notice}
        </p>
      )}

      <div className="catalog-layout">
        <article className="panel catalog-list-panel">
          <div className="catalog-list-heading">
            <strong>{filteredProducts.length}</strong>
            <span>{t("catalog.title")}</span>
          </div>
          <div className="catalog-list">
            {filteredProducts.map((product) => (
              <button
                className={`catalog-list-item ${selected?.id === product.id ? "selected" : ""}`}
                key={product.id}
                onClick={() => setSelectedId(product.id)}
              >
                <span className="catalog-product-icon">
                  {product.type === "medicine" ? "+" : "•"}
                </span>
                <span>
                  <strong>{product.displayName}</strong>
                  <small>
                    {product.sku} · {product.manufacturer}
                  </small>
                </span>
                <span
                  className={`status-badge ${product.status === "active" ? "ok" : "watch"}`}
                >
                  {t(`catalog.${product.status}`)}
                </span>
              </button>
            ))}
            {filteredProducts.length === 0 && (
              <p className="empty-state">{t("catalog.noResults")}</p>
            )}
          </div>
        </article>

        {selected && (
          <article className="panel catalog-details-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">{t("catalog.details")}</p>
                <h2>{selected.displayName}</h2>
              </div>
              <button
                className="ghost-button"
                onClick={() => setEditor(selected)}
              >
                {t("catalog.editProduct")}
              </button>
            </div>
            <div className="catalog-detail-grid">
              <Detail
                label={t("catalog.genericName")}
                value={selected.genericName}
              />
              <Detail
                label={t("catalog.brandName")}
                value={selected.brandName}
              />
              <Detail label={t("catalog.sku")} value={selected.sku} />
              <Detail label={t("catalog.barcode")} value={selected.barcode} />
              <Detail
                label={t("catalog.manufacturer")}
                value={selected.manufacturer}
              />
              <Detail
                label={t("catalog.type")}
                value={t(`catalog.${selected.type}`)}
              />
              <Detail label={t("catalog.strength")} value={selected.strength} />
              <Detail
                label={t("catalog.dosageForm")}
                value={selected.dosageForm}
              />
              <Detail label={t("catalog.packSize")} value={selected.packSize} />
              <Detail label={t("catalog.storage")} value={selected.storage} />
              <Detail
                label={t("catalog.purchasePrice")}
                value={selected.purchasePrice}
              />
              <Detail
                label={t("catalog.sellingPrice")}
                value={selected.sellingPrice}
              />
            </div>
          </article>
        )}
      </div>

      {editor && (
        <div className="catalog-modal-backdrop" role="presentation">
          <form className="panel catalog-editor" onSubmit={saveProduct}>
            <div className="panel-heading">
              <h2>
                {t(
                  editor.displayName
                    ? "catalog.editProduct"
                    : "catalog.newProduct",
                )}
              </h2>
              <button
                type="button"
                className="ghost-button"
                onClick={() => setEditor(null)}
              >
                {t("catalog.close")}
              </button>
            </div>
            <div className="form-grid">
              <Field
                label={t("catalog.displayName")}
                value={editor.displayName}
                onChange={(value) =>
                  setEditor({ ...editor, displayName: value })
                }
                required
              />
              <Field
                label={t("catalog.genericName")}
                value={editor.genericName}
                onChange={(value) =>
                  setEditor({ ...editor, genericName: value })
                }
              />
              <Field
                label={t("catalog.brandName")}
                value={editor.brandName}
                onChange={(value) => setEditor({ ...editor, brandName: value })}
              />
              <Field
                label={t("catalog.sku")}
                value={editor.sku}
                onChange={(value) => setEditor({ ...editor, sku: value })}
              />
              <Field
                label={t("catalog.barcode")}
                value={editor.barcode}
                onChange={(value) => setEditor({ ...editor, barcode: value })}
              />
              <Field
                label={t("catalog.manufacturer")}
                value={editor.manufacturer}
                onChange={(value) =>
                  setEditor({ ...editor, manufacturer: value })
                }
              />
              <Field
                label={t("catalog.strength")}
                value={editor.strength}
                onChange={(value) => setEditor({ ...editor, strength: value })}
              />
              <Field
                label={t("catalog.dosageForm")}
                value={editor.dosageForm}
                onChange={(value) =>
                  setEditor({ ...editor, dosageForm: value })
                }
              />
              <Field
                label={t("catalog.packSize")}
                value={editor.packSize}
                onChange={(value) => setEditor({ ...editor, packSize: value })}
              />
              <Field
                label={t("catalog.storage")}
                value={editor.storage}
                onChange={(value) => setEditor({ ...editor, storage: value })}
              />
              <Field
                label={t("catalog.purchasePrice")}
                value={editor.purchasePrice}
                onChange={(value) =>
                  setEditor({ ...editor, purchasePrice: value })
                }
              />
              <Field
                label={t("catalog.sellingPrice")}
                value={editor.sellingPrice}
                onChange={(value) =>
                  setEditor({ ...editor, sellingPrice: value })
                }
              />
            </div>
            <div className="editor-actions">
              <button
                type="button"
                className="ghost-button"
                onClick={() => setEditor(null)}
              >
                {t("catalog.cancel")}
              </button>
              <button className="primary-action">{t("catalog.save")}</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="catalog-detail">
      <small>{label}</small>
      <strong>{value || "—"}</strong>
    </div>
  );
}
function Field({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="form-field">
      <span>{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
      />
    </label>
  );
}
