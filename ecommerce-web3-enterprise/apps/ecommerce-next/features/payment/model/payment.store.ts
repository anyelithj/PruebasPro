// payment.store.ts (Redux Toolkit) => evita confirmar dos veces el mismo pago (doble clic o reintento impaciente)
// mientras Stripe procesa: estado global porque el botón y el mensaje de estado son componentes distintos.
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { createSliceHook } from "@/shared/lib/store";

interface PaymentProcessingState {
  processingIntentId: string | null;
}

const initialState: PaymentProcessingState = { processingIntentId: null };

export const paymentProcessingSlice = createSlice({
  name: "paymentProcessing",
  initialState,
  reducers: {
    start: (state, action: PayloadAction<string>) => {
      state.processingIntentId = action.payload;
    },
    finish: () => initialState,
  },
});

export const usePaymentProcessing = createSliceHook(paymentProcessingSlice);
