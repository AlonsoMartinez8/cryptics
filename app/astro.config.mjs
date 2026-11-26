// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

// En GitHub Actions el workflow define SITE (https://usuario.github.io)
// y BASE_PATH (/nombre-del-repo). En local se usa la raíz.
export default defineConfig({
  output: "static",
  site: process.env.SITE || undefined,
  base: process.env.BASE_PATH || "/",
  integrations: [react()],
  vite: { plugins: [tailwindcss()] },
});
