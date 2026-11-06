import type { CollectionSlug, Plugin } from 'payload'

export type PreviewClickOptions = {
  /**
   * Collection slug → path of the blocks field the preview marks,
   * e.g. `{ pages: 'layout' }`. Other collections are left alone.
   */
  collections: Partial<Record<CollectionSlug, string>>
  /** Leave the config unchanged, e.g. to turn the feature off in production. */
  disabled?: boolean
}

/** The admin component the plugin adds to each collection's edit view, as the import map knows it. */
export const LISTENER_PATH = 'payload-preview-click/client#PreviewClickListener'

/**
 * Click to edit, block by block (alpha): clicking a block or a field in a
 * collection's live preview opens it in the edit form, and clicking a link to
 * another page opens that page. The preview page has to post the clicks: see
 * `payload-preview-click/preview`.
 */
export const previewClickPlugin =
  ({ collections, disabled = false }: PreviewClickOptions): Plugin =>
  (config) => {
    if (disabled) return config
    return {
      ...config,
      collections: config.collections?.map((collection) => {
        const path = collections[collection.slug as CollectionSlug]
        if (!path) return collection
        const edit = collection.admin?.components?.edit
        return {
          ...collection,
          admin: {
            ...collection.admin,
            components: {
              ...collection.admin?.components,
              edit: {
                ...edit,
                beforeDocumentControls: [
                  ...(edit?.beforeDocumentControls ?? []),
                  { path: LISTENER_PATH, clientProps: { path } },
                ],
              },
            },
          },
        }
      }),
    }
  }

export {
  PREVIEW_CLICK,
  PREVIEW_NAVIGATE,
  type PreviewClickMessage,
  type PreviewMessage,
  type PreviewNavigateMessage,
  type PreviewPage,
  type PreviewTarget,
} from './message'
