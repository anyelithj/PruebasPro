import type { StorybookConfig } from '@storybook/react-vite'
import { mergeConfig } from 'vite'

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
  framework: '@storybook/react-vite',
  core: { disableTelemetry: true },
  viteFinal: (viteConfig) =>
    mergeConfig(viteConfig, {
      // Valores ficticios: los componentes importan Firebase, pero Storybook nunca se conecta a un proyecto real.
      define: {
        'import.meta.env.VITE_FIREBASE_API_KEY': JSON.stringify('storybook-clave-ficticia'),
        'import.meta.env.VITE_FIREBASE_PROJECT_ID': JSON.stringify('storybook'),
      },
    }),
}

export default config
