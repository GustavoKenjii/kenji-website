import { defineConfig } from 'vite'

export default defineConfig({
  server: { port: 5173 },
  preview: { port: 4173 },
  // Vite's modulepreload runtime reads this global; without the shim the
  // production bundle throws `__DEFINES__ is not defined` and nothing runs.
  define: { __DEFINES__: '({})' }
})
