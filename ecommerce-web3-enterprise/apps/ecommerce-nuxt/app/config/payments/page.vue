<!--
  page.vue (/config/payments) => configuración de pagos y moneda (Guard ADMIN; Express vuelve a exigir ADMIN). Los
  formularios se montan cuando llega la configuración ("key" => se reinician con los valores guardados).
-->
<script setup lang="ts">
import AdminHeading from "~~/shared/ui/AdminHeading.vue"; // Título + descripción desde el manifiesto del menú (igual que Next)
import { useStoreConfig } from "~~/features/config/composable/useStoreConfig";
import PaymentGatewayForm from "~~/features/config/ui/PaymentGatewayForm.vue";
import StoreCurrencyForm from "~~/features/config/ui/StoreCurrencyForm.vue";
import HelpCenterForm from "~~/features/config/ui/HelpCenterForm.vue"; // RF-21.2 preguntas frecuentes
import Skeleton from "~~/shared/ui/Skeleton.vue";

definePageMeta({ layout: "admin", middleware: ["auth", "rbac"], roles: ["ADMIN"] });

const { section, save, pending } = useStoreConfig();
const payment = section("payment");
const currency = section("currency");
const help = section("help");
</script>

<template>
  <div class="flex flex-col gap-6">
    <AdminHeading nav-key="payments" />
    <Skeleton v-if="pending" class="h-96 w-full" />
    <template v-else>
      <section aria-labelledby="payment-title" class="flex flex-col gap-3 rounded-xl border bg-white p-4">
        <h2 id="payment-title" class="text-lg font-semibold">{{ $t("config.payment.title") }}</h2>
        <PaymentGatewayForm :key="JSON.stringify(payment)" :value="payment" @save="save('payment', $event)" />
      </section>
      <section aria-labelledby="currency-title" class="flex flex-col gap-3 rounded-xl border bg-white p-4">
        <h2 id="currency-title" class="text-lg font-semibold">{{ $t("config.currency.title") }}</h2>
        <StoreCurrencyForm :key="JSON.stringify(currency)" :value="currency" @save="save('currency', $event)" />
      </section>
      <section aria-labelledby="help-title" class="flex flex-col gap-3 rounded-xl border bg-white p-4">
        <h2 id="help-title" class="text-lg font-semibold">{{ $t("config.help.title") }}</h2>
        <HelpCenterForm :key="JSON.stringify(help)" :value="help" @save="save('help', $event)" />
      </section>
    </template>
  </div>
</template>
