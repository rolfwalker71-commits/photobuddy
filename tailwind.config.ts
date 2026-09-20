import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: "hsl(var(--card))",
        "card-foreground": "hsl(var(--card-foreground))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        primary: "hsl(var(--primary))",
        "primary-foreground": "hsl(var(--primary-foreground))",
        accent: "hsl(var(--accent))",
        "accent-foreground": "hsl(var(--accent-foreground))",
        ring: "hsl(var(--ring))",
        border: "hsl(var(--border))",
        destructive: "hsl(var(--destructive))",
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.375rem",
        "3xl": "1.75rem",
      },
      boxShadow: {
        /* The glass edges live in the shadow tokens, so existing markup that
           says `bg-card shadow-card` gets a lit top edge, a shaded bottom
           edge and depth without touching the markup. See globals.css. */
        card: [
          "inset 0 1px 0 0 var(--glass-specular)",
          "inset 0 -1px 0 0 var(--glass-shade)",
          "var(--glass-shadow-panel)",
        ].join(", "),
        dock: [
          "inset 0 1px 0 0 var(--glass-specular)",
          "inset 0 -1px 0 0 var(--glass-shade)",
          "var(--glass-shadow-chrome)",
        ].join(", "),
        /* For glass that lies on top of a photo or a map. */
        media: [
          "inset 0 1px 0 0 hsl(0 0% 100% / 0.22)",
          "0 0.25rem 1rem hsl(200 18% 8% / 0.25)",
        ].join(", "),
      },
      backdropBlur: {
        chrome: "1.5rem",
        panel: "1rem",
      },
      fontFamily: {
        sans: [
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "Noto Sans",
          "sans-serif",
        ],
      },
      transitionTimingFunction: {
        /* iOS springs settle: fast out, gentle in. */
        glass: "cubic-bezier(0.2, 0.9, 0.3, 1)",
      },
      keyframes: {
        "glass-rise": {
          from: { opacity: "0", transform: "translateY(1.5rem) scale(0.97)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "glass-fade": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
      animation: {
        "glass-rise": "glass-rise 320ms cubic-bezier(0.2, 0.9, 0.3, 1) both",
        "glass-fade": "glass-fade 200ms ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
