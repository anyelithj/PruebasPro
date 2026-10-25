<!--
  [TEMPLATE-METHOD] layout de auth: navbar + split (ilustración | formulario).
  El formulario NO va centrado: vive en la columna derecha, y la ilustración
  vectorial (SVG en código, sin imagen externa) ocupa la izquierda.
  En móvil la ilustración se oculta y el formulario ocupa todo el ancho.
-->
<script setup lang="ts">
import Navbar from '~/components/layout/Navbar.vue'
import FemaleDeveloperIllustration from '~/components/illustrations/FemaleDeveloperIllustration.vue'
</script>

<template>
  <div class="auth">
    <Navbar />

    <main class="auth__main">
      <!-- Columna izquierda: ilustración vectorial + claim. Decorativa en móvil → se oculta. -->
      <section class="auth__aside" aria-hidden="true">
        <FemaleDeveloperIllustration />
        <p class="auth__claim">
          Código limpio, café caliente y una idea que se vuelve producto.
        </p>
      </section>

      <!-- Columna derecha: el formulario que inyecte la página. -->
      <section class="auth__panel">
        <slot />
      </section>
    </main>
  </div>
</template>

<style scoped>
.auth {
  min-height: 100vh;
  background:
    radial-gradient(circle at 15% 20%, rgba(165, 98, 255, 0.18), transparent 45%),
    radial-gradient(circle at 85% 80%, rgba(59, 130, 246, 0.18), transparent 45%);
}
:global(.dark) .auth {
  background-color: rgb(15 23 42);
}

.auth__main {
  display: grid;
  grid-template-columns: 1fr;
  align-items: center;
  gap: 2rem;
  max-width: 80rem;
  margin: 0 auto;
  padding: 6.5rem 1.5rem 3rem; /* deja aire bajo el navbar fijo */
  min-height: 100vh;
}

.auth__aside {
  display: none;
}

.auth__claim {
  margin-top: 1.5rem;
  text-align: center;
  font-size: 1rem;
  font-weight: 600;
  color: rgb(71 85 105);
}
:global(.dark) .auth__claim {
  color: rgb(148 163 184);
}

.auth__panel {
  width: 100%;
  max-width: 30rem;
  justify-self: center;
}

/* Desde tablet: dos columnas reales. El form deja de estar centrado. */
@media (min-width: 900px) {
  .auth__main {
    grid-template-columns: 1.05fr 0.95fr;
    gap: 3rem;
  }
  .auth__aside {
    display: block;
  }
  .auth__panel {
    justify-self: end;
  }
}
</style>
