"use client";

import { useLanguage } from "@/lib/language-context.jsx";
import { cn } from "@/lib/utils";

export function LanguageToggle({ className = "" }) {
  const { lang, setLanguage } = useLanguage();

  return (
    <div
      className={cn(
        "flex items-center rounded-lg border border-border/60 bg-muted/40 p-0.5 gap-0.5",
        className
      )}
      role="group"
      aria-label="Select language"
    >
      <button
        onClick={() => setLanguage("en")}
        data-testid="lang-en"
        aria-pressed={lang === "en"}
        className={cn(
          "px-3 py-1.5 rounded-md text-xs font-bold tracking-wide transition-all duration-200 select-none",
          lang === "en"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
        )}
      >
        EN
      </button>
      <button
        onClick={() => setLanguage("zh")}
        data-testid="lang-zh"
        aria-pressed={lang === "zh"}
        className={cn(
          "px-3 py-1.5 rounded-md text-xs font-bold tracking-wide transition-all duration-200 select-none",
          lang === "zh"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
        )}
      >
        中文
      </button>
    </div>
  );
}
