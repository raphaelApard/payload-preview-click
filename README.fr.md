[English](README.md) · **Français**

# payload-preview-click

Cliquez sur un bloc ou un champ dans le live preview de [Payload](https://payloadcms.com) : le formulaire défile
jusqu’à lui, le déplie et lui donne le focus. Cliquez sur un lien vers une autre page : elle s’ouvre dans l’admin.

> **Alpha.** L’API peut changer avant la 1.0.

Une alternative gratuite, sous licence MIT, à une partie du
[Visual Editor](https://payloadcms.com/enterprise/visual-editor) de Payload (Enterprise). Elle n’édite pas sur
place : elle amène le rédacteur au bon endroit du formulaire habituel. Sans lien avec Payload.

## Installation

```bash
pnpm add payload-preview-click
```

Côté admin : Payload 3, Next.js ≥ 15 et React 19. Côté aperçu : aucune dépendance.

## 1. Admin

```ts
// payload.config.ts
import { previewClickPlugin } from 'payload-preview-click'

export default buildConfig({
  plugins: [
    previewClickPlugin({ collections: { pages: 'layout' } }), // collection → son champ blocs
  ],
})
```

Puis lancez `pnpm payload generate:importmap`. Le live preview doit être configuré pour la collection
(`admin.livePreview.url`).

## 2. Page d’aperçu

**Marquer les blocs :** un commentaire avant chaque bloc, et un après le dernier.

```ts
import { blockMarker, BLOCKS_END } from 'payload-preview-click/preview'

blockMarker(3, 'faq') // '<!--preview-block:3:faq-->', 3 = ligne du bloc
```

Ou, en React et similaires, des attributs sur la racine du bloc : `blockAttributes(isPreview, index, blockType)`.

**Marquer les champs :** chemins relatifs au bloc, lignes de tableau par index. Hors aperçu, rien n’est ajouté.

```ts
import { editable } from 'payload-preview-click/preview'

const edit = editable(isPreview) // ou Astro.locals, avec un indicateur `preview`
edit('title')                    // { 'data-preview-field': 'title' }
edit(`items.${i}.question`)      // { 'data-preview-field': 'items.2.question' }
```

**Lancer le script**, sur la page d’aperçu seulement :

```ts
import { initPreviewClick, pageLinks, pageResolver } from 'payload-preview-click/preview'

initPreviewClick({
  cmsOrigin: 'https://cms.example.com', // les messages ne partent que vers cette origine
  path: 'layout',                       // même champ blocs que dans le plugin
  current: { collection: 'pages', id: 4, locale: 'en' },
  // Facultatif : quel lien ouvre quel document. Sans lui, les liens sont bloqués.
  resolvePage: pageResolver({
    collection: 'pages',
    links: pageLinks([{ id: 4, paths: { en: '/about/', fr: '/fr/a-propos/' } }]),
  }),
})
```

Autres options : `labels` (textes montrés au rédacteur), `color`, `keepState`. Sans bundler, chargez
`payload-preview-click/preview.global.js` et appelez `window.PayloadPreviewClick.initPreviewClick()`.

### Astro

Définissez `Astro.locals.preview = true` dans la route d’aperçu, puis :

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
<!-- PreviewHead.astro, dans <head> sur l’aperçu seulement -->
<script>
  import { initPreviewClick } from 'payload-preview-click/preview'
  initPreviewClick({ cmsOrigin: import.meta.env.PUBLIC_CMS_URL, path: 'layout' })
</script>
```

## Fonctionnement

Dans l’aperçu, le premier clic sélectionne un bloc, chaque clic suivant descend d’un niveau (ligne de tableau, puis
champ), Échap remonte. Chaque sélection est envoyée à l’admin :

```ts
{ type: 'payload-preview-click', path: 'layout', index: 3, field?: 'items.2.question' }
{ type: 'payload-preview-navigate', collection: 'pages', id: 4, locale?: 'fr' }
```

Les liens ne quittent pas l’aperçu : un lien vers une page connue l’ouvre dans l’admin (⌘/Ctrl + clic dans un
bloc), les autres liens et les formulaires sont bloqués.

## Sécurité

- L’admin ne lit que les messages venant de l’origine de l’URL de live preview ; l’aperçu n’écrit qu’à `cmsOrigin`.
- Chemins, ids et locales sont strictement validés ; la navigation reste dans la collection éditée.
- Ce paquet ne protège pas votre route d’aperçu : signez ses liens et servez les brouillons en `no-store` et
  `noindex`.

## Limites (alpha)

- Collections seulement, un champ blocs par collection.
- S’appuie sur les ids DOM de Payload et les hooks de `@payloadcms/ui` ; testé avec Payload 3.93 et Next 16.
- Un champ dans un onglet fermé ne peut pas être atteint.
- La navigation suppose l’autosave des brouillons.

## Développement

```bash
pnpm install && pnpm test && pnpm build
```

Pour l’essayer dans une app Next.js, installez-le avec `file:../payload-preview-click`, pas `link:` (Turbopack ne
suit pas les liens symboliques hors de la racine du projet).

## Licence

[MIT](LICENSE)
