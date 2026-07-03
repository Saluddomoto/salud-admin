import type { Config } from 'tailwindcss'
import sharedConfig from '@salud/tailwind-config'

const config: Config = {
  ...sharedConfig,
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
}

export default config
