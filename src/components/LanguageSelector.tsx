import { useLanguage } from '../context/LanguageContext';

export default function LanguageSelector() {
  const { language, toggleLanguage } = useLanguage();

  return (
    <button
      onClick={toggleLanguage}
      className="fixed top-4 right-4 z-50 flex items-center justify-center w-12 h-12 rounded-full bg-[var(--color-brand-bg)] border border-[var(--color-brand-heading)]/20 shadow-md transition-all duration-300 hover:shadow-lg hover:bg-black/5 text-[var(--color-brand-heading)] font-semibold uppercase tracking-wider"
      aria-label="Toggle language"
    >
      {language}
    </button>
  );
}
