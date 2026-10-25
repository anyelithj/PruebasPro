// theme.ts => script de tema para <head> (módulo de servidor: un string, no un componente de cliente).
// Lee la cookie "theme" (compartida con la tienda Nuxt) o, sin cookie, la preferencia del sistema; se ejecuta
// ANTES de pintar para evitar el parpadeo claro->oscuro. ThemeToggle cambia la clase y la cookie.
export const THEME_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )theme=(dark|light)/);var d=m?m[1]==="dark":matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;
