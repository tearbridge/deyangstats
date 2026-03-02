/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        wow: ['"Cinzel"', 'serif'],
      },
    },
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: ['dracula'],
  },
};
