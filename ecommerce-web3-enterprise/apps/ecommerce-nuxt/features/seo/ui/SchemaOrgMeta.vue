<!--
  SchemaOrgMeta.vue (Vue 3, sin interfaz visible) => inserta JSON-LD de Schema.org en el <head> según el tipo de
  página: BlogPosting, Event, CollectionPage, Organization o Brand. Patrón Adapter (datos del dominio -> vocabulario
  Schema.org) + Strategy (un constructor por tipo). Se emite en el SSR: rich results sin JavaScript.
-->
<script setup lang="ts">
const props = defineProps<{
  type: "BlogPosting" | "Event" | "CollectionPage" | "Organization" | "Brand";
  data: Record<string, unknown>;
}>();
const { public: config } = useRuntimeConfig();

// BUILDERS => una función por tipo (agregar un tipo = una entrada: OCP)
const BUILDERS: Record<typeof props.type, (data: Record<string, unknown>) => Record<string, unknown>> = {
  BlogPosting: (data) => ({ headline: data["title"], description: data["description"], datePublished: data["date"], author: { "@type": "Person", name: data["author"] }, image: data["image"], mainEntityOfPage: data["url"] }),
  Event: (data) => ({
    name: data["title"],
    description: data["description"],
    startDate: data["startsAt"],
    endDate: data["endsAt"],
    eventAttendanceMode: data["online"] ? "https://schema.org/OnlineEventAttendanceMode" : "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    location: data["online"] ? { "@type": "VirtualLocation", url: data["url"] ?? config.siteUrl } : { "@type": "Place", name: data["location"], address: data["location"] },
    image: data["image"],
    organizer: { "@type": "Organization", name: "eCommerce Web3", url: config.siteUrl },
  }),
  CollectionPage: (data) => ({ name: data["title"], description: data["description"], url: data["url"] }),
  Organization: () => ({ name: "eCommerce Web3", url: config.siteUrl, logo: `${config.siteUrl}/favicon.ico` }),
  // RF-05.4 Brand (schema.org/Brand): nombre, descripción, logo y página de la marca
  Brand: (data) => ({ name: data["title"], description: data["description"], logo: data["image"], url: data["url"] }),
};

useHead(() => ({ script: [{ type: "application/ld+json", innerHTML: JSON.stringify({ "@context": "https://schema.org", "@type": props.type, ...BUILDERS[props.type](props.data) }) }] }));
</script>

<template>
  <!-- Sin marcado visible: solo metadatos en el <head> -->
  <span hidden />
</template>
