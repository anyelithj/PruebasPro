// // utils/seo.ts
// export const generateMetaTags = (title: string, description: string) => {
//   return [
//     { name: 'description', content: description },
//     { property: 'og:title', content: title },
//     { property: 'og:description', content: description },
//     { name: 'twitter:title', content: title },
//     { name: 'twitter:description', content: description }
//   ]
// }

// ─────────────────────────────────────────────
// 📁 utils/seo.ts
// export function getSeoMeta({ title, description }: { title: string; description: string }) {
//   return {
//     title,
//     meta: [
//       { name: 'description', content: description },
//       { name: 'robots', content: 'index, follow' },
//       { charset: 'utf-8' },
//       { name: 'viewport', content: 'width=device-width, initial-scale=1' },
//     ],
//     htmlAttrs: {
//       lang: 'es'
//     },
//   }
// }
export function getSeoMeta({ title, description }: { title: string; description: string }) {
  return {
    title,
    meta: [
      { name: 'description', content: description },
      { name: 'author', content: 'Tu Nombre' },
      { name: 'keywords', content: 'portfolio, Vue, Nuxt, Frontend' },
      { name: 'robots', content: 'index, follow' },
      { charset: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    ],
    htmlAttrs: {
      lang: 'es',
    },
  }
}

// export const getSeoMeta = (title: string, description: string) => [
//   { name: 'description', content: description },
//   { property: 'og:title', content: title },
//   { property: 'og:description', content: description },
//   { property: 'og:type', content: 'website' },
//   { name: 'twitter:card', content: 'summary_large_image' }
// ]
