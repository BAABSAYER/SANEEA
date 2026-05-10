import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enTranslations from './locales/en.json';
import arTranslations from './locales/ar.json';

const resources = {
  en: {
    translation: enTranslations
  },
  ar: {
    translation: arTranslations
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'ar',
    
    interpolation: {
      escapeValue: false
    },
    
    detection: {
      order: ['localStorage', 'htmlTag', 'navigator'],
      caches: ['localStorage']
    }
  });

const applyDocumentDirection = (language: string) => {
  const normalizedLanguage = language?.startsWith('ar') ? 'ar' : 'en';
  document.documentElement.dir = normalizedLanguage === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = normalizedLanguage;
};

if (!localStorage.getItem('i18nextLng')) {
  i18n.changeLanguage('ar');
}

applyDocumentDirection(i18n.resolvedLanguage || i18n.language || 'ar');
i18n.on('languageChanged', applyDocumentDirection);

export default i18n;
