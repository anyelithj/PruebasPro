// routes.ts => rutas de la app en un solo lugar (DRY: ningún componente escribe URLs a mano; un cambio = una línea).
// Funciones para rutas dinámicas => tipado seguro del parámetro (slug/id).
export const routes = {
  home: "/", // Portada de la tienda
  login: "/login",
  products: "/products",
  visualSearch: "/search", // RF-06.2 / RF-06.4 búsqueda por imagen
  product: (slug: string) => `/products/${slug}`,
  cart: "/cart",
  landing: (slug: string) => `/landing/${slug}`,
  landings: "/landing",
  cmsPages: "/cms-page",
  cmsPage: (slug: string) => `/cms-page/${slug}`,
  cmsPageNew: "/cms-page/new",
  cmsPageEdit: (slug: string) => `/cms-page/${slug}/edit`,
  lookbooks: "/cms-lookbook",
  lookbook: (slug: string) => `/cms-lookbook/${slug}`,
  collections: "/cms-collection",
  collection: (slug: string) => `/cms-collection/${slug}`,
  collectionNew: "/cms-collection/new",
  collectionEdit: (slug: string) => `/cms-collection/${slug}/edit`,
  brands: "/brands", // RF-05.4 landing SEO de marcas
  brand: (slug: string) => `/brands/${slug}`,
  categories: "/categories",
  category: (slug: string) => `/categories/${slug}`,
  events: "/events",
  event: (slug: string) => `/events/${slug}`,
  blog: "/blog",
  blogPost: (slug: string) => `/blog/${slug}`,
  socialProducts: "/social/products",
  socialProduct: (id: string) => `/social/products/${id}`,
  socialCheckout: "/social/checkout",
  socialAnalytics: "/social/analytics",
  influencers: "/social/influencers",
  influencer: (handle: string) => `/social/influencers/${handle}`,
  socialChannels: "/social/channels", // RF-19.1 / 19.7 / 19.11
  liveAdmin: "/social/live", // RF-19.9 gestión de transmisiones
  lives: "/live", // RF-19.9 Live Shopping en la tienda
  help: "/help", // RF-21.2 centro de ayuda (preguntas frecuentes)
  contact: "/contact", // RF-21.2 formulario de contacto
  live: (id: string) => `/live/${id}`,
  pwaInstall: "/pwa/install",
  pwaOffline: "/pwa/offline",
  pwaNotifications: "/pwa/notifications",
  pwaCache: "/pwa/cache",
  configPayments: "/config/payments",
  configShipping: "/config/shipping",
} as const;
