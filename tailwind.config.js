/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        ink: {
          900: "#0f0d0a",
          800: "#1a1612",
          700: "#241f1a",
          600: "#332b24",
          500: "#4a3f35",
        },
        paper: {
          50: "#f5ecd6",
          100: "#ede0c2",
          200: "#e8dcc0",
          300: "#d9c9a3",
          400: "#c4b088",
        },
        cinnabar: {
          400: "#c84545",
          500: "#a83232",
          600: "#8a2828",
          700: "#6e1f1f",
        },
        pine: {
          400: "#4f6262",
          500: "#3a4a4a",
          600: "#2c3838",
          700: "#1f2828",
        },
        gold: {
          300: "#e0c47e",
          400: "#c9a961",
          500: "#a8884a",
          600: "#8a6e3a",
        },
        jade: {
          400: "#5a8a72",
          500: "#3f6b58",
        },
      },
      fontFamily: {
        brush: ['"Ma Shan Zheng"', '"KaiTi"', 'serif'],
        serif: ['"Noto Serif SC"', '"STSong"', 'serif'],
        number: ['"ZCOOL XiaoWei"', '"Noto Serif SC"', 'serif'],
      },
      boxShadow: {
        seal: "0 2px 0 rgba(0,0,0,0.4), 0 4px 12px rgba(168,50,50,0.35)",
        scroll: "0 0 0 1px rgba(60,40,20,0.5), 0 8px 32px rgba(0,0,0,0.5), inset 0 0 60px rgba(120,90,50,0.15)",
        glow: "0 0 24px rgba(201,169,97,0.4)",
      },
      backgroundImage: {
        'paper-grain': "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.55 0 0 0 0 0.45 0 0 0 0 0.3 0 0 0 0.08 0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E\")",
      },
      keyframes: {
        shimmer: {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        inkSpread: {
          "0%": { transform: "scale(0.8)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        sandFall: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
      },
      animation: {
        shimmer: "shimmer 3s ease-in-out infinite",
        float: "float 4s ease-in-out infinite",
        inkSpread: "inkSpread 0.5s ease-out",
        sandFall: "sandFall 3s linear infinite",
      },
    },
  },
  plugins: [],
};
