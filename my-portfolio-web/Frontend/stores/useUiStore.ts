// [FLUX][SRP] estado UI global (modal abierto, menú mobile) — Pinia.
import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useUiStore = defineStore('ui', () => {
  const mobileMenuOpen = ref(false);
  const activeModal = ref<string | null>(null);

  function toggleMobileMenu(): void {
    mobileMenuOpen.value = !mobileMenuOpen.value;
  }

  function openModal(id: string): void {
    activeModal.value = id;
  }

  function closeModal(): void {
    activeModal.value = null;
  }

  return { mobileMenuOpen, activeModal, toggleMobileMenu, openModal, closeModal };
});
