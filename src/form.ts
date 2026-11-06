/**
 * How the admin listener finds, in the edit form, what a preview message
 * points to. Pure functions, kept apart from the React component to be tested.
 */
import type { PreviewPage, PreviewTarget } from './message'

/** A row of a blocks or array field, as the admin form keeps it. */
export type FormRow = { collapsed?: boolean; id: string }

/** Admin path of a document's edit view, in a locale: `/collections/pages/4?locale=en`. */
export const documentPath = (collection: string, { id, locale }: PreviewPage): `/${string}` =>
  `/collections/${collection}/${encodeURIComponent(String(id))}${locale ? `?locale=${encodeURIComponent(locale)}` : ''}`

/** Form path of what a click points to, e.g. `layout.3.items.2.question`. */
export const targetPath = (path: string, { field, index }: PreviewTarget) =>
  [path, index, field].filter((part) => part !== undefined).join('.')

/**
 * The rows to open to reach a form path, outermost first: every array or
 * blocks row along it. `layout.3.items.2.question` → row 3 of `layout`, then
 * row 2 of `layout.3.items`.
 */
export const rowsAlong = (formPath: string): { index: number; path: string }[] => {
  const parts = formPath.split('.')
  return parts.flatMap((part, i) =>
    i > 0 && /^\d+$/.test(part) ? [{ index: Number(part), path: parts.slice(0, i).join('.') }] : [],
  )
}

/**
 * The rows with one of them expanded, and the IDs left collapsed (what the
 * document's field preferences store). Null when there is no such row; the
 * rows are copied, not changed.
 */
export const expandRow = <R extends FormRow>(
  rows: R[],
  index: number,
): null | { collapsedIDs: string[]; rows: R[] } => {
  if (!rows[index]) return null
  const updated = rows.map((row, i) => (i === index ? { ...row, collapsed: false } : row))
  return {
    collapsedIDs: updated.filter((row) => row.collapsed).map((row) => row.id),
    rows: updated,
  }
}

/** DOM id Payload gives a row of a blocks or array field, e.g. `layout-row-3`. */
export const rowElementId = (path: string, index: number) => `${path.split('.').join('-')}-row-${index}`

/**
 * How to find what a form path points to in the edit view: the row's element
 * for a row, else the field's input (`field-layout__3__title`), or for rich
 * text, the editor's wrapper.
 */
export const targetSelectors = (formPath: string): string[] => {
  const parts = formPath.split('.')
  const last = parts[parts.length - 1]
  if (/^\d+$/.test(last)) return [`#${rowElementId(parts.slice(0, -1).join('.'), Number(last))}`]
  return [`#field-${formPath.replace(/\./g, '__')}`, `[data-field-path="${formPath}"]`]
}
