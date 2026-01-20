import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import translationVI from './locales/vi/translation.json';
import translationEN from './locales/en/translation.json';
import translationHI from './locales/hi/translation.json';

const resources = {
  vi: {
    translation: translationVI
  },
  en: {
    translation: translationEN
  },
  hi: {
    translation: translationHI
  }
};

i18n
  .use(LanguageDetector) // Tự động phát hiện ngôn ngữ từ browser
  .use(initReactI18next) // Kết nối với React
  .init({
    resources,
    fallbackLng: 'vi', // Ngôn ngữ mặc định nếu không tìm thấy
    lng: localStorage.getItem('i18nextLng') || 'vi', // Ngôn ngữ hiện tại
    debug: false,
    
    interpolation: {
      escapeValue: false // React đã tự escape
    },
    
    detection: {
      // Thứ tự ưu tiên phát hiện ngôn ngữ
      order: ['localStorage', 'navigator', 'htmlTag'],
      // Cache ngôn ngữ đã chọn
      caches: ['localStorage']
    }
  });

// Listen for language change events from AuthContext
window.addEventListener('languageChanged', (event) => {
  if (event.detail && event.detail.language) {
    i18n.changeLanguage(event.detail.language);
  }
});

export default i18n;
