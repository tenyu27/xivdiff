import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'

// Relative base so the build is position-independent — it is served from the
// Worker's root in production and from `vite preview` locally without
// reconfiguration. Routing is hash-based, so no server-side rewrite is needed.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  server: {
    // In production the SPA and the proxy are one Worker on one origin, so the
    // client calls `/api/fflogs` relatively. Vite serves the SPA itself during
    // development, so the same path is forwarded to `wrangler dev` (started
    // separately with `yarn worker:dev`) to keep that origin single here too.
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
})
