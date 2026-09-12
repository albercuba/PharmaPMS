import { useTranslation } from "react-i18next";

const suppliers = [
  { name: "MedSupply GmbH", reference: "MED-001", status: "active" },
  { name: "Nordic Pharma Wholesale", reference: "NPW-042", status: "active" },
];

const orders = [
  { number: "PO-2026-0042", supplier: "MedSupply GmbH", status: "partiallyReceived", expected: "2026-09-14", outstanding: 24 },
  { number: "PO-2026-0041", supplier: "Nordic Pharma Wholesale", status: "submitted", expected: "2026-09-16", outstanding: 60 },
];

export function PurchasingView() {
  const { t } = useTranslation();
  return <>
    <header className="topbar"><div><p className="eyebrow">{t("purchasing.eyebrow")}</p><h1>{t("purchasing.title")}</h1><p className="summary">{t("purchasing.subtitle")}</p></div><button className="primary-action">{t("purchasing.newOrder")}</button></header>
    <section className="content-grid">
      <article className="panel"><div className="panel-heading"><h2>{t("purchasing.suppliers")}</h2><button className="ghost-button">{t("purchasing.addSupplier")}</button></div><div className="table-wrap"><table><thead><tr><th>{t("purchasing.supplier")}</th><th>{t("purchasing.reference")}</th><th>{t("purchasing.status")}</th></tr></thead><tbody>{suppliers.map((supplier) => <tr key={supplier.reference}><td>{supplier.name}</td><td>{supplier.reference}</td><td><span className="status-badge success">{t(`purchasing.${supplier.status}`)}</span></td></tr>)}</tbody></table></div></article>
      <article className="panel"><div className="panel-heading"><h2>{t("purchasing.purchaseOrders")}</h2><button className="ghost-button">{t("purchasing.viewHistory")}</button></div><div className="table-wrap"><table><thead><tr><th>{t("purchasing.order")}</th><th>{t("purchasing.supplier")}</th><th>{t("purchasing.status")}</th><th>{t("purchasing.outstanding")}</th></tr></thead><tbody>{orders.map((order) => <tr key={order.number}><td><strong>{order.number}</strong><small>{order.expected}</small></td><td>{order.supplier}</td><td><span className="status-badge warning">{t(`purchasing.${order.status}`)}</span></td><td>{order.outstanding}</td></tr>)}</tbody></table></div></article>
    </section>
    <section className="panel"><div className="panel-heading"><div><p className="eyebrow">{t("purchasing.receivingEyebrow")}</p><h2>{t("purchasing.receivingTitle")}</h2></div><button>{t("purchasing.startReceiving")}</button></div><p>{t("purchasing.receivingDescription")}</p></section>
  </>;
}
