import type { Config } from 'tailwindcss'

// Salud 共通 Tailwind 設定
// apps/admin と apps/portal で共有するデザイントークン
const config: Omit<Config, 'content'> = {
  theme: {
    extend: {
      colors: {
        // Saludブランドカラー（インディゴ系）
        brand: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5', // メインカラー
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
      },
      fontFamily: {
        sans: [
          'Noto Sans JP',   // 日本語フォント
          'Inter',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
        ],
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
}

export default config
