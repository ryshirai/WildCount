/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        night: {
          950: '#060a12',
          900: '#0b1220',
          800: '#111b2e',
          700: '#1a2740',
          600: '#243552',
        },
        gold: {
          50: '#fbf6e9',
          100: '#f5ead0',
          200: '#e8d5a3',
          300: '#d4b76a',
          400: '#c9a84c',
          500: '#b8923a',
          600: '#9a7630',
        },
        teal: {
          accent: '#1a6b6b',
          soft: '#2a8a8a',
          deep: '#0f4a4a',
        },
        sand: {
          DEFAULT: '#e8dcc4',
          dim: '#c4b49a',
        },
      },
      fontFamily: {
        sans: ['"Noto Sans JP"', 'system-ui', 'sans-serif'],
        display: ['Cinzel', '"Noto Sans JP"', 'serif'],
      },
      boxShadow: {
        gold: '0 0 0 1px rgba(201, 168, 76, 0.35), 0 8px 24px rgba(0,0,0,0.45)',
        'gold-glow': '0 0 20px rgba(201, 168, 76, 0.35)',
        panel: '0 8px 32px rgba(0,0,0,0.5)',
      },
      backgroundImage: {
        desert:
          'radial-gradient(ellipse 80% 50% at 50% 100%, rgba(80,55,30,0.45) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 50% 0%, rgba(20,40,80,0.5) 0%, transparent 50%)',
      },
    },
  },
  plugins: [],
}
