import { i18n } from "@abraxas/shared";
import { createRoot } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import { AudioProvider } from "./contexts/AudioContext";
import { App } from "./ui/App";

const savedLang = localStorage.getItem("abraxas_lang");
if (savedLang) {
  i18n.changeLanguage(savedLang);
}

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Could not find root element");

createRoot(rootElement).render(
  <I18nextProvider i18n={i18n}>
    <AudioProvider>
      <App />
    </AudioProvider>
  </I18nextProvider>,
);
