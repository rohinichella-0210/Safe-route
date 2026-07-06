/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        poppins: ['Poppins', 'system-ui', 'sans-serif'],
        inter: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        // brand safety = teal, caution = amber, sos = red (from design guidelines)
      },
      boxShadow: {
        glass: '0 8px 32px rgba(0,0,0,0.08)',
      },
      backdropBlur: {
        xl: '24px',
      },
      animation: {
        'pulse-sos': 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite',
      },
    },
  },
  plugins: [],
}
