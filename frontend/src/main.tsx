import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./i18n/config";
import "./styles.css";
import { App } from "./App";
import { AuthView } from "./AuthView";

export function AuthGate() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetch("/api/v1/auth/me", { credentials: "include" })
        .then((response) => setAuthenticated(response.ok))
        .catch(() => setAuthenticated(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  if (authenticated === null) return <AuthView onAuthenticated={() => setAuthenticated(true)} />;
  return authenticated ? <App /> : <AuthView onAuthenticated={() => setAuthenticated(true)} />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthGate />
  </StrictMode>,
);
