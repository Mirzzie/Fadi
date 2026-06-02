import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      maxWidth: {
        shell: "1180px",
      },
    },
  },
};

export default config;
