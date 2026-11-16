import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import "./language-context.css";
import { ENGLISH } from "./translations";

export type Language = "pt" | "en";

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (portugueseText: string) => string;
}

const STORAGE_KEY = "forecast-language";
const LanguageContext = createContext<LanguageContextValue | null>(null);

function readSavedLanguage(): Language | null {
  if (typeof window === "undefined") return null;

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved === "pt" || saved === "en" ? saved : null;
  } catch {
    return null;
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, updateLanguage] = useState<Language>(
    () => readSavedLanguage() ?? "pt",
  );
  const [hasChosenLanguage, setHasChosenLanguage] = useState(
    () => readSavedLanguage() !== null,
  );
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!hasChosenLanguage && !dialog.open) dialog.showModal();
    if (hasChosenLanguage && dialog.open) dialog.close();
  }, [hasChosenLanguage]);

  const setLanguage = useCallback((nextLanguage: Language) => {
    updateLanguage(nextLanguage);
    setHasChosenLanguage(true);
    try {
      window.localStorage.setItem(STORAGE_KEY, nextLanguage);
    } catch {
      // The selection still applies for this session when storage is unavailable.
    }
  }, []);

  const t = useCallback(
    (portugueseText: string) =>
      language === "pt" ? portugueseText : ENGLISH[portugueseText] ?? portugueseText,
    [language],
  );

  const value = useMemo(
    () => ({ language, setLanguage, t }),
    [language, setLanguage, t],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
      {!hasChosenLanguage && (
          <dialog
            ref={dialogRef}
            className="language-choice-dialog"
            aria-labelledby="language-choice-title"
            aria-describedby="language-choice-description"
            onCancel={(event) => event.preventDefault()}
          >
            <span className="language-choice-brand">ForeCast<span>.</span></span>
            <h1 id="language-choice-title">Escolha seu idioma / Choose your language</h1>
            <p id="language-choice-description">
              Selecione uma opção para continuar. / Select an option to continue.
            </p>
            <div className="language-choice-actions">
              <button type="button" onClick={() => setLanguage("pt")} autoFocus>
                Português
              </button>
              <button type="button" onClick={() => setLanguage("en")}>
                English
              </button>
            </div>
          </dialog>
      )}
    </LanguageContext.Provider>
  );
}

// Fora do LanguageProvider (testes de componentes isolados, por exemplo) o texto
// fica no português original. O app real sempre é envolvido pelo provider em main.tsx.
const PORTUGUESE_FALLBACK: LanguageContextValue = {
  language: "pt",
  setLanguage: () => {},
  t: (portugueseText) => portugueseText,
};

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext) ?? PORTUGUESE_FALLBACK;
}
