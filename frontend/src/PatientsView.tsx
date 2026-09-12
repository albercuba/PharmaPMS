import { useState } from "react";
import { useTranslation } from "react-i18next";

const demoPatients = [
  { id: "P-10042", name: "Amina Rahman", phone: "+49 170 555 0182", locale: "ar-SA" },
  { id: "P-10041", name: "Thomas Weber", phone: "+49 171 555 0144", locale: "de-DE" },
];

export function PatientsView() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const patients = demoPatients.filter((patient) => `${patient.id} ${patient.name} ${patient.phone}`.toLowerCase().includes(search.toLowerCase()));
  return <>
    <header className="topbar"><div><p className="eyebrow">{t("patients.eyebrow")}</p><h1>{t("patients.title")}</h1><p className="summary">{t("patients.subtitle")}</p></div><button className="primary-action">{t("patients.newPatient")}</button></header>
    <section className="panel"><div className="catalog-toolbar"><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("patients.searchPlaceholder")} /></div><div className="table-wrap"><table><thead><tr><th>{t("patients.patientNumber")}</th><th>{t("patients.name")}</th><th>{t("patients.phone")}</th><th>{t("patients.preferredLanguage")}</th><th>{t("patients.status")}</th></tr></thead><tbody>{patients.map((patient) => <tr key={patient.id} onClick={() => setSelectedId(patient.id)}><td>{patient.id}</td><td><strong>{patient.name}</strong></td><td>{patient.phone}</td><td>{patient.locale}</td><td><span className="status-badge ok">{t("patients.active")}</span></td></tr>)}</tbody></table></div></section>
    {selectedId && <section className="panel"><div className="panel-heading"><h2>{t("patients.details")}</h2><button>{t("patients.edit")}</button></div><p><strong>{patients.find((patient) => patient.id === selectedId)?.name}</strong></p><h3>{t("patients.history")}</h3><p>{t("patients.noHistory")}</p></section>}
    <section className="content-grid"><article className="panel"><h2>{t("patients.createTitle")}</h2><div className="form-grid"><label className="form-field">{t("patients.firstName")}<input /></label><label className="form-field">{t("patients.lastName")}<input /></label><label className="form-field">{t("patients.patientNumber")}<input /></label><label className="form-field">{t("patients.preferredLanguage")}<select><option>en-US</option><option>de-DE</option><option>ar-SA</option></select></label></div><div className="editor-actions"><button className="primary-action">{t("patients.save")}</button></div></article><article className="panel"><h2>{t("patients.privacyTitle")}</h2><p>{t("patients.privacyDescription")}</p></article></section>
  </>;
}
