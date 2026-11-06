/**
 * The messages a preview page posts to the Payload admin, and how the admin
 * reads them. Shared by both sides; no dependencies, safe in any runtime.
 */

/** Type of the message the preview posts when a block, or a field inside it, is clicked. */
export const PREVIEW_CLICK = 'payload-preview-click'

/** Type of the message the preview posts when a link to another page of the site is clicked. */
export const PREVIEW_NAVIGATE = 'payload-preview-navigate'

/** A block of the edited document was clicked, and maybe a field inside it. */
export type PreviewClickMessage = {
  /** Path of the field inside the block, e.g. `title` or `items.2.question`; none for the block itself. */
  field?: string
  /** Row of the block in its blocks field. */
  index: number
  /** Path of the blocks field in the document, e.g. `layout`. */
  path: string
  type: typeof PREVIEW_CLICK
}

/** A link to another document of the edited collection was clicked. */
export type PreviewNavigateMessage = {
  collection: string
  id: number | string
  locale?: string
  type: typeof PREVIEW_NAVIGATE
}

export type PreviewMessage = PreviewClickMessage | PreviewNavigateMessage

/** What a preview click points to: a block, and maybe a field inside it. */
export type PreviewTarget = {
  /** Path of the field inside the block, e.g. `title` or `items.2.question`; none for the block itself. */
  field?: string
  index: number
}

/** The page a preview link points to: a document of the edited collection, in one locale. */
export type PreviewPage = { id: number | string; locale?: string }

/** A field path relative to a block: field names, and row indexes of arrays and blocks. */
const FIELD_PATH = /^[A-Za-z_]\w*(?:\.(?:\d+|[A-Za-z_]\w*))*$/
const MAX_FIELD_PATH = 200

/** A document id: serial ids, or the string ids of other adapters (ObjectId, UUID). */
const DOCUMENT_ID = /^[\w-]{1,64}$/

/** Whether a string is a field path the admin accepts, e.g. `items.2.question`. */
export const isFieldPath = (field: unknown): field is string =>
  typeof field === 'string' && field.length <= MAX_FIELD_PATH && FIELD_PATH.test(field)

/** Whether a value is a document id the admin accepts. */
export const isDocumentId = (id: unknown): id is number | string =>
  typeof id === 'number' ? Number.isSafeInteger(id) && id > 0 : typeof id === 'string' && DOCUMENT_ID.test(id)

/** Builds the message for a click on a block, or on a field inside it. */
export const previewClickMessage = (path: string, target: PreviewTarget): PreviewClickMessage =>
  target.field === undefined
    ? { type: PREVIEW_CLICK, path, index: target.index }
    : { type: PREVIEW_CLICK, path, index: target.index, field: target.field }

/** Builds the message for a click on a link to another document. */
export const previewNavigateMessage = (
  collection: string,
  { id, locale }: PreviewPage,
): PreviewNavigateMessage =>
  locale === undefined ? { type: PREVIEW_NAVIGATE, collection, id } : { type: PREVIEW_NAVIGATE, collection, id, locale }

/** Origin of the live preview URL, or null when there is no preview yet. */
export const previewOrigin = (url: null | string | undefined): null | string => {
  if (!url) return null
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

/**
 * What a preview click points to, or null for any other message.
 *
 * Only the preview's origin is trusted: any page can post to the admin window.
 * The click must also be for the blocks field this edit view listens to.
 */
export const readPreviewClick = (
  event: Pick<MessageEvent, 'data' | 'origin'>,
  expected: { origin: null | string; path: string },
): null | PreviewTarget => {
  if (!expected.origin || event.origin !== expected.origin) return null
  const data: unknown = event.data
  if (!data || typeof data !== 'object') return null
  const { field, index, path, type } = data as Record<string, unknown>
  if (type !== PREVIEW_CLICK || path !== expected.path) return null
  if (typeof index !== 'number' || !Number.isInteger(index) || index < 0) return null
  if (field === undefined) return { index }
  if (!isFieldPath(field)) return null
  return { field, index }
}

/**
 * The page a preview link points to, or null for any other message.
 *
 * As for clicks, only the preview's origin is trusted. The page must be of the
 * collection being edited, and the locale one of the admin's locales.
 */
export const readPreviewNavigate = (
  event: Pick<MessageEvent, 'data' | 'origin'>,
  expected: { collection: string; locales: string[]; origin: null | string },
): null | PreviewPage => {
  if (!expected.origin || event.origin !== expected.origin) return null
  const data: unknown = event.data
  if (!data || typeof data !== 'object') return null
  const { collection, id, locale, type } = data as Record<string, unknown>
  if (type !== PREVIEW_NAVIGATE || collection !== expected.collection) return null
  if (!isDocumentId(id)) return null
  if (locale === undefined) return { id }
  if (typeof locale !== 'string' || !expected.locales.includes(locale)) return null
  return { id, locale }
}
