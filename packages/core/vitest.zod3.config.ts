import { defineConfig, mergeConfig } from 'vitest/config'
import base from './vitest.config'

// Runs the suite with `zod` resolved to the Zod 3 API that Zod 4 bundles at
// `zod/v3`, so core's own schemas and the Zod 3 conversion path stay covered
// for applications that install Zod 3.
export default mergeConfig(base, defineConfig({
  resolve: {
    alias: [{ find: /^zod$/, replacement: 'zod/v3' }],
  },
}))
