**English** · [Français](README.fr.md)

# payload-preview-click

Click a block or a field in the [Payload](https://payloadcms.com) live preview, and the edit form scrolls to it,
expands it and focuses it. Click a link to another page of the site, and that page opens in the admin.

> **Alpha.** The API and the message protocol may change before 1.0. See [Limitations](#alpha-limitations).

- **Admin side:** a Payload 3 plugin that adds a small listener to the edit view of the collections you choose.
- **Preview side:** a framework-agnostic browser script (~9 kB minified, no dependencies) for the page your live
  preview shows. It works with Astro, Next.js, plain HTML or anything else that renders HTML.

## How it compares to Payload's Visual Editor

Payload offers a [Visual Editor](https://payloadcms.com/enterprise/visual-editor) as part of Payload Enterprise.
This package is an independent, MIT-licensed project, not affiliated with Payload, and it does less:

|                                        | payload-preview-click                  | Payload Visual Editor          |
| -------------------------------------- | -------------------------------------- | ------------------------------ |
| License                                | MIT, free                              | Payload Enterprise             |
| Click in the preview → open in the form | Yes: block, array row or field         | Yes                            |
| Edit content in place, in the preview  | No: you edit in the regular form       | Yes                            |
| Open linked pages from the preview     | Yes, within the edited collection      | See Payload's documentation    |
| Front-end requirements                 | Mark blocks and fields while rendering | See Payload's documentation    |

If you need in-place editing and official support, look at Payload Enterprise. If you want editors to find what
they see in the preview in the form, this package does that.

## How it works

1. The preview page marks the elements of each block (a comment before them, or attributes on their root), and
   the elements that render a field (`data-preview-field="items.2.title"`).
2. The script outlines blocks on hover. The first click in a block selects it, each further click inside it goes
   one level down (an array row, then a field), and Escape goes back up. Each selection is posted to the admin
   window with `postMessage`.
3. The listener in the admin checks where the message comes from, expands every collapsed row on the way, scrolls
   to the target, flashes it and focuses its input.
4. Links do not leave the preview. A link to another page of the site opens that page in the admin instead (on a
   plain click outside the blocks, on ⌘/Ctrl + click inside a block, where a plain click selects). Other links and
   form submissions are blocked, with a short notice.

## Install

```bash
pnpm add payload-preview-click
```

Peer dependencies: `payload` and `@payloadcms/ui` ^3, `next` ≥ 15, `react` ^19. A preview site that only uses the
`/preview` entry does not need any of them.

## Admin setup

Live preview must be configured for the collection (`admin.livePreview.url`), pointing at the route of your site
that renders drafts.

```ts
// payload.config.ts
import { buildConfig } from 'payload'
import { previewClickPlugin } from 'payload-preview-click'

export default buildConfig({
  // ...
  plugins: [
    previewClickPlugin({
      // collection slug → path of the blocks field the preview marks
      collections: { pages: 'layout' },
    }),
  ],
})
```

Then regenerate the import map, so it includes `payload-preview-click/client#PreviewClickListener`:

```bash
pnpm payload generate:importmap
```

| Option        | Type                     | Description                                                         |
| ------------- | ------------------------ | ------------------------------------------------------------------- |
| `collections` | `Record<string, string>` | Collection slug → path of its blocks field, e.g. `{ pages: 'layout' }`. |
| `disabled`    | `boolean`                | Leave the config unchanged.                                         |

The listener is added to `admin.components.edit.beforeDocumentControls` of each listed collection, after the
components already there.

## Preview setup

Three steps, all in the page your live preview renders: mark the blocks, mark the fields, run the script.

### 1. Mark the blocks

Either render a comment before the elements of each block, and one after the last block:

```ts
import { blockMarker, BLOCKS_END } from 'payload-preview-click/preview'

blockMarker(3, 'faq') // '<!--preview-block:3:faq-->'
BLOCKS_END            // '<!--preview-block:end-->'
```

Comments add no wrapper, so the preview keeps the exact markup and CSS of the site. Every element between a
marker and the next one belongs to the block.

Or, where rendering comments is awkward (React, Vue…), spread attributes on the root element of each block:

```tsx
import { blockAttributes } from 'payload-preview-click/preview'

<section {...blockAttributes(isPreview, index, block.blockType)}>…</section>
// isPreview → data-preview-block="3" data-preview-block-type="faq"; otherwise nothing
```

The index is the row of the block in the blocks field, starting at 0.

### 2. Mark the fields

`editable(when, prefix?)` returns a function of a field path that gives the attributes to spread on the element.
Paths are relative to the block and use the Payload field names, with array rows by index. `when` is a boolean, or
an object with a `preview` flag such as `Astro.locals`. Outside the preview it returns `{}`, so the published site
is unchanged.

```ts
const edit = editable(isPreview)
edit('title')            // { 'data-preview-field': 'title' }
edit(`items.${i}`)       // { 'data-preview-field': 'items.2' }
editable(isPreview, 'items.2')('title') // nested component: 'items.2.title'
```

Make the element of an array row contain the elements of its fields: each click goes one level down.

### 3. Run the script

With a bundler:

```ts
import { initPreviewClick, pageLinks, pageResolver } from 'payload-preview-click/preview'

const stop = initPreviewClick({
  cmsOrigin: 'https://cms.example.com',
  path: 'layout',
  current: { collection: 'pages', id: 4, locale: 'en' },
  resolvePage: pageResolver({
    collection: 'pages',
    links: pageLinks([
      { id: 1, paths: { en: '/', fr: '/fr/' } },
      { id: 4, paths: { en: '/about/', fr: '/fr/a-propos/' } },
    ]),
    origins: ['https://www.example.com'], // links to the live site count too
  }),
  labels: { block: 'Section' },
})
```

Without a bundler, load `payload-preview-click/preview.global.js` (from your own server or a CDN) and call
`window.PayloadPreviewClick.initPreviewClick({...})`.

The script does nothing when the page is neither in a frame nor opened by another window, so loading it on a
published page is harmless; still, only load it on the preview route.

| Option        | Type                                  | Description |
| ------------- | ------------------------------------- | ----------- |
| `cmsOrigin`   | `string`                              | **Required.** URL or origin of the Payload admin. Messages are posted to this origin only. |
| `path`        | `string`                              | **Required.** Path of the blocks field, the same as in the plugin options. |
| `resolvePage` | `(url, link) => { collection, id, locale? } \| null` | Turns a link into the document it shows. Site-specific; `pageResolver()` builds one from a list of addresses. Without it, every link is blocked. |
| `current`     | `{ collection?, id, locale? }`        | The document shown: links to it do nothing. |
| `labels`      | `Partial<PreviewLabels>`              | Texts shown to the editor: `block`, `blockedLink`, `openingPage`, `modifierHint`. English by default. |
| `color`       | `string`                              | Outline and badge color, as a 6-digit hex. Default `#2563eb`. |
| `keepState`   | `boolean`                             | Keep the scroll position and the selection when the admin reloads the preview after a save. Default `true`. |
| `storageKey`  | `string`                              | Key of the kept state in `sessionStorage`. Default: the path plus the `collection`, `id` and `locale` query parameters. |
| `target`      | `{ postMessage }`                     | Where to post. Default: the parent frame, or the opener. |

`initPreviewClick` returns a function that removes the listeners and the overlay.

### Astro example

The preview route renders the draft on request and tells the components they are in the preview:

```astro
---
// src/pages/_preview.astro (rendered on request)
import Page from '../components/Page.astro'
import { getDraft } from '../lib/cms' // your own fetch of the draft, checking the preview link

const draft = await getDraft(Astro.url.searchParams)
Astro.locals.preview = true
Astro.response.headers.set('Cache-Control', 'no-store')
Astro.response.headers.set('X-Robots-Tag', 'noindex')
---
<Page page={draft} />
```

```ts
// src/env.d.ts
declare namespace App {
  interface Locals {
    preview?: boolean
  }
}
```

The component that renders the blocks puts a marker before each one:

```astro
---
// src/components/RenderBlocks.astro
import { blockMarker, BLOCKS_END } from 'payload-preview-click/preview'
import Faq from './blocks/Faq.astro'
import Hero from './blocks/Hero.astro'

const { blocks } = Astro.props
const preview = !!Astro.locals.preview
---
{blocks.map((block, i) => {
  const rendered = block.blockType === 'hero' ? <Hero block={block} /> : <Faq block={block} />
  return preview ? <><Fragment set:html={blockMarker(i, block.blockType)} />{rendered}</> : rendered
})}
{preview && <Fragment set:html={BLOCKS_END} />}
```

Each block marks its fields:

```astro
---
// src/components/blocks/Faq.astro
import { editable } from 'payload-preview-click/preview'

const { block } = Astro.props
const edit = editable(Astro.locals)
---
<section class="faq">
  <h2 {...edit('title')}>{block.title}</h2>
  <div {...edit('items')}>
    {block.items.map((item, i) => (
      <article {...edit(`items.${i}`)}>
        <h3 {...edit(`items.${i}.question`)}>{item.question}</h3>
        <p {...edit(`items.${i}.answer`)}>{item.answer}</p>
      </article>
    ))}
  </div>
</section>
```

The layout adds the script on the preview only. Astro bundles `<script>` tags but cannot pass them server values,
so the values go in a JSON script tag:

```astro
---
// src/components/PreviewHead.astro, rendered in <head> when Astro.locals.preview is set
import { pageLinks } from 'payload-preview-click/preview'

const { pages, current, locale } = Astro.props
const config = {
  cmsOrigin: import.meta.env.PUBLIC_CMS_URL,
  current: { collection: 'pages', id: current.id, locale },
  links: pageLinks(pages), // [{ id, paths: { en: '/about/', fr: '/fr/a-propos/' } }, ...]
  origins: Astro.site ? [Astro.site.origin] : [],
}
// `<` escaped: the JSON cannot close the script tag
const json = JSON.stringify(config).replace(/</g, '\\u003c')
---
<script type="application/json" id="preview-click-config" set:html={json} />
<script>
  import { initPreviewClick, pageResolver } from 'payload-preview-click/preview'

  const config = JSON.parse(document.getElementById('preview-click-config')!.textContent!)
  initPreviewClick({
    cmsOrigin: config.cmsOrigin,
    path: 'layout',
    current: config.current,
    resolvePage: pageResolver({ collection: 'pages', links: config.links, origins: config.origins }),
    labels: { block: 'Block' },
  })
</script>
```

## Message protocol

The preview posts two kinds of messages to the admin window, with `postMessage(message, cmsOrigin)`. Types and
builders are exported from `payload-preview-click/message` (and re-exported from `/preview`).

### `payload-preview-click`

A block, or a field inside it, was selected.

```ts
{ type: 'payload-preview-click', path: 'layout', index: 3, field?: 'items.2.question' }
```

| Key     | Rule |
| ------- | ---- |
| `path`  | Must equal the blocks field the edit view listens to. |
| `index` | Integer ≥ 0: the row of the block. A row that no longer exists in the form is ignored. |
| `field` | Optional. Field names and row indexes joined by dots, starting with a name (`/^[A-Za-z_]\w*(\.(\d+\|[A-Za-z_]\w*))*$/`), 200 characters at most. |

The admin expands every row along `layout.3.items.2.question` (row 3 of `layout`, then row 2 of `layout.3.items`),
stores the rows' collapsed state like the row toggle does, scrolls to the target and focuses its input.

### `payload-preview-navigate`

A link to another document was clicked.

```ts
{ type: 'payload-preview-navigate', collection: 'pages', id: 4, locale?: 'fr' }
```

| Key          | Rule |
| ------------ | ---- |
| `collection` | Must equal the collection being edited. |
| `id`         | A positive safe integer, or a string of 1 to 64 letters, digits, `_` or `-`. |
| `locale`     | Optional. Must be one of the admin's locales. |

The admin waits for autosave to store pending changes (6 s at most), then opens the document's edit view, still in
live preview.

## Security

- **Admin side:** a message is only read when its `event.origin` equals the origin of the current live preview URL.
  Any page can post to the admin window; messages from any other origin, and messages without a live preview URL,
  are ignored.
- **Validated input:** paths, indexes, ids and locales are checked against strict patterns (see above) before they
  reach a CSS selector or a URL. Navigation is limited to the collection being edited and to configured locales.
- **Preview side:** messages are posted with an explicit target origin (`cmsOrigin`), never `*`, so another page
  that frames the preview receives nothing.
- **Nothing sensitive in transit:** messages carry field paths and document ids, never content.
- **Protect the preview route yourself.** This package does not authenticate anything. Sign or otherwise check the
  links your live preview uses, render drafts on request only, and send `Cache-Control: no-store` and
  `X-Robots-Tag: noindex`.
- If you set a `Content-Security-Policy` on the admin, `frame-src` must allow the preview origin (as for any live
  preview). On the preview, `frame-ancestors` should allow the admin origin only.

## Alpha limitations

- Collections only, not globals, and one blocks field per collection (fields nested inside its blocks, arrays and
  blocks included, are fine).
- The admin side relies on the DOM ids Payload gives fields and rows (`field-layout__3__title`,
  `layout-row-3`) and on `@payloadcms/ui` hooks. A Payload update may break it; it is tested against Payload 3.93
  and Next 16.
- A field rendered in a tab that is not open cannot be scrolled to.
- Rich text fields are scrolled to, not focused at a precise position.
- Navigation assumes autosave on drafts: without it, unsaved changes are lost when a link opens another document.
- Links only open documents of the collection being edited.
- The overlay `color` must be a 6-digit hex color.
- No in-place editing: the form stays the place where content is edited.

## Public API

| Entry                                   | Exports |
| --------------------------------------- | ------- |
| `payload-preview-click`                 | `previewClickPlugin`, `PreviewClickOptions`, `LISTENER_PATH`, message types |
| `payload-preview-click/client`          | `PreviewClickListener` (client component, for the import map) |
| `payload-preview-click/message`         | `PREVIEW_CLICK`, `PREVIEW_NAVIGATE`, `previewClickMessage`, `previewNavigateMessage`, `readPreviewClick`, `readPreviewNavigate`, `previewOrigin`, `isFieldPath`, `isDocumentId`, types |
| `payload-preview-click/preview`         | `initPreviewClick`, `DEFAULT_LABELS`, `blockMarker`, `BLOCKS_END`, `blockAttributes`, `editable`, `readBlockMarker`, `BLOCK_ATTRIBUTE`, `BLOCK_TYPE_ATTRIBUTE`, `FIELD_ATTRIBUTE`, `BLOCK_MARKER_PATTERN`, `BLOCK_MARKER_PREFIX`, `pageLinks`, `pageResolver`, `linkPath`, message builders, types |
| `payload-preview-click/preview.global.js` | The `/preview` entry as a script, on `window.PayloadPreviewClick` |

## Development

```bash
pnpm install
pnpm test       # vitest
pnpm typecheck
pnpm build      # tsup: ESM, .d.ts and the IIFE script in dist/
```

## License

[MIT](LICENSE)
