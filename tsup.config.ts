import { defineConfig } from 'tsup'

const external = ['payload', '@payloadcms/ui', 'next', 'react', 'react/jsx-runtime']

export default defineConfig([
  // Server entry, protocol and the preview page script: plain ESM, no React.
  // No `clean` here: the configs build in parallel, so `pnpm build` empties dist/ first.
  {
    entry: { index: 'src/index.ts', message: 'src/message.ts', preview: 'src/preview/index.ts' },
    format: 'esm',
    dts: true,
    target: 'es2022',
    external,
  },
  // The admin listener: a client component, so its module keeps the directive
  {
    entry: { client: 'src/client.ts' },
    format: 'esm',
    dts: true,
    target: 'es2022',
    external,
    banner: { js: "'use client'" },
  },
  // The preview page script for a plain <script> tag: window.PayloadPreviewClick
  {
    entry: { preview: 'src/preview/index.ts' },
    format: 'iife',
    globalName: 'PayloadPreviewClick',
    outExtension: () => ({ js: '.global.js' }),
    target: 'es2020',
    minify: true,
  },
])
