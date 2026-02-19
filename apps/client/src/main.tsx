import { createRoot } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import { i18n } from "@abraxas/shared";
import { App } from "./ui/App";
import "./index.css";

const savedLang = localStorage.getItem("abraxas_lang");
if (savedLang) {
  i18n.changeLanguage(savedLang);
}

createRoot(document.getElementById("root")!).render(
  <I18nextProvider i18n={i18n}>
    <App />
  </I18nextProvider>,
);
