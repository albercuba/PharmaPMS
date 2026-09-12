import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supportedLocales } from "./i18n/config";

type AuthViewProps = { onAuthenticated: () => void };
type Mode = "login" | "setup";

export function AuthView({ onAuthenticated }: AuthViewProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [challengeToken, setChallengeToken] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [form, setForm] = useState({ organizationId: "", email: "", password: "", code: "" });
  const [setup, setSetup] = useState({ organizationName: "", countryCode: "", defaultLocale: "en-US", currency: "USD", timezone: "UTC", locationName: "", locationCode: "MAIN", displayName: "", email: "", password: "" });

  useEffect(() => {
    fetch("/api/v1/auth/bootstrap/status")
      .then(async (response) => { const payload = await response.json() as { setupRequired: boolean }; setMode(payload.setupRequired ? "setup" : "login"); })
      .catch(() => setError(t("auth.connectionError")))
      .finally(() => setLoading(false));
  }, [t]);

  async function login(event: FormEvent) {
    event.preventDefault(); setError("");
    const payload = mfaRequired ? { challengeToken, code: form.code } : { organizationId: form.organizationId, email: form.email, password: form.password };
    const endpoint = mfaRequired ? "/api/v1/auth/login/mfa" : "/api/v1/auth/login";
    const response = await fetch(endpoint, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const result = await response.json().catch(() => ({})) as { error?: string; challengeToken?: string; message?: string };
    if (!response.ok) { if (result.error === "MFA_REQUIRED" && result.challengeToken) { setChallengeToken(result.challengeToken); setMfaRequired(true); } else setError(result.message ?? t("auth.loginFailed")); return; }
    onAuthenticated();
  }

  async function bootstrap(event: FormEvent) {
    event.preventDefault(); setError("");
    const response = await fetch("/api/v1/auth/bootstrap", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(setup) });
    const result = await response.json().catch(() => ({})) as { organization?: { id: string }; message?: string };
    if (!response.ok || !result.organization) { setError(result.message ?? t("auth.setupFailed")); return; }
    setForm({ ...form, organizationId: result.organization.id, email: setup.email, password: setup.password }); setMode("login"); setError("");
  }

  if (loading) return <main className="auth-page"><div className="auth-card"><p>{t("auth.loading")}</p></div></main>;
  return <main className="auth-page"><section className="auth-card"><div className="auth-brand"><span className="brand-mark">+</span><div><strong>{t("app.name")}</strong><small>{t("app.tagline")}</small></div></div>{error && <p className="form-message error" role="alert">{error}</p>}{mode === "login" ? <><p className="eyebrow">{t("auth.eyebrow")}</p><h1>{mfaRequired ? t("auth.mfaTitle") : t("auth.loginTitle")}</h1><p className="summary">{mfaRequired ? t("auth.mfaDescription") : t("auth.loginDescription")}</p><form className="auth-form" onSubmit={login}>{mfaRequired ? <label className="form-field"><span>{t("auth.mfaCode")}</span><input autoFocus inputMode="numeric" pattern="[0-9]{6}" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} required /></label> : <><label className="form-field"><span>{t("auth.organizationId")}</span><input value={form.organizationId} onChange={(event) => setForm({ ...form, organizationId: event.target.value })} required /></label><label className="form-field"><span>{t("auth.email")}</span><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></label><label className="form-field"><span>{t("auth.password")}</span><input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required /></label></>}<button className="primary-action">{mfaRequired ? t("auth.verify") : t("auth.login")}</button></form>{mfaRequired && <button className="text-button" onClick={() => { setMfaRequired(false); setChallengeToken(""); }}>{t("auth.backToLogin")}</button>}</> : <><p className="eyebrow">{t("auth.setupEyebrow")}</p><h1>{t("auth.setupTitle")}</h1><p className="summary">{t("auth.setupDescription")}</p><form className="auth-form" onSubmit={bootstrap}><label className="form-field"><span>{t("auth.organizationName")}</span><input value={setup.organizationName} onChange={(event) => setSetup({ ...setup, organizationName: event.target.value })} required /></label><div className="form-grid"><label className="form-field"><span>{t("auth.countryCode")}</span><input maxLength={2} value={setup.countryCode} onChange={(event) => setSetup({ ...setup, countryCode: event.target.value })} required /></label><label className="form-field"><span>{t("auth.currency")}</span><input maxLength={3} value={setup.currency} onChange={(event) => setSetup({ ...setup, currency: event.target.value })} required /></label></div><label className="form-field"><span>{t("auth.locationName")}</span><input value={setup.locationName} onChange={(event) => setSetup({ ...setup, locationName: event.target.value })} required /></label><label className="form-field"><span>{t("auth.adminName")}</span><input value={setup.displayName} onChange={(event) => setSetup({ ...setup, displayName: event.target.value })} required /></label><label className="form-field"><span>{t("auth.email")}</span><input type="email" value={setup.email} onChange={(event) => setSetup({ ...setup, email: event.target.value })} required /></label><label className="form-field"><span>{t("auth.password")}</span><input type="password" minLength={12} value={setup.password} onChange={(event) => setSetup({ ...setup, password: event.target.value })} required /></label><label className="form-field"><span>{t("auth.language")}</span><select value={setup.defaultLocale} onChange={(event) => setSetup({ ...setup, defaultLocale: event.target.value })}>{Object.entries(supportedLocales).map(([code, metadata]) => <option value={code} key={code}>{metadata.label}</option>)}</select></label><button className="primary-action">{t("auth.createAdmin")}</button></form><button className="text-button" onClick={() => setMode("login")}>{t("auth.existingInstallation")}</button></>}</section></main>;
}
