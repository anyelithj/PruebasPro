<!--
  page.vue (/config/shipping) => transportadoras, envío gratis e impuestos por región (Guard ADMIN). Misma carga
  compartida de configuración que /config/payments (clave "store-config": una sola petición).
-->
<script setup lang="ts">
import AdminHeading from "~~/shared/ui/AdminHeading.vue"; // Título + descripción desde el manifiesto del menú (igual que Next)
import { useStoreConfig } from "~~/features/config/composable/useStoreConfig";
import ShippingCarrierForm from "~~/features/config/ui/ShippingCarrierForm.vue";
import TaxRatesForm from "~~/features/config/ui/TaxRatesForm.vue";
import Skeleton from "~~/shared/ui/Skeleton.vue";
import CarrierStatsTable from "~~/features/config/ui/CarrierStatsTable.vue"; // RF-10.7 desempeño por transportadora
import ReturnsPolicyForm from "~~/features/config/ui/ReturnsPolicyForm.vue"; // RF-12.6 política de devoluciones

definePageMeta({ layout: "admin", middleware: ["auth", "rbac"], roles: ["ADMIN"] });

const { section, save, pending } = useStoreConfig();
const shipping = section("shipping");
const tax = section("tax");
const returns = section("returns");
</script>

<template>
  <div class="flex flex-col gap-6">
    <AdminHeading nav-key="shipping" />
    <Skeleton v-if="pending" class="h-96 w-full" />
    <template v-else>
      <section aria-labelledby="shipping-title" class="flex flex-col gap-3 rounded-xl border bg-white p-4">
        <h2 id="shipping-title" class="text-lg font-semibold">{{ $t("config.shipping.title") }}</h2>
        <ShippingCarrierForm :key="JSON.stringify(shipping)" :value="shipping" @save="save('shipping', $event)" />
      </section>
      <section aria-labelledby="carrier-stats-title" class="flex flex-col gap-3 rounded-xl border bg-white p-4">
        <h2 id="carrier-stats-title" class="text-lg font-semibold">{{ $t("config.shipping.statsTitle") }}</h2>
        <CarrierStatsTable />
      </section>
      <section aria-labelledby="tax-title" class="flex flex-col gap-3 rounded-xl border bg-white p-4">
        <h2 id="tax-title" class="text-lg font-semibold">{{ $t("config.tax.title") }}</h2>
        <TaxRatesForm :key="JSON.stringify(tax)" :value="tax" @save="save('tax', $event)" />
      </section>
      <section aria-labelledby="returns-title" class="flex flex-col gap-3 rounded-xl border bg-white p-4">
        <h2 id="returns-title" class="text-lg font-semibold">{{ $t("config.returns.title") }}</h2>
        <ReturnsPolicyForm :key="JSON.stringify(returns)" :value="returns" @save="save('returns', $event)" />
      </section>
    </template>
  </div>
</template>
