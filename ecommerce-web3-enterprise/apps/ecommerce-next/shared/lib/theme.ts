// theme.ts => script de tema para <head> (módulo de servidor: un string, no un componente de cliente).
// Lee la cookie "theme" (compartida con la tienda Nuxt); sin cookie => tema CLARO por defecto (decisión de producto:
// no se sigue la preferencia del sistema operativo); se ejecuta
// ANTES de pintar para evitar el parpadeo claro->oscuro. ThemeToggle cambia la clase y la cookie.
export const THEME_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )theme=(dark|light)/);var d=!!m&&m[1]==="dark";document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;
