import { FormEvent, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import i18n, { supportedLocales } from "./i18n/config";

type User = { id: string; email: string; displayName: string; preferredLocale: string; status: string; locationId: string | null };
type Role = { id: string; name: string; description: string | null; permissions: Array<{ permission: { id: string; code: string } }> };
type Location = { id: string; name: string; code: string };
type Permission = { id: string; code: string; description: string | null };
type Me = { id: string; email: string; displayName: string; preferredLocale: string; status: string; locationId: string | null };

const requestOptions = () => ({ credentials: "include" as RequestCredentials, headers: { "X-UI-Locale": i18n.resolvedLanguage ?? "en-US" } });

export function IdentityView() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"users" | "roles" | "profile" | "mfa">("users");
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [userForm, setUserForm] = useState({ email: "", displayName: "", password: "", preferredLocale: "en-US", locationId: "", roleId: "" });
  const [profileForm, setProfileForm] = useState({ displayName: "", preferredLocale: "en-US" });
  const [mfa, setMfa] = useState<{ enrolled: boolean; organizationEnforced: boolean } | null>(null);
  const [enrollment, setEnrollment] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [mfaCode, setMfaCode] = useState("");

  const loadIdentity = useCallback(async () => {
    setError("");
    try {
      const options = requestOptions();
      const responses = await Promise.all([fetch("/api/v1/users", options), fetch("/api/v1/roles", options), fetch("/api/v1/permissions", options), fetch("/api/v1/locations", options), fetch("/api/v1/auth/me", options), fetch("/api/v1/auth/mfa/status", options)]);
      if (responses.some((response) => response.status === 401 || response.status === 403)) throw new Error(t("identity.permissionDenied"));
      if (responses.some((response) => !response.ok)) throw new Error(t("identity.loadFailed"));
      const [usersPayload, rolesPayload, permissionsPayload, locationsPayload, mePayload, mfaPayload] = await Promise.all(responses.map((response) => response.json()));
      setUsers(usersPayload.users); setRoles(rolesPayload.roles); setPermissions(permissionsPayload.permissions); setLocations(locationsPayload.locations); setMe(mePayload.user); setMfa(mfaPayload);
      setProfileForm({ displayName: mePayload.user.displayName, preferredLocale: mePayload.user.preferredLocale });
    } catch (identityError) { setError(identityError instanceof Error ? identityError.message : t("identity.loadFailed")); }
  }, [t]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadIdentity(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadIdentity]);

  async function submitUser(event: FormEvent) {
    event.preventDefault(); setMessage(""); setError("");
    try {
      const response = await fetch("/api/v1/users", { ...requestOptions(), method: "POST", headers: { ...requestOptions().headers, "Content-Type": "application/json" }, body: JSON.stringify({ ...userForm, locationId: userForm.locationId || null, roleId: userForm.roleId || undefined }) });
      if (!response.ok) throw new Error(t("identity.saveFailed"));
      setMessage(t("identity.userCreated")); setUserForm({ email: "", displayName: "", password: "", preferredLocale: "en-US", locationId: "", roleId: "" }); void loadIdentity();
    } catch (identityError) { setError(identityError instanceof Error ? identityError.message : t("identity.saveFailed")); }
  }

  async function updateUser(event: FormEvent) {
    event.preventDefault(); if (!selectedUser) return;
    setMessage(""); setError("");
    try {
      const response = await fetch(`/api/v1/users/${selectedUser.id}`, { ...requestOptions(), method: "PATCH", headers: { ...requestOptions().headers, "Content-Type": "application/json" }, body: JSON.stringify({ status: selectedUser.status, locationId: selectedUser.locationId }) });
      if (!response.ok) throw new Error(t("identity.saveFailed"));
      setMessage(t("identity.userUpdated")); void loadIdentity();
    } catch (identityError) { setError(identityError instanceof Error ? identityError.message : t("identity.saveFailed")); }
  }

  async function assignRole(userId: string, roleId: string) {
    if (!roleId) return;
    const response = await fetch(`/api/v1/users/${userId}/roles/${roleId}`, { ...requestOptions(), method: "POST" });
    if (!response.ok) setError(t("identity.saveFailed")); else setMessage(t("identity.roleAssigned"));
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault(); if (!me) return;
    const response = await fetch(`/api/v1/users/${me.id}`, { ...requestOptions(), method: "PATCH", headers: { ...requestOptions().headers, "Content-Type": "application/json" }, body: JSON.stringify(profileForm) });
    if (!response.ok) setError(t("identity.saveFailed")); else { setMessage(t("identity.profileSaved")); void loadIdentity(); }
  }

  async function saveRolePermissions(roleId: string, permissionIds: string[]) {
    const response = await fetch(`/api/v1/roles/${roleId}/permissions`, { ...requestOptions(), method: "PUT", headers: { ...requestOptions().headers, "Content-Type": "application/json" }, body: JSON.stringify({ permissionIds }) });
    if (!response.ok) setError(t("identity.saveFailed")); else { setMessage(t("identity.permissionsSaved")); void loadIdentity(); }
  }

  async function resetUserMfa(userId: string) {
    const response = await fetch(`/api/v1/users/${userId}/mfa/reset`, { ...requestOptions(), method: "POST" });
    if (!response.ok) setError(t("identity.saveFailed")); else setMessage(t("identity.mfaReset"));
  }

  async function startMfa() {
    const response = await fetch("/api/v1/auth/mfa/enroll", { ...requestOptions(), method: "POST" });
    if (!response.ok) setError(t("identity.mfaFailed")); else setEnrollment(await response.json());
  }
  async function confirmMfa(event: FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/v1/auth/mfa/confirm", { ...requestOptions(), method: "POST", headers: { ...requestOptions().headers, "Content-Type": "application/json" }, body: JSON.stringify({ code: mfaCode }) });
    if (!response.ok) setError(t("identity.mfaFailed")); else { const payload = await response.json(); setRecoveryCodes(payload.recoveryCodes); setEnrollment(null); setMfaCode(""); setMessage(t("identity.mfaEnabled")); void loadIdentity(); }
  }

  return <>
    <header className="topbar"><div><p className="eyebrow">{t("identity.eyebrow")}</p><h1>{t("identity.title")}</h1><p className="summary">{t("identity.subtitle")}</p></div></header>
    {error && <p className="panel form-message error" role="alert">{error}</p>}
    {message && <p className="panel form-message success" role="status">{message}</p>}
    <div className="identity-tabs" role="tablist">{(["users", "roles", "profile", "mfa"] as const).map((item) => <button key={item} className={tab === item ? "active" : ""} role="tab" aria-selected={tab === item} onClick={() => setTab(item)}>{t(`identity.tabs.${item}`)}</button>)}</div>
    {tab === "users" && <UsersPanel users={users} roles={roles} locations={locations} form={userForm} setForm={setUserForm} onSubmit={submitUser} selected={selectedUser} setSelected={setSelectedUser} onUpdate={updateUser} onResetMfa={resetUserMfa} onAssignRole={assignRole} t={t} />}
    {tab === "roles" && <RolesPanel roles={roles} permissions={permissions} onSave={saveRolePermissions} t={t} />}
    {tab === "profile" && <form className="panel form-grid" onSubmit={saveProfile}><label className="form-field"><span>{t("identity.displayName")}</span><input value={profileForm.displayName} onChange={(event) => setProfileForm({ ...profileForm, displayName: event.target.value })} required /></label><label className="form-field"><span>{t("identity.language")}</span><select value={profileForm.preferredLocale} onChange={(event) => setProfileForm({ ...profileForm, preferredLocale: event.target.value })}>{Object.entries(supportedLocales).map(([code, metadata]) => <option value={code} key={code}>{metadata.label}</option>)}</select></label><div className="editor-actions"><button className="primary-action">{t("identity.saveProfile")}</button></div></form>}
    {tab === "mfa" && <MfaPanel mfa={mfa} enrollment={enrollment} recoveryCodes={recoveryCodes} code={mfaCode} setCode={setMfaCode} onStart={startMfa} onConfirm={confirmMfa} t={t} />}
  </>;
}

function UsersPanel({ users, roles, locations, form, setForm, onSubmit, selected, setSelected, onUpdate, onResetMfa, onAssignRole, t }: { users: User[]; roles: Role[]; locations: Location[]; form: { email: string; displayName: string; password: string; preferredLocale: string; locationId: string; roleId: string }; setForm: (value: typeof form) => void; onSubmit: (event: FormEvent) => void; selected: User | null; setSelected: (user: User | null) => void; onUpdate: (event: FormEvent) => void; onResetMfa: (userId: string) => void; onAssignRole: (userId: string, roleId: string) => void; t: (key: string) => string }) {
  return <section className="content-grid"><article className="panel"><div className="panel-heading"><h2>{t("identity.userList")}</h2><span>{users.length}</span></div><div className="table-wrap"><table><thead><tr><th>{t("identity.name")}</th><th>{t("identity.email")}</th><th>{t("identity.status")}</th><th>{t("identity.location")}</th><th>{t("identity.role")}</th></tr></thead><tbody>{users.map((user) => <tr key={user.id} onClick={() => setSelected(user)}><td><strong>{user.displayName}</strong></td><td>{user.email}</td><td><span className={`status-badge ${user.status === "ACTIVE" ? "ok" : "watch"}`}>{user.status}</span></td><td>{locations.find((location) => location.id === user.locationId)?.name ?? t("identity.allLocations")}</td><td><select aria-label={t("identity.assignRole")} defaultValue="" onClick={(event) => event.stopPropagation()} onChange={(event) => onAssignRole(user.id, event.target.value)}><option value="">{t("identity.assignRole")}</option>{roles.map((role) => <option value={role.id} key={role.id}>{role.name}</option>)}</select></td></tr>)}</tbody></table></div>{selected && <form className="panel nested-panel form-grid" onSubmit={onUpdate}><h3>{selected.displayName}</h3><label className="form-field"><span>{t("identity.status")}</span><select value={selected.status} onChange={(event) => setSelected({ ...selected, status: event.target.value })}><option value="ACTIVE">{t("identity.active")}</option><option value="SUSPENDED">{t("identity.suspended")}</option><option value="ARCHIVED">{t("identity.archived")}</option></select></label><label className="form-field"><span>{t("identity.location")}</span><select value={selected.locationId ?? ""} onChange={(event) => setSelected({ ...selected, locationId: event.target.value || null })}><option value="">{t("identity.allLocations")}</option>{locations.map((location) => <option value={location.id} key={location.id}>{location.name}</option>)}</select></label><div className="editor-actions"><button className="primary-action">{t("identity.saveUser")}</button><button type="button" onClick={() => onResetMfa(selected.id)}>{t("identity.resetMfa")}</button></div></form>}</article><form className="panel form-grid" onSubmit={onSubmit}><h2>{t("identity.createUser")}</h2><label className="form-field"><span>{t("identity.name")}</span><input value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} required /></label><label className="form-field"><span>{t("identity.email")}</span><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></label><label className="form-field"><span>{t("identity.password")}</span><input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} minLength={12} required /></label><label className="form-field"><span>{t("identity.language")}</span><select value={form.preferredLocale} onChange={(event) => setForm({ ...form, preferredLocale: event.target.value })}>{Object.entries(supportedLocales).map(([code, metadata]) => <option value={code} key={code}>{metadata.label}</option>)}</select></label><label className="form-field"><span>{t("identity.location")}</span><select value={form.locationId} onChange={(event) => setForm({ ...form, locationId: event.target.value })}><option value="">{t("identity.allLocations")}</option>{locations.map((location) => <option value={location.id} key={location.id}>{location.name}</option>)}</select></label><label className="form-field"><span>{t("identity.role")}</span><select value={form.roleId} onChange={(event) => setForm({ ...form, roleId: event.target.value })}><option value="">{t("identity.noRole")}</option>{roles.map((role) => <option value={role.id} key={role.id}>{role.name}</option>)}</select></label><div className="editor-actions"><button className="primary-action">{t("identity.create")}</button></div></form></section>;
}

function RolesPanel({ roles, permissions, onSave, t }: { roles: Role[]; permissions: Permission[]; onSave: (roleId: string, permissionIds: string[]) => void; t: (key: string) => string }) {
  return <section className="content-grid"><article className="panel"><h2>{t("identity.roles")}</h2><div className="catalog-list">{roles.map((role) => <RoleEditor key={role.id} role={role} permissions={permissions} onSave={onSave} t={t} />)}</div></article><article className="panel"><h2>{t("identity.permissionCatalog")}</h2><div className="permission-list">{permissions.map((permission) => <span className="status-badge" key={permission.id}>{permission.code}</span>)}</div></article></section>;
}

function RoleEditor({ role, permissions, onSave, t }: { role: Role; permissions: Permission[]; onSave: (roleId: string, permissionIds: string[]) => void; t: (key: string) => string }) {
  const [selected, setSelected] = useState(() => new Set(role.permissions.map(({ permission }) => permission.id)));
  return <form className="role-editor" onSubmit={(event) => { event.preventDefault(); onSave(role.id, [...selected]); }}><div className="panel-heading"><strong>{role.name}</strong><span className="status-badge ok">{selected.size} {t("identity.permissions")}</span></div><div className="permission-checks">{permissions.map((permission) => <label key={permission.id}><input type="checkbox" checked={selected.has(permission.id)} onChange={(event) => { const next = new Set(selected); if (event.target.checked) next.add(permission.id); else next.delete(permission.id); setSelected(next); }} />{permission.code}</label>)}</div><button className="ghost-button">{t("identity.savePermissions")}</button></form>;
}

function MfaPanel({ mfa, enrollment, recoveryCodes, code, setCode, onStart, onConfirm, t }: { mfa: { enrolled: boolean; organizationEnforced: boolean } | null; enrollment: { secret: string; otpauthUri: string } | null; recoveryCodes: string[]; code: string; setCode: (value: string) => void; onStart: () => void; onConfirm: (event: FormEvent) => void; t: (key: string) => string }) { return <section className="content-grid"><article className="panel"><h2>{t("identity.mfaTitle")}</h2><p>{mfa?.enrolled ? t("identity.mfaActive") : t("identity.mfaInactive")}</p><p>{mfa?.organizationEnforced ? t("identity.mfaRequired") : t("identity.mfaOptional")}</p>{!mfa?.enrolled && !enrollment && <button className="primary-action" onClick={onStart}>{t("identity.startMfa")}</button>}{enrollment && <><p>{t("identity.mfaSecret")}</p><code className="secret-code">{enrollment.secret}</code><p>{enrollment.otpauthUri}</p><form className="form-field" onSubmit={onConfirm}><span>{t("identity.mfaCode")}</span><input inputMode="numeric" pattern="[0-9]{6}" value={code} onChange={(event) => setCode(event.target.value)} required /><button className="primary-action">{t("identity.confirmMfa")}</button></form></>}{recoveryCodes.length > 0 && <div className="recovery-codes"><h3>{t("identity.recoveryCodes")}</h3>{recoveryCodes.map((value) => <code key={value}>{value}</code>)}</div>}</article></section>; }
