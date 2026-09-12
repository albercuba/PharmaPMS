import { useState } from "react";
import { useTranslation } from "react-i18next";

const demoPrescriptions = [
  { number: "RX-2026-0018", patient: "Amina Rahman", status: "awaitingVerification", medicine: "Clinician-entered medicine" },
  { number: "RX-2026-0017", patient: "Thomas Weber", status: "partiallyDispensed", medicine: "Clinician-entered medicine" },
];

export function PrescriptionsView() {
  const { t } = useTranslation();
  const [selected, setSelected] = useState(demoPrescriptions[0]);
  return <>
    <header className="topbar"><div><p className="eyebrow">{t("prescriptions.eyebrow")}</p><h1>{t("prescriptions.title")}</h1><p className="summary">{t("prescriptions.subtitle")}</p></div><button className="primary-action">{t("prescriptions.newPrescription")}</button></header>
    <section className="content-grid"><article className="panel"><div className="panel-heading"><h2>{t("prescriptions.queue")}</h2><span>{demoPrescriptions.length}</span></div><div className="catalog-list">{demoPrescriptions.map((prescription) => <button className={`catalog-list-item ${selected.number === prescription.number ? "selected" : ""}`} key={prescription.number} onClick={() => setSelected(prescription)}><span className="catalog-product-icon">Rx</span><span><strong>{prescription.number}</strong><small>{prescription.patient}</small></span><span className="status-badge warning">{t(`prescriptions.${prescription.status}`)}</span></button>)}</div></article><article className="panel"><div className="panel-heading"><h2>{t("prescriptions.details")}</h2><button>{t("prescriptions.verify")}</button></div><p><strong>{selected.number}</strong> · {selected.patient}</p><div className="catalog-detail-grid"><div className="catalog-detail"><small>{t("prescriptions.medicine")}</small><strong>{selected.medicine}</strong></div><div className="catalog-detail"><small>{t("prescriptions.status")}</small><strong>{t(`prescriptions.${selected.status}`)}</strong></div></div><h3>{t("prescriptions.instructions")}</h3><p>{t("prescriptions.instructionsNotice")}</p><button className="primary-action">{t("prescriptions.dispense")}</button></article></section>
  </>;
}
