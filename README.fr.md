[English](README.md) · **Français**

# payload-preview-click

Cliquez sur un bloc ou un champ dans l’aperçu en direct (live preview) de [Payload](https://payloadcms.com) : le
formulaire d’édition défile jusqu’à lui, le déplie et lui donne le focus. Cliquez sur un lien vers une autre page du
site : cette page s’ouvre dans l’admin.

> **Alpha.** L’API et le protocole de messages peuvent changer avant la 1.0. Voir [Limites](#limites-de-lalpha).

- **Côté admin :** un plugin Payload 3 qui ajoute un petit écouteur à la vue d’édition des collections choisies.
- **Côté aperçu :** un script navigateur indépendant de tout framework (~9 ko minifié, sans dépendance) pour la page
  affichée par le live preview. Il fonctionne avec Astro, Next.js, du HTML statique ou tout ce qui produit du HTML.

## Comparaison avec le Visual Editor de Payload

Payload propose un [Visual Editor](https://payloadcms.com/enterprise/visual-editor) dans son offre Payload
Enterprise. Ce paquet est un projet indépendant sous licence MIT, sans lien avec Payload, et il en fait moins :

|                                            | payload-preview-click                     | Payload Visual Editor          |
| ------------------------------------------ | ----------------------------------------- | ------------------------------ |
| Licence                                    | MIT, gratuit                              | Payload Enterprise             |
| Clic dans l’aperçu → ouverture dans le formulaire | Oui : bloc, ligne de tableau ou champ | Oui                            |
| Édition du contenu sur place, dans l’aperçu | Non : on édite dans le formulaire habituel | Oui                          |
| Ouverture des pages liées depuis l’aperçu  | Oui, dans la collection éditée            | Voir la documentation de Payload |
| Prérequis côté front                       | Marquer blocs et champs au rendu          | Voir la documentation de Payload |

Pour de l’édition sur place et un support officiel, voyez Payload Enterprise. Pour que les rédacteurs retrouvent
dans le formulaire ce qu’ils voient dans l’aperçu, ce paquet suffit.

## Fonctionnement

1. La page d’aperçu marque les éléments de chaque bloc (un commentaire avant eux, ou des attributs sur leur racine)
   et les éléments qui affichent un champ (`data-preview-field="items.2.title"`).
2. Le script entoure les blocs au survol. Le premier clic dans un bloc le sélectionne, chaque clic suivant à
   l’intérieur descend d’un niveau (une ligne de tableau, puis un champ), Échap remonte. Chaque sélection est
   envoyée à la fenêtre de l’admin par `postMessage`.
3. L’écouteur de l’admin vérifie l’origine du message, déplie chaque ligne repliée sur le chemin, fait défiler
   jusqu’à la cible, la met en évidence et donne le focus à son champ.
4. Les liens ne quittent pas l’aperçu. Un lien vers une autre page du site ouvre plutôt cette page dans l’admin
   (clic simple hors des blocs, ⌘/Ctrl + clic dans un bloc, où le clic simple sélectionne). Les autres liens et les
   envois de formulaires sont bloqués, avec un court message.

## Installation

```bash
pnpm add payload-preview-click
```

Dépendances pairs : `payload` et `@payloadcms/ui` ^3, `next` ≥ 15, `react` ^19. Un site d’aperçu qui n’utilise que
l’entrée `/preview` n’en a besoin d’aucune.

## Configuration de l’admin

Le live preview doit être configuré pour la collection (`admin.livePreview.url`) et pointer vers la route du site
qui affiche les brouillons.

```ts
// payload.config.ts
import { buildConfig } from 'payload'
import { previewClickPlugin } from 'payload-preview-click'

export default buildConfig({
  // ...
  plugins: [
    previewClickPlugin({
      // slug de collection → chemin du champ blocs que l’aperçu marque
      collections: { pages: 'layout' },
    }),
  ],
})
```

Puis régénérez l’import map pour qu’elle inclue `payload-preview-click/client#PreviewClickListener` :

```bash
pnpm payload generate:importmap
```

| Option        | Type                     | Description                                                          |
| ------------- | ------------------------ | -------------------------------------------------------------------- |
| `collections` | `Record<string, string>` | Slug de collection → chemin de son champ blocs, ex. `{ pages: 'layout' }`. |
| `disabled`    | `boolean`                | Laisse la config inchangée.                                          |

L’écouteur est ajouté à `admin.components.edit.beforeDocumentControls` de chaque collection listée, après les
composants déjà présents.

## Configuration de l’aperçu

Trois étapes, toutes dans la page affichée par le live preview : marquer les blocs, marquer les champs, lancer le
script.

### 1. Marquer les blocs

Soit un commentaire avant les éléments de chaque bloc, et un après le dernier bloc :

```ts
import { blockMarker, BLOCKS_END } from 'payload-preview-click/preview'

blockMarker(3, 'faq') // '<!--preview-block:3:faq-->'
BLOCKS_END            // '<!--preview-block:end-->'
```

Les commentaires n’ajoutent aucun conteneur : l’aperçu garde exactement le balisage et le CSS du site. Tout élément
entre un marqueur et le suivant appartient au bloc.

Soit, quand produire des commentaires est malcommode (React, Vue…), des attributs sur l’élément racine de chaque
bloc :

```tsx
import { blockAttributes } from 'payload-preview-click/preview'

<section {...blockAttributes(isPreview, index, block.blockType)}>…</section>
// isPreview → data-preview-block="3" data-preview-block-type="faq" ; sinon rien
```

L’index est la ligne du bloc dans le champ blocs, à partir de 0.

### 2. Marquer les champs

`editable(when, prefix?)` renvoie une fonction du chemin d’un champ qui donne les attributs à poser sur l’élément.
Les chemins sont relatifs au bloc et reprennent les noms de champs Payload, avec les lignes de tableau par index.
`when` est un booléen, ou un objet avec un indicateur `preview` comme `Astro.locals`. Hors aperçu elle renvoie
`{}` : le site publié ne change pas.

```ts
const edit = editable(isPreview)
edit('title')            // { 'data-preview-field': 'title' }
edit(`items.${i}`)       // { 'data-preview-field': 'items.2' }
editable(isPreview, 'items.2')('title') // composant imbriqué : 'items.2.title'
```

L’élément d’une ligne de tableau doit contenir les éléments de ses champs : chaque clic descend d’un niveau.

### 3. Lancer le script

Avec un bundler :

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
    origins: ['https://www.example.com'], // les liens vers le site en ligne comptent aussi
  }),
  labels: { block: 'Section' },
})
```

Sans bundler, chargez `payload-preview-click/preview.global.js` (depuis votre serveur ou un CDN) et appelez
`window.PayloadPreviewClick.initPreviewClick({...})`.

Le script ne fait rien quand la page n’est ni dans un cadre ni ouverte par une autre fenêtre : le charger sur une
page publiée est sans effet. Ne le chargez tout de même que sur la route d’aperçu.

| Option        | Type                                  | Description |
| ------------- | ------------------------------------- | ----------- |
| `cmsOrigin`   | `string`                              | **Obligatoire.** URL ou origine de l’admin Payload. Les messages ne sont envoyés qu’à cette origine. |
| `path`        | `string`                              | **Obligatoire.** Chemin du champ blocs, le même que dans les options du plugin. |
| `resolvePage` | `(url, link) => { collection, id, locale? } \| null` | Traduit un lien en document affiché. Propre au site ; `pageResolver()` en construit un à partir d’une liste d’adresses. Sans lui, tous les liens sont bloqués. |
| `current`     | `{ collection?, id, locale? }`        | Le document affiché : les liens vers lui ne font rien. |
| `labels`      | `Partial<PreviewLabels>`              | Textes montrés au rédacteur : `block`, `blockedLink`, `openingPage`, `modifierHint`. En anglais par défaut. |
| `color`       | `string`                              | Couleur du contour et du badge, en hexadécimal à 6 chiffres. Par défaut `#2563eb`. |
| `keepState`   | `boolean`                             | Garde la position de défilement et la sélection quand l’admin recharge l’aperçu après un enregistrement. Par défaut `true`. |
| `storageKey`  | `string`                              | Clé de l’état gardé dans `sessionStorage`. Par défaut : le chemin et les paramètres `collection`, `id` et `locale`. |
| `target`      | `{ postMessage }`                     | Destinataire des messages. Par défaut : le cadre parent, ou la fenêtre qui a ouvert l’aperçu. |

`initPreviewClick` renvoie une fonction qui retire les écouteurs et la surcouche.

### Exemple Astro

La route d’aperçu affiche le brouillon à la demande et indique aux composants qu’ils sont dans l’aperçu :

```astro
---
// src/pages/_preview.astro (rendu à la demande)
import Page from '../components/Page.astro'
import { getDraft } from '../lib/cms' // votre propre lecture du brouillon, qui vérifie le lien d’aperçu

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

Le composant qui affiche les blocs place un marqueur avant chacun :

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

Chaque bloc marque ses champs :

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

Le layout n’ajoute le script que dans l’aperçu. Astro bundle les balises `<script>` mais ne peut pas leur passer de
valeurs serveur : les valeurs passent par une balise script JSON.

```astro
---
// src/components/PreviewHead.astro, rendu dans <head> quand Astro.locals.preview est défini
import { pageLinks } from 'payload-preview-click/preview'

const { pages, current, locale } = Astro.props
const config = {
  cmsOrigin: import.meta.env.PUBLIC_CMS_URL,
  current: { collection: 'pages', id: current.id, locale },
  links: pageLinks(pages), // [{ id, paths: { en: '/about/', fr: '/fr/a-propos/' } }, ...]
  origins: Astro.site ? [Astro.site.origin] : [],
}
// `<` échappé : le JSON ne peut pas fermer la balise script
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
    labels: { block: 'Bloc' },
  })
</script>
```

## Protocole de messages

L’aperçu envoie deux sortes de messages à la fenêtre de l’admin, avec `postMessage(message, cmsOrigin)`. Types et
constructeurs sont exportés par `payload-preview-click/message` (et réexportés par `/preview`).

### `payload-preview-click`

Un bloc, ou un champ à l’intérieur, a été sélectionné.

```ts
{ type: 'payload-preview-click', path: 'layout', index: 3, field?: 'items.2.question' }
```

| Clé     | Règle |
| ------- | ----- |
| `path`  | Doit être le champ blocs qu’écoute la vue d’édition. |
| `index` | Entier ≥ 0 : la ligne du bloc. Une ligne qui n’existe plus dans le formulaire est ignorée. |
| `field` | Facultatif. Noms de champs et index de lignes séparés par des points, commençant par un nom (`/^[A-Za-z_]\w*(\.(\d+\|[A-Za-z_]\w*))*$/`), 200 caractères au plus. |

L’admin déplie chaque ligne le long de `layout.3.items.2.question` (ligne 3 de `layout`, puis ligne 2 de
`layout.3.items`), enregistre l’état replié des lignes comme le fait le bouton de la ligne, défile jusqu’à la cible
et donne le focus à son champ.

### `payload-preview-navigate`

Un lien vers un autre document a été cliqué.

```ts
{ type: 'payload-preview-navigate', collection: 'pages', id: 4, locale?: 'fr' }
```

| Clé          | Règle |
| ------------ | ----- |
| `collection` | Doit être la collection en cours d’édition. |
| `id`         | Un entier sûr positif, ou une chaîne de 1 à 64 lettres, chiffres, `_` ou `-`. |
| `locale`     | Facultatif. Doit être une des locales de l’admin. |

L’admin attend que l’autosave enregistre les modifications en attente (6 s au plus), puis ouvre la vue d’édition du
document, toujours en live preview.

## Sécurité

- **Côté admin :** un message n’est lu que si son `event.origin` est l’origine de l’URL de live preview courante.
  N’importe quelle page peut écrire à la fenêtre de l’admin ; les messages d’une autre origine, et ceux reçus sans
  URL de live preview, sont ignorés.
- **Entrées validées :** chemins, index, ids et locales sont vérifiés par des motifs stricts (voir plus haut) avant
  d’atteindre un sélecteur CSS ou une URL. La navigation est limitée à la collection éditée et aux locales
  configurées.
- **Côté aperçu :** les messages partent avec une origine cible explicite (`cmsOrigin`), jamais `*` : une autre page
  qui encadrerait l’aperçu ne reçoit rien.
- **Rien de sensible en transit :** les messages portent des chemins de champs et des ids de documents, jamais de
  contenu.
- **Protégez vous-même la route d’aperçu.** Ce paquet n’authentifie rien. Signez ou vérifiez autrement les liens du
  live preview, n’affichez les brouillons qu’à la demande, et envoyez `Cache-Control: no-store` et
  `X-Robots-Tag: noindex`.
- Si l’admin a une `Content-Security-Policy`, `frame-src` doit autoriser l’origine de l’aperçu (comme pour tout live
  preview). Sur l’aperçu, `frame-ancestors` ne devrait autoriser que l’origine de l’admin.

## Limites de l’alpha

- Collections seulement, pas les globals, et un seul champ blocs par collection (les champs imbriqués dans ses
  blocs, tableaux et blocs compris, fonctionnent).
- Le côté admin s’appuie sur les ids DOM que Payload donne aux champs et aux lignes (`field-layout__3__title`,
  `layout-row-3`) et sur des hooks de `@payloadcms/ui`. Une mise à jour de Payload peut le casser ; testé avec
  Payload 3.93 et Next 16.
- Un champ affiché dans un onglet fermé ne peut pas être atteint.
- Les champs rich text sont atteints, pas focalisés à une position précise.
- La navigation suppose l’autosave des brouillons : sans lui, les modifications non enregistrées sont perdues quand
  un lien ouvre un autre document.
- Les liens n’ouvrent que des documents de la collection éditée.
- La `color` de la surcouche doit être une couleur hexadécimale à 6 chiffres.
- Pas d’édition sur place : le formulaire reste l’endroit où l’on édite le contenu.

## API publique

| Entrée                                  | Exports |
| --------------------------------------- | ------- |
| `payload-preview-click`                 | `previewClickPlugin`, `PreviewClickOptions`, `LISTENER_PATH`, types des messages |
| `payload-preview-click/client`          | `PreviewClickListener` (composant client, pour l’import map) |
| `payload-preview-click/message`         | `PREVIEW_CLICK`, `PREVIEW_NAVIGATE`, `previewClickMessage`, `previewNavigateMessage`, `readPreviewClick`, `readPreviewNavigate`, `previewOrigin`, `isFieldPath`, `isDocumentId`, types |
| `payload-preview-click/preview`         | `initPreviewClick`, `DEFAULT_LABELS`, `blockMarker`, `BLOCKS_END`, `blockAttributes`, `editable`, `readBlockMarker`, `BLOCK_ATTRIBUTE`, `BLOCK_TYPE_ATTRIBUTE`, `FIELD_ATTRIBUTE`, `BLOCK_MARKER_PATTERN`, `BLOCK_MARKER_PREFIX`, `pageLinks`, `pageResolver`, `linkPath`, constructeurs de messages, types |
| `payload-preview-click/preview.global.js` | L’entrée `/preview` sous forme de script, sur `window.PayloadPreviewClick` |

## Développement

```bash
pnpm install
pnpm test       # vitest
pnpm typecheck
pnpm build      # tsup : ESM, .d.ts et le script IIFE dans dist/
```

Pour essayer une copie locale dans une application, construisez-la puis ajoutez-la avec
`"payload-preview-click": "file:../payload-preview-click"` (réinstallez après chaque build). Dans une application
Next.js, préférez `file:` à `link:` : Turbopack ne résout pas les liens symboliques qui sortent de la racine du
projet.

## Licence

[MIT](LICENSE)
