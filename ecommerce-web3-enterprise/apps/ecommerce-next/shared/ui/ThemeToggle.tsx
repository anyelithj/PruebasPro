// ThemeToggle.tsx => botón de tema claro/oscuro (36×36, mismo tamaño que IconAction). El tema vive en la cookie
// "theme" (no en localStorage): en localhost la cookie se comparte entre puertos y detrás de Nginx es el mismo origen,
// así Next (panel/login) y Nuxt (tienda) muestran SIEMPRE el mismo tema. Sin cookie => preferencia del sistema
// (lo aplica THEME_SCRIPT de shared/lib/theme.ts en <head>).
"use client";

import { useEffect, useState } from "react";
import { Button } from "./Button";

export function ThemeToggle({ labels }: { labels: { dark: string; light: string } }) {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []); // Lee lo que aplicó THEME_SCRIPT
  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    document.cookie = `theme=${next ? "dark" : "light"}; path=/; max-age=31536000; SameSite=Lax`;
    setDark(next);
  };
  const label = dark ? labels.light : labels.dark;
  return (
    <Button size="icon" variant="ghost" onClick={toggle} title={label} aria-label={label}>
      {/* Sol en modo oscuro (pasar a claro), luna en modo claro (pasar a oscuro) */}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
        {dark ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        ) : (
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        )}
      </svg>
    </Button>
  );
}
