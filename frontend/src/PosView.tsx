import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatCurrency, formatNumber } from "./i18n/format";
import i18n from "./i18n/config";

type CartItem = { id: string; name: string; price: number; quantity: number };
const products = [
  {
    id: "amoxicillin",
    name: "Amoxicillin 500 mg",
    barcode: "400000001",
    price: 8.5,
  },
  {
    id: "metformin",
    name: "Metformin 850 mg",
    barcode: "400000002",
    price: 5.2,
  },
  {
    id: "vitamin",
    name: "Vitamin D3 2000 IU",
    barcode: "400000003",
    price: 12.75,
  },
];

export function PosView() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [paymentType, setPaymentType] = useState("CASH");
  const locale = i18n.resolvedLanguage ?? "en-US";
  const results = products.filter((product) =>
    `${product.name} ${product.barcode}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart],
  );
  const total = Math.max(0, subtotal - discount);
  function add(product: Pick<CartItem, "id" | "name" | "price">) {
    setCart((items) =>
      items.some((item) => item.id === product.id)
        ? items.map((item) =>
            item.id === product.id
              ? { ...item, quantity: item.quantity + 1 }
              : item,
          )
        : [...items, { ...product, quantity: 1 }],
    );
    setQuery("");
  }
  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">{t("pos.eyebrow")}</p>
          <h1>{t("pos.title")}</h1>
          <p className="summary">{t("pos.subtitle")}</p>
        </div>
        <button>{t("pos.hold")}</button>
      </header>
      <section className="pos-layout">
        <article className="panel pos-products">
          <label className="pos-search">
            <span>{t("pos.scanOrSearch")}</span>
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("pos.searchPlaceholder")}
            />
          </label>
          <div className="pos-results">
            {results.map((product) => (
              <button
                className="product-result"
                key={product.id}
                onClick={() => add(product)}
              >
                <span>
                  <strong>{product.name}</strong>
                  <small>{product.barcode}</small>
                </span>
                <strong>{formatCurrency(product.price, locale, "EUR")}</strong>
              </button>
            ))}
          </div>
        </article>
        <article className="panel pos-cart">
          <div className="panel-heading">
            <h2>{t("pos.cart")}</h2>
            <span>
              {formatNumber(
                cart.reduce((sum, item) => sum + item.quantity, 0),
                locale,
              )}{" "}
              {t("pos.units")}
            </span>
          </div>
          {cart.length === 0 ? (
            <p>{t("pos.emptyCart")}</p>
          ) : (
            <div className="cart-lines">
              {cart.map((item) => (
                <div className="cart-line" key={item.id}>
                  <span>
                    <strong>{item.name}</strong>
                    <small>{formatCurrency(item.price, locale, "EUR")}</small>
                  </span>
                  <div>
                    <button
                      onClick={() =>
                        setCart((items) =>
                          items.flatMap((current) =>
                            current.id === item.id && current.quantity === 1
                              ? []
                              : current.id === item.id
                                ? [
                                    {
                                      ...current,
                                      quantity: current.quantity - 1,
                                    },
                                  ]
                                : [current],
                          ),
                        )
                      }
                    >
                      −
                    </button>
                    <b>{item.quantity}</b>
                    <button onClick={() => add(item)}>+</button>
                  </div>
                  <strong>
                    {formatCurrency(item.price * item.quantity, locale, "EUR")}
                  </strong>
                </div>
              ))}
            </div>
          )}
          <div className="pos-total">
            <label>
              {t("pos.discount")}
              <input
                type="number"
                min="0"
                value={discount}
                onChange={(event) => setDiscount(Number(event.target.value))}
              />
            </label>
            <p>
              <span>{t("pos.subtotal")}</span>
              <strong>{formatCurrency(subtotal, locale, "EUR")}</strong>
            </p>
            <p className="grand-total">
              <span>{t("pos.total")}</span>
              <strong>{formatCurrency(total, locale, "EUR")}</strong>
            </p>
            <label>
              {t("pos.paymentType")}
              <select
                value={paymentType}
                onChange={(event) => setPaymentType(event.target.value)}
              >
                <option value="CASH">{t("pos.cash")}</option>
                <option value="CARD">{t("pos.card")}</option>
                <option value="MOBILE">{t("pos.mobile")}</option>
                <option value="OTHER">{t("pos.other")}</option>
              </select>
            </label>
            <button className="primary-action" disabled={!cart.length}>
              {t("pos.completeSale")}
            </button>
          </div>
        </article>
      </section>
    </>
  );
}
