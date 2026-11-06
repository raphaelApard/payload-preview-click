/**
 * How a preview page tells the script which block, and which field of the
 * block, an element renders. Pure string helpers: call them while rendering,
 * on the server or in the browser, in any framework.
 *
 * Blocks are marked either with a comment before their elements (no wrapper,
 * so the page keeps its markup and CSS), or with attributes on their root
 * element. Fields are marked with an attribute holding their path relative to
 * the block, using the Payload field names and array rows by index: `title`,
 * `items.2`, `items.2.title`. An element for an array row should contain the
 * elements for its fields: each further click goes one level down.
 */

/** Prefix of the comment that precedes the elements of a block. */
export const BLOCK_MARKER_PREFIX = 'preview-block:'

/** Reads a block marker comment's text: `preview-block:<index>:<blockType>`. */
export const BLOCK_MARKER_PATTERN = /^preview-block:(\d+):(\w*)$/

/** Holds the row of the block an element belongs to. Set by the script on marked elements, or by the page. */
export const BLOCK_ATTRIBUTE = 'data-preview-block'

/** Holds the type of the block, next to `data-preview-block`, for the badge. */
export const BLOCK_TYPE_ATTRIBUTE = 'data-preview-block-type'

/** Holds the path of the field an element renders, relative to its block. */
export const FIELD_ATTRIBUTE = 'data-preview-field'

/** A block type as markers carry it: word characters only, so it cannot close a comment. */
const safeType = (blockType: string) => blockType.replace(/\W/g, '')

/**
 * The comment to render before the elements of block `index` (its row in the
 * blocks field), e.g. `<!--preview-block:3:faq-->`. Insert it as raw HTML.
 */
export const blockMarker = (index: number, blockType: string) =>
  `<!--${BLOCK_MARKER_PREFIX}${Math.max(0, Math.trunc(index))}:${safeType(blockType)}-->`

/** The comment to render after the last block, so the elements that follow belong to none. */
export const BLOCKS_END = `<!--${BLOCK_MARKER_PREFIX}end-->`

/** Reads a marker comment's text, or null when it is not a block marker. */
export const readBlockMarker = (text: string): null | { blockType: string; index: number } => {
  const match = BLOCK_MARKER_PATTERN.exec(text)
  return match ? { index: Number(match[1]), blockType: match[2] } : null
}

/** Whether to mark: `true`, or an object with a truthy `preview` (e.g. `Astro.locals`). */
export type MarkWhen = boolean | { preview?: boolean } | null | undefined

const enabled = (when: MarkWhen) => (typeof when === 'object' && when !== null ? !!when.preview : !!when)

/**
 * Attributes for the root element of a block, for pages that would rather
 * not render comments (React, Vue…). Empty when not marking.
 */
export const blockAttributes = (
  when: MarkWhen,
  index: number,
  blockType: string,
): { 'data-preview-block'?: string; 'data-preview-block-type'?: string } =>
  enabled(when) ? { [BLOCK_ATTRIBUTE]: String(Math.max(0, Math.trunc(index))), [BLOCK_TYPE_ATTRIBUTE]: safeType(blockType) } : {}

/**
 * Ties rendered elements to the fields of their block. Returns a function of
 * the field path that gives the attributes to spread on the element; they are
 * empty when not marking, so the published site is unchanged.
 *
 * ```astro
 * const edit = editable(Astro.locals)          // Astro.locals.preview set by the preview route
 * <h3 {...edit(`items.${i}.question`)}>…</h3>
 * ```
 *
 * `prefix` is for a nested component: `editable(locals, 'items.2')('title')`
 * marks `items.2.title`.
 */
export const editable =
  (when: MarkWhen, prefix?: string) =>
  (path: number | string): { 'data-preview-field'?: string } =>
    enabled(when) ? { [FIELD_ATTRIBUTE]: prefix ? `${prefix}.${path}` : String(path) } : {}
