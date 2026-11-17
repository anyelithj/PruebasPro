// admin-nav.test.mjs => el menú compartido no puede dejar funciones inaccesibles: cada pestaña real de cada sección de
// Next es exactamente un ítem, las rutas de los ítems existen en su app y los permisos por rol no cambian.
// Ejecutar: pnpm test:scripts
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const nav = JSON.parse(read("packages/shared-types/src/admin-nav.json"));
const items = nav.groups.flatMap((group) => group.items.map((item) => ({ ...item, group })));
const UI = "apps/ecommerce-next/features/admin-dashboard/ui";
const SECTIONS = { orders: "OrdersAdmin", products: "ProductsAdmin", customers: "CustomersAdmin", inventory: "InventoryAdmin", marketing: "MarketingAdmin", analytics: "AnalyticsPanel", "ai-assistant": "AiAssistantAdmin", settings: "SettingsAdmin" };

// visible => misma regla que navVisible de AdminSidebar.tsx y usePanelNav.ts
const visible = (item, roles) => roles.includes("ADMIN") || (!item.adminOnly && (Boolean(item.group.everyone || item.everyone) || roles.includes("VENDOR")));

test("cada pestaña real es exactamente un ítem de su sección", () => {
  for (const [section, file] of Object.entries(SECTIONS)) {
    const source = read(`${UI}/${file}.tsx`);
    const block = source.slice(source.indexOf("<AdminTabs"), source.indexOf("/>\n  );", source.indexOf("<AdminTabs")));
    const ids = [...block.matchAll(/\{ id: "([\w-]+)", label:/g)].map((match) => match[1]);
    assert.ok(ids.length > 0, `${section} sin pestañas`);
    const owned = items.filter((item) => item.path.startsWith(`/dashboard/${section}?`)).map((item) => item.path.split("?tab=")[1]);
    assert.deepEqual([...owned].sort(), [...ids].sort(), section);
  }
});

test("claves únicas y cada sección con ícono", () => {
  assert.equal(new Set(items.map((item) => item.key)).size, items.length);
  for (const group of nav.groups) assert.ok(nav.icons[group.icon], group.key);
});

test("la ruta de cada ítem existe en la app que la sirve", () => {
  for (const item of items) {
    const path = item.path.split("?")[0];
    const candidates = item.app === "nuxt"
      ? [`apps/ecommerce-nuxt/app${path}/page.vue`]
      : ["(admin)", "(account)", "(ai)"].map((group) => `apps/ecommerce-next/app/[locale]/${group}${path}/page.tsx`);
    assert.ok(candidates.some((candidate) => existsSync(new URL(`../${candidate}`, import.meta.url))), `${item.key}: ${item.path}`);
  }
});

test("los permisos por rol no cambian", () => {
  const keys = (roles) => items.filter((item) => visible(item, roles)).map((item) => item.key).sort();
  const account = ["accLoyalty", "accNotifications", "accOrders", "accOverview", "accReviews", "accWishlist", "chatbot", "recommendations"];
  assert.deepEqual(keys(["CUSTOMER"]), account);
  assert.equal(keys(["ADMIN"]).length, items.length);
  // VENDOR: solo rutas abiertas en proxy.ts (VENDOR_PANEL_ROUTES) dentro de /dashboard
  const allowed = ["/dashboard", "/dashboard/products", "/dashboard/orders", "/dashboard/media"];
  for (const item of items.filter((entry) => entry.app === "next" && entry.path.startsWith("/dashboard") && visible(entry, ["VENDOR"]))) assert.ok(allowed.includes(item.path.split("?")[0]), item.key);
  // VENDOR ve las pestañas que tenía antes del reordenamiento (pedidos, envíos, productos, marcas) y ninguna solo-ADMIN
  for (const key of ["orders", "shipments", "products", "brands", "media", "socialProducts", "influencers", "liveShopping", "content", "cmsLandings", "notifications", "socialAnalytics"]) assert.ok(keys(["VENDOR"]).includes(key), key);
  for (const key of ["invoices", "dian", "refunds", "transfers", "settings", "audit", "webhooks"]) assert.ok(!keys(["VENDOR"]).includes(key), key);
});

test("contraste AA de los tokens del tema del panel (índigo sobre blanco y secundario)", () => {
  const lum = (rgb) => { const [r, g, b] = rgb.map((c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
  const css = read("apps/ecommerce-nuxt/app/assets/css/tailwind.css");
  const block = css.slice(css.indexOf(":root:has(#panel-sidebar) {"));
  const token = (name) => block.match(new RegExp(`--${name}: ([0-9]+) ([0-9]+) ([0-9]+)`)).slice(1, 4).map(Number);
  assert.ok(ratio(token("brand"), token("brand-foreground")) >= 4.5);
  assert.ok(ratio(token("secondary"), token("secondary-foreground")) >= 4.5);
});
