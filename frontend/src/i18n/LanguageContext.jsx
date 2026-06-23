import { createContext, useContext, useState } from "react";
import { translations } from "./translations";

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(
    () => localStorage.getItem("milal_lang") || "en"
  );

  function setLanguage(l) {
    setLang(l);
    localStorage.setItem("milal_lang", l);
  }

  const t = (key) => translations[lang]?.[key] ?? translations["en"][key] ?? key;

  return (
    <LanguageContext.Provider value={{ lang, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
