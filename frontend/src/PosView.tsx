import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatCurrency, formatNumber } from "./i18n/format";
import i18n from "./i18n/config";

type Product = { id: string; sku: string | null; sellingPrice: string | number | null; translations: Array<{ displayName: string; genericName: string | null; locale: string }>; barcodes: Array<{ value: string }> };
type CartItem = { product: Product; name: string; price: number; quantity: number };
type Location = { id: string; name: string; code: string };
type Register = { id: string; name: string; code: string; active: boolean; locationId: string };
type Shift = { id: string; openingCash: string | number; expectedCash: string | number | null; countedCash: string | number | null; variance: string | number | null; status: "OPEN" | "CLOSED" };

const requestOptions = () => ({ credentials: "include" as RequestCredentials, headers: { "X-UI-Locale": i18n.resolvedLanguage ?? "en-US" } });

export function PosView() {
  const { t } = useTranslation();
  const locale = i18n.resolvedLanguage ?? "en-US";
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [payments, setPayments] = useState<Array<{ type: string; amount: string }>>([{ type: "CASH", amount: "" }]);
  const [heldCart, setHeldCart] = useState<CartItem[] | null>(null);
  const [refundSaleId, setRefundSaleId] = useState("");
  const [refundItemId, setRefundItemId] = useState("");
  const [refundQuantity, setRefundQuantity] = useState("1");
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [location, setLocation] = useState<Location | null>(null);
  const [currency, setCurrency] = useState("EUR");
  const [registers, setRegisters] = useState<Register[]>([]);
  const [registerId, setRegisterId] = useState("");
  const [shift, setShift] = useState<Shift | null>(null);
  const [openingCash, setOpeningCash] = useState("0");
  const [countedCash, setCountedCash] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([fetch("/api/v1/locations", requestOptions()), fetch("/api/v1/organization", requestOptions())])
      .then(async ([locationsResponse, organizationResponse]) => {
        if (!locationsResponse.ok || !organizationResponse.ok) throw new Error(t("pos.loadFailed"));
        const locationsPayload = await locationsResponse.json() as { locations: Location[] };
        const organizationPayload = await organizationResponse.json() as { organization: { currency: string } };
        const selectedLocation = locationsPayload.locations[0] ?? null;
        setLocation(selectedLocation);
        setCurrency(organizationPayload.organization.currency);
        if (selectedLocation) {
          const registersResponse = await fetch(`/api/v1/pos/registers?locationId=${selectedLocation.id}`, requestOptions());
          if (!registersResponse.ok) throw new Error(t("pos.loadFailed"));
          const registersPayload = await registersResponse.json() as { registers: Register[] };
          setRegisters(registersPayload.registers);
          const firstRegister = registersPayload.registers.find((item) => item.active);
          if (firstRegister) setRegisterId(firstRegister.id);
        }
      })
      .catch(() => setError(t("pos.loadFailed")));
  }, [t]);

  useEffect(() => {
    if (!registerId) {
      const clearTimer = window.setTimeout(() => setShift(null), 0);
      return () => window.clearTimeout(clearTimer);
    }
    fetch(`/api/v1/pos/shifts/current?registerId=${registerId}`, requestOptions())
      .then(async (response) => { if (!response.ok) throw new Error(t("pos.loadFailed")); const payload = await response.json() as { shift: Shift | null }; setShift(payload.shift); })
      .catch(() => setError(t("pos.loadFailed")));
  }, [registerId, t]);

  useEffect(() => {
    const search = query.trim();
    if (!search) {
      const clearTimer = window.setTimeout(() => setProducts([]), 0);
      return () => window.clearTimeout(clearTimer);
    }
    const timer = window.setTimeout(() => {
      setLoading(true);
      fetch(`/api/v1/pos/products?search=${encodeURIComponent(search)}&locale=${encodeURIComponent(locale)}`, requestOptions())
        .then(async (response) => {
          if (!response.ok) throw new Error(t("pos.searchFailed"));
          const payload = await response.json() as { products: Product[] };
          setProducts(payload.products);
        })
        .catch((requestError) => setError(requestError instanceof Error ? requestError.message : t("pos.searchFailed")))
        .finally(() => setLoading(false));
    }, 180);
    return () => window.clearTimeout(timer);
  }, [locale, query, t]);

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);
  const total = Math.max(0, subtotal - discount);
  const paidTotal = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  function nameFor(product: Product) { return product.translations.find((item) => item.locale === locale)?.displayName ?? product.translations[0]?.displayName ?? product.sku ?? t("pos.unnamedProduct"); }
  function add(product: Product) {
    const name = nameFor(product); const price = Number(product.sellingPrice ?? 0);
    setCart((items) => items.some((item) => item.product.id === product.id) ? items.map((item) => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item) : [...items, { product, name, price, quantity: 1 }]);
    setQuery(""); setProducts([]); setError("");
  }
  async function openShift() {
    if (!location || !registerId) return;
    setLoading(true); setError("");
    const response = await fetch("/api/v1/pos/shifts/open", { ...requestOptions(), method: "POST", headers: { ...requestOptions().headers, "Content-Type": "application/json" }, body: JSON.stringify({ locationId: location.id, registerId, openingCash: Number(openingCash) }) });
    const result = await response.json().catch(() => ({})) as { shift?: Shift; message?: string };
    if (!response.ok) setError(result.message ?? t("pos.shiftFailed")); else setShift(result.shift ?? null);
    setLoading(false);
  }
  async function closeShift() {
    if (!shift || countedCash === "") return;
    setLoading(true); setError("");
    const response = await fetch(`/api/v1/pos/shifts/${shift.id}/close`, { ...requestOptions(), method: "POST", headers: { ...requestOptions().headers, "Content-Type": "application/json" }, body: JSON.stringify({ countedCash: Number(countedCash) }) });
    const result = await response.json().catch(() => ({})) as { shift?: Shift; message?: string };
    if (!response.ok) setError(result.message ?? t("pos.shiftFailed")); else setShift(result.shift ?? null);
    setLoading(false);
  }
  async function completeSale() {
    if (!cart.length || !location || !shift) return;
    setLoading(true); setError(""); setMessage("");
    const response = await fetch("/api/v1/pos/sales", { ...requestOptions(), method: "POST", headers: { ...requestOptions().headers, "Content-Type": "application/json" }, body: JSON.stringify({ locationId: location.id, registerId, cashShiftId: shift.id, currency, items: cart.map((item) => ({ productId: item.product.id, quantity: item.quantity, discountAmount: item.product.id === cart[0].product.id ? discount : 0 })), payments: payments.map((payment) => ({ type: payment.type, amount: Number(payment.amount) })) }) });
    const result = await response.json().catch(() => ({})) as { sale?: { id: string; receiptNumber: string }; message?: string };
    if (!response.ok) setError(result.message ?? t("pos.completeFailed")); else { setMessage(`${t("pos.saleCompleted")} ${result.sale?.receiptNumber ?? ""}`); if (result.sale?.id) window.open(`/api/v1/documents/sales/${result.sale.id}/receipt?locale=${encodeURIComponent(locale)}`, "_blank", "noopener,noreferrer"); setCart([]); setDiscount(0); setPayments([{ type: "CASH", amount: "" }]); }
    setLoading(false);
  }
  async function refundSale() {
    if (!refundSaleId || !refundItemId || !location) return;
    setLoading(true); setError("");
    const response = await fetch("/api/v1/pos/refunds", { ...requestOptions(), method: "POST", headers: { ...requestOptions().headers, "Content-Type": "application/json" }, body: JSON.stringify({ saleId: refundSaleId, locationId: location.id, reason: "Customer return", items: [{ saleItemId: refundItemId, quantity: Number(refundQuantity) }] }) });
    const result = await response.json().catch(() => ({})) as { message?: string };
    if (!response.ok) setError(result.message ?? t("pos.refundFailed")); else { setMessage(t("pos.refundCompleted")); setRefundSaleId(""); setRefundItemId(""); }
    setLoading(false);
  }
  function holdCart() { if (!cart.length) return; setHeldCart(cart); setCart([]); setMessage(t("pos.saleHeld")); }
  function resumeCart() { if (!heldCart) return; setCart(heldCart); setHeldCart(null); setMessage(""); }
  return <>
    <header className="topbar"><div><p className="eyebrow">{t("pos.eyebrow")}</p><h1>{t("pos.title")}</h1><p className="summary">{t("pos.subtitle")}</p></div><div className="pos-shift-controls"><button onClick={holdCart} disabled={!cart.length || loading}>{t("pos.hold")}</button>{heldCart && <button onClick={resumeCart} disabled={loading}>{t("pos.resume")}</button>}<button onClick={() => setSummaryOpen(!summaryOpen)} disabled={!shift}>{t("pos.shiftSummary")}</button><select value={registerId} onChange={(event) => setRegisterId(event.target.value)} disabled={loading}><option value="">{t("pos.selectRegister")}</option>{registers.map((register) => <option value={register.id} key={register.id}>{register.name}</option>)}</select>{shift ? <><span className="status-badge ok">{t("pos.shiftOpen")}</span><input aria-label={t("pos.countedCash")} type="number" min="0" value={countedCash} onChange={(event) => setCountedCash(event.target.value)} placeholder={t("pos.countedCash")} /><button onClick={() => void closeShift()} disabled={loading || countedCash === ""}>{t("pos.closeShift")}</button></> : <><input aria-label={t("pos.openingCash")} type="number" min="0" value={openingCash} onChange={(event) => setOpeningCash(event.target.value)} placeholder={t("pos.openingCash")} /><button onClick={() => void openShift()} disabled={loading || !registerId}>{t("pos.openShift")}</button></>}<span>{location?.name ?? t("pos.noLocation")}</span></div></header>
    {error && <p className="panel form-message error" role="alert">{error}</p>}{message && <p className="panel form-message success" role="status">{message}</p>}
    <section className="pos-layout">
      <article className="panel pos-products"><label className="pos-search"><span>{t("pos.scanOrSearch")}</span><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("pos.searchPlaceholder")} /></label><div className="pos-results">{loading && <p>{t("pos.searching")}</p>}{products.map((product) => <button className="product-result" key={product.id} onClick={() => add(product)}><span><strong>{nameFor(product)}</strong><small>{product.barcodes[0]?.value ?? product.sku ?? ""}</small></span><strong>{formatCurrency(Number(product.sellingPrice ?? 0), locale, currency)}</strong></button>)}</div></article>
      <article className="panel pos-cart"><div className="panel-heading"><h2>{t("pos.cart")}</h2><span>{formatNumber(cart.reduce((sum, item) => sum + item.quantity, 0), locale)} {t("pos.units")}</span></div>{cart.length === 0 ? <p>{t("pos.emptyCart")}</p> : <div className="cart-lines">{cart.map((item) => <div className="cart-line" key={item.product.id}><span><strong>{item.name}</strong><small>{formatCurrency(item.price, locale, currency)}</small></span><div><button onClick={() => setCart((items) => items.flatMap((current) => current.product.id === item.product.id && current.quantity === 1 ? [] : current.product.id === item.product.id ? [{ ...current, quantity: current.quantity - 1 }] : [current]))}>−</button><b>{item.quantity}</b><button onClick={() => add(item.product)}>+</button></div><strong>{formatCurrency(item.price * item.quantity, locale, currency)}</strong></div>)}</div>}
        <div className="pos-total"><label>{t("pos.discount")}<input type="number" min="0" value={discount} onChange={(event) => setDiscount(Number(event.target.value))} /></label><p><span>{t("pos.subtotal")}</span><strong>{formatCurrency(subtotal, locale, currency)}</strong></p><p className="grand-total"><span>{t("pos.total")}</span><strong>{formatCurrency(total, locale, currency)}</strong></p><div className="payment-list"><span className="field-label">{t("pos.payments")}</span>{payments.map((payment, index) => <div className="payment-row" key={index}><select value={payment.type} onChange={(event) => setPayments((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, type: event.target.value } : item))}><option value="CASH">{t("pos.cash")}</option><option value="CARD">{t("pos.card")}</option><option value="MOBILE">{t("pos.mobile")}</option><option value="OTHER">{t("pos.other")}</option></select><input type="number" min="0" value={payment.amount} onChange={(event) => setPayments((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, amount: event.target.value } : item))} placeholder={formatCurrency(total, locale, currency)} />{payments.length > 1 && <button onClick={() => setPayments((items) => items.filter((_, itemIndex) => itemIndex !== index))}>−</button>}</div>)}<button className="text-button" onClick={() => setPayments((items) => [...items, { type: "CARD", amount: "" }])}>{t("pos.addPayment")}</button><small>{t("pos.paid")}: {formatCurrency(paidTotal, locale, currency)}</small></div><button className="primary-action" disabled={!cart.length || !location || !shift || loading || Math.abs(paidTotal - total) > 0.001} onClick={() => void completeSale()}>{t("pos.completeSale")}</button></div>
      </article>
    </section>
    {summaryOpen && shift && <section className="panel pos-summary-panel"><div className="panel-heading"><h2>{t("pos.shiftSummary")}</h2><button onClick={() => setSummaryOpen(false)}>{t("actions.close")}</button></div><p>{t("pos.openingCash")}: <strong>{formatCurrency(Number(shift.openingCash), locale, currency)}</strong></p><p>{t("pos.expectedCash")}: <strong>{shift.expectedCash === null ? t("pos.pending") : formatCurrency(Number(shift.expectedCash), locale, currency)}</strong></p><p>{t("pos.countedCash")}: <strong>{shift.countedCash === null ? t("pos.pending") : formatCurrency(Number(shift.countedCash), locale, currency)}</strong></p><p>{t("pos.variance")}: <strong>{shift.variance === null ? t("pos.pending") : formatCurrency(Number(shift.variance), locale, currency)}</strong></p></section>}
    <section className="panel pos-refund-panel"><div className="panel-heading"><h2>{t("pos.refund")}</h2></div><div className="refund-fields"><input value={refundSaleId} onChange={(event) => setRefundSaleId(event.target.value)} placeholder={t("pos.saleId")} /><input value={refundItemId} onChange={(event) => setRefundItemId(event.target.value)} placeholder={t("pos.saleItemId")} /><input type="number" min="1" value={refundQuantity} onChange={(event) => setRefundQuantity(event.target.value)} /><button onClick={() => void refundSale()} disabled={loading || !refundSaleId || !refundItemId}>{t("pos.processRefund")}</button></div></section>
  </>;
}
