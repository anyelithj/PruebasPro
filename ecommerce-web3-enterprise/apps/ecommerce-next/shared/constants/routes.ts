// routes.ts => rutas de la app en UN solo lugar (DRY): cambiar una URL no obliga a buscar strings por todo el código.
// Funciones para rutas con parámetros => el compilador exige los argumentos (tipado seguro de enlaces).
export const routes = {
  home: "/",
  login: "/login",
  register: "/register",
  forgotPassword: "/forgot-password",
  products: "/products",
  product: (slug: string) => `/products/${slug}`,
  category: (slug: string) => `/categories/${slug}`,
  brand: (slug: string) => `/brands/${slug}`,
  collection: (slug: string) => `/collections/${slug}`,
  search: (q?: string) => (q ? `/search?q=${encodeURIComponent(q)}` : "/search"),
  cart: "/cart",
  checkout: "/checkout",
  checkoutAddress: (id: string) => `/checkout/${id}/address`,
  checkoutPayment: (id: string) => `/checkout/${id}/payment`,
  checkoutConfirm: (id: string) => `/checkout/${id}/confirm`,
  checkoutSuccess: (id: string) => `/checkout/success?session=${id}`,
  account: "/account",
  orders: "/account/orders",
  order: (id: string) => `/account/orders/${id}`,
  wishlist: "/account/wishlist",
  reviews: "/account/reviews",
  loyalty: "/account/loyalty",
  settings: "/account", // "Mi perfil" = ajustes de la cuenta
  notifications: "/account/notifications",
  social: (influencer?: string) => (influencer ? `/social?influencer=${encodeURIComponent(influencer)}` : "/social"),
  socialPost: (id: string) => `/social/${id}`,
  influencers: "/influencers",
  chat: (conversation?: string) => (conversation ? `/chat?conversation=${conversation}` : "/chat"),
  recommendations: "/recommendations",
  // Panel (Fase 7): ADMIN todo; VENDOR solo VENDOR_PANEL_ROUTES (proxy.ts + layout del grupo (admin))
  dashboard: "/dashboard",
  adminAnalytics: "/dashboard/analytics",
  adminProducts: "/dashboard/products",
  adminProductNew: "/dashboard/products/new",
  adminProductEdit: (id: string) => `/dashboard/products/${id}/edit`,
  adminOrders: "/dashboard/orders",
  adminCustomers: "/dashboard/customers",
  adminInventory: "/dashboard/inventory",
  adminMedia: "/dashboard/media",
  adminMarketing: "/dashboard/marketing",
  adminSettings: "/dashboard/settings",
  adminAiAssistant: "/dashboard/ai-assistant",
} as const;

// PANEL_ROLES => roles con acceso al panel; VENDOR_PANEL_ROUTES => secciones del panel abiertas al VENDOR (su catálogo,
// el despacho de sus pedidos y los medios de sus productos), alineadas con RolePolicies.VENDOR de Express.
// "as const" => tuplas de solo lectura con tipos literales (tipado seguro)
export const PANEL_ROLES = ["ADMIN", "VENDOR"] as const;
export const VENDOR_PANEL_ROUTES = [routes.adminProducts, routes.adminOrders, routes.adminMedia] as const;

// panelHome => inicio según el rol (misma regla en usePanelNav.ts de Nuxt): ADMIN y VENDOR entran a la portada del panel
// (/dashboard muestra a cada uno SU resumen: PanelOverview) y el resto a su cuenta — función pura (Strategy por rol)
export const panelHome = (roles: readonly string[]): string =>
  PANEL_ROLES.some((role) => roles.includes(role)) ? routes.dashboard : routes.account;
