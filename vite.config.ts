import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'

// Relative base so the build works from any GitHub Pages path
// (user site at `/`, or project site at `/<repo>/`) without reconfiguration.
// Routing is hash-based, so no server-side rewrite is needed either.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
})
