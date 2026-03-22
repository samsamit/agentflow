import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/scripts/generate-schema.ts'],
  format: "esm",
  shims: true,
  loader: {
    ".yaml": "text"
  }
})