<!--
  PaymentGatewayForm.vue (Vue 3 + Vee-Validate + Zod) => métodos de pago de la tienda: Stripe (llave PÚBLICA y
  descriptor del extracto), cripto (redes y billeteras receptoras: lista dinámica con useFieldArray) y contra entrega.
  Seguridad: no hay campo para la llave secreta (vive solo en el .env de Express). Patrón Factory + Adapter (toPayment).
-->
<script setup lang="ts">
import { useFieldArray, useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import type { PaymentConfig } from "~~/entities/pwa/model/pwa.types";
import Input from "~~/shared/ui/Input.vue";
import Button from "~~/shared/ui/Button.vue";
import ActionButton from "~~/shared/ui/ActionButton.vue"; // Acción de fila solo con ícono (ancho uniforme)
import { paymentSchema, toPayment } from "../lib/config.validator";

const props = defineProps<{ value: PaymentConfig }>();
const emit = defineEmits<{ save: [value: Record<string, unknown>] }>();
const NETWORKS = [
  { value: "ethereum", label: "Ethereum" },
  { value: "polygon", label: "Polygon" },
  { value: "solana", label: "Solana" },
  { value: "bitcoin", label: "Bitcoin" }, // RF-08.9 pagos en BTC
];
const bank = props.value.bankTransfer;

const { handleSubmit, isSubmitting, values } = useForm({
  validationSchema: toTypedSchema(paymentSchema),
  initialValues: {
    stripeEnabled: props.value.stripe.enabled,
    publishableKey: props.value.stripe.publishableKey ?? "",
    statementDescriptor: props.value.stripe.statementDescriptor ?? "",
    cryptoEnabled: props.value.crypto.enabled,
    networks: props.value.crypto.networks,
    cashOnDelivery: props.value.cashOnDelivery,
    bankEnabled: bank?.enabled ?? false,
    bankName: bank?.bankName ?? "",
    accountType: bank?.accountType ?? "",
    accountNumber: bank?.accountNumber ?? "",
    holder: bank?.holder ?? "",
    holderId: bank?.holderId ?? "",
  },
});
// useFieldArray => agrega/quita billeteras manteniendo la validación por índice
const { fields, push, remove } = useFieldArray<{ network: string; address: string }>("networks");
const submit = handleSubmit((form) => emit("save", toPayment(form)));
</script>

<template>
  <form class="flex flex-col gap-5" novalidate @submit.prevent="submit">
    <fieldset class="flex flex-col gap-3 rounded-lg border bg-white p-4">
      <legend class="px-1 text-sm font-semibold">Stripe</legend>
      <Input name="stripeEnabled" as="checkbox" :label="$t('config.payment.stripeEnabled')" />
      <template v-if="values.stripeEnabled">
        <Input name="publishableKey" :label="$t('config.payment.publishableKey')" :hint="$t('config.payment.publishableHint')" />
        <Input name="statementDescriptor" :label="$t('config.payment.descriptor')" :hint="$t('config.payment.descriptorHint')" />
      </template>
    </fieldset>
    <fieldset class="flex flex-col gap-3 rounded-lg border bg-white p-4">
      <legend class="px-1 text-sm font-semibold">{{ $t("config.payment.crypto") }}</legend>
      <Input name="cryptoEnabled" as="checkbox" :label="$t('config.payment.cryptoEnabled')" />
      <template v-if="values.cryptoEnabled">
        <div v-for="(field, index) in fields" :key="field.key" class="grid grid-cols-1 items-end gap-2 sm:grid-cols-[160px_1fr_auto]">
          <Input :name="`networks[${index}].network`" as="select" :label="$t('config.payment.network')" :options="NETWORKS" />
          <Input :name="`networks[${index}].address`" :label="$t('config.payment.wallet')" />
          <ActionButton icon="delete" :label="$t('common.delete')" @click="remove(index)" />
        </div>
        <Button variant="secondary" size="sm" class="self-start" :disabled="fields.length >= 5" @click="push({ network: 'polygon', address: '' })">{{ $t("common.new") }}</Button>
      </template>
    </fieldset>
    <Input name="cashOnDelivery" as="checkbox" :label="$t('config.payment.cod')" />
    <!-- RF-08.3 transferencia bancaria: datos públicos de la cuenta receptora (se muestran al comprador al pagar) -->
    <fieldset class="flex flex-col gap-3 rounded-lg border bg-white p-4">
      <legend class="px-1 text-sm font-semibold">{{ $t("config.payment.bank") }}</legend>
      <Input name="bankEnabled" as="checkbox" :label="$t('config.payment.bankEnabled')" />
      <div v-if="values.bankEnabled" class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input name="bankName" :label="$t('config.payment.bankName')" />
        <Input name="accountType" :label="$t('config.payment.accountType')" />
        <Input name="accountNumber" :label="$t('config.payment.accountNumber')" />
        <Input name="holder" :label="$t('config.payment.holder')" />
        <Input name="holderId" :label="$t('config.payment.holderId')" />
      </div>
    </fieldset>
    <Button type="submit" class="self-end" :loading="isSubmitting">{{ $t("common.save") }}</Button>
  </form>
</template>
