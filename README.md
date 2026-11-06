**English** · [Français](README.fr.md)

# payload-preview-click

Click a block or a field in the [Payload](https://payloadcms.com) live preview: the edit form scrolls to it,
expands it and focuses it. Click a link to another page: that page opens in the admin.

> **Alpha.** The API may change before 1.0.

A free, MIT-licensed alternative to part of Payload's
[Visual Editor](https://payloadcms.com/enterprise/visual-editor) (Enterprise). It does not edit in place: it takes
editors to the right spot in the regular form. Not affiliated with Payload.

## Install

```bash
pnpm add payload-preview-click
```

Requires Payload 3, Next.js ≥ 15 and React 19 on the admin side. The preview side has no dependencies.

## 1. Admin

```ts
// payload.config.ts
import { previewClickPlugin } from 'payload-preview-click'

export default buildConfig({
  plugins: [
    previewClickPlugin({ collections: { pages: 'layout' } }), // collection → its blocks field
  ],
})
```

Then run `pnpm payload generate:importmap`. Live preview must be set up for the collection
(`admin.livePreview.url`).

## 2. Preview page

**Mark the blocks:** a comment before each block, and one after the last.

```ts
import { blockMarker, BLOCKS_END } from 'payload-preview-click/preview'

blockMarker(3, 'faq') // '<!--preview-block:3:faq-->', 3 = row of the block
```

Or, in React and similar, attributes on the block's root: `blockAttributes(isPreview, index, blockType)`.

**Mark the fields:** paths relative to the block, array rows by index. Outside the preview, nothing is added.

```ts
import { editable } from 'payload-preview-click/preview'

const edit = editable(isPreview) // or Astro.locals, with a `preview` flag
edit('title')                    // { 'data-preview-field': 'title' }
edit(`items.${i}.question`)      // { 'data-preview-field': 'items.2.question' }
```

**Run the script**, on the preview page only:

```ts
import { initPreviewClick, pageLinks, pageResolver } from 'payload-preview-click/preview'

initPreviewClick({
  cmsOrigin: 'https://cms.example.com', // messages are posted to this origin only
  path: 'layout',                       // same blocks field as in the plugin
  current: { collection: 'pages', id: 4, locale: 'en' },
  // Optional: which links open which document. Without it, links are blocked.
  resolvePage: pageResolver({
    collection: 'pages',
    links: pageLinks([{ id: 4, paths: { en: '/about/', fr: '/fr/a-propos/' } }]),
  }),
})
```

Other options: `labels` (texts shown to the editor), `color`, `keepState`. Without a bundler, load
`payload-preview-click/preview.global.js` and call `window.PayloadPreviewClick.initPreviewClick()`.

### Astro

Set `Astro.locals.preview = true` in the preview route, then:

```astro
---
// RenderBlocks.astro
import { blockMarker, BLOCKS_END } from 'payload-preview-click/preview'
const preview = !!Astro.locals.preview
---
{Astro.props.blocks.map((block, i) => (
  <>{preview && <Fragment set:html={blockMarker(i, block.blockType)} />}<Block block={block} /></>
))}
{preview && <Fragment set:html={BLOCKS_END} />}
```

```astro
---
// Faq.astro
import { editable } from 'payload-preview-click/preview'
const edit = editable(Astro.locals)
---
<h2 {...edit('title')}>{Astro.props.block.title}</h2>
```

```astro
<!-- PreviewHead.astro, in <head> on the preview only -->
<script>
  import { initPreviewClick } from 'payload-preview-click/preview'
  initPreviewClick({ cmsOrigin: import.meta.env.PUBLIC_CMS_URL, path: 'layout' })
</script>
```

## How it works

In the preview, the first click selects a block, each next click goes one level down (array row, then field), and
Escape goes back up. Each selection is posted to the admin:

```ts
{ type: 'payload-preview-click', path: 'layout', index: 3, field?: 'items.2.question' }
{ type: 'payload-preview-navigate', collection: 'pages', id: 4, locale?: 'fr' }
```

Links do not leave the preview: a link to a known page opens it in the admin (⌘/Ctrl + click inside a block), other
links and forms are blocked.

## Security

- The admin only reads messages from the origin of the live preview URL; the preview only posts to `cmsOrigin`.
- Paths, ids and locales are strictly validated; navigation stays within the edited collection.
- This package does not protect your preview route: sign its links and serve drafts with `no-store` and `noindex`.

## Limitations (alpha)

- Collections only, one blocks field per collection.
- Relies on Payload's DOM ids and `@payloadcms/ui` hooks; tested with Payload 3.93 and Next 16.
- Fields in a closed tab cannot be reached.
- Navigation assumes autosave on drafts.

## Development

```bash
pnpm install && pnpm test && pnpm build
```

To try it in a Next.js app, install it with `file:../payload-preview-click`, not `link:` (Turbopack does not
follow symlinks outside the project root).

## License

[MIT](LICENSE)
