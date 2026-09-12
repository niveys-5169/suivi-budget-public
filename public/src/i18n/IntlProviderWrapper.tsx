import React, { createContext, useContext, useState } from 'react';
import { IntlProvider } from 'react-intl';
import fr from './messages/fr';
import en from './messages/en';

const LOCALES = { fr, en } as const;
export type Locale = keyof typeof LOCALES;

const STORAGE_KEY = 'aurum_locale';
const DEFAULT_LOCALE: Locale =
  (localStorage.getItem(STORAGE_KEY) as Locale) ||
  (navigator.language.startsWith('fr') ? 'fr' : 'en');

interface LocaleCtx {
  locale: Locale;
  setLocale: (l: Locale) => void;
}

const LocaleContext = createContext<LocaleCtx>({ locale: DEFAULT_LOCALE, setLocale: () => {} });

/** Consomme le contexte de locale pour lire/changer la langue de l'app. */
export const useLocale = () => useContext(LocaleContext);

/** Fournit IntlProvider + contexte de locale à toute l'app. */
export const IntlProviderWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    localStorage.setItem(STORAGE_KEY, l);
  };

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      <IntlProvider messages={LOCALES[locale]} locale={locale} defaultLocale="fr">
        {children}
      </IntlProvider>
    </LocaleContext.Provider>
  );
};
