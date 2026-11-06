import {
  useConfig,
  useDocumentInfo,
  useForm,
  useFormBackgroundProcessing,
  useFormModified,
  useLivePreviewContext,
  useLocale,
} from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import { formatAdminURL } from 'payload/shared'
import { useEffect, useRef } from 'react'

import { documentPath, expandRow, rowsAlong, targetPath, targetSelectors } from './form'
import { previewOrigin, readPreviewClick, readPreviewNavigate } from './message'

/** How long a row takes to open (Payload's AnimateHeight). */
const OPENING_MS = 300
/** How long to wait for autosave to store the last changes before opening another page. */
const SAVE_TIMEOUT_MS = 6000
const SAVE_POLL_MS = 100

const findTarget = (formPath: string) => {
  for (const selector of targetSelectors(formPath)) {
    const element = document.querySelector<HTMLElement>(selector)
    if (element) return element
  }
  return null
}

/**
 * Brings what a click points to into view, flashes it and, for a field,
 * focuses its input. When rows are opening, this waits for them: before
 * that, the page may not be long enough to bring the target to the top.
 */
const reveal = (formPath: string, opening: boolean) => {
  window.setTimeout(
    () => {
      const target = findTarget(formPath)
      // Not rendered when its tab is not the open one
      if (!target) return
      const isRow = /\.\d+$/.test(formPath)
      const box = isRow ? target : (target.closest<HTMLElement>('.field-type') ?? target)
      // Clear of the document controls, which stick to the top of the page
      box.style.scrollMarginTop = 'calc(var(--doc-controls-height, 0px) + 1rem)'
      box.scrollIntoView({ behavior: 'smooth', block: 'start' })
      box.animate(
        [
          { boxShadow: '0 0 0 3px var(--theme-success-500)' },
          { boxShadow: '0 0 0 3px transparent' },
        ],
        { duration: 1600, easing: 'ease-out' },
      )
      if (isRow) return
      const input = target.matches('input, textarea')
        ? target
        : box.querySelector<HTMLElement>('input:not([type="hidden"]), textarea, [contenteditable="true"]')
      input?.focus({ preventScroll: true })
    },
    opening ? OPENING_MS + 50 : 0,
  )
}

export type PreviewClickListenerProps = {
  /** Path of the blocks field the preview marks, e.g. `layout`. Set by the plugin. */
  path: string
}

/**
 * Opens what an editor clicks in the live preview. The preview page
 * posts `{ type: 'payload-preview-click', path, index, field? }`: row `index`
 * of the blocks field `path`, and maybe a field inside it (`items.2.title`).
 * Every row along the way is expanded, then the target is scrolled to.
 *
 * A link to another page of the site posts
 * `{ type: 'payload-preview-navigate', collection, id, locale? }`: that page
 * opens in the edit view, still in live preview (Payload keeps the view per
 * collection), so the preview then shows its draft.
 */
export const PreviewClickListener = ({ path }: PreviewClickListenerProps) => {
  const { url } = useLivePreviewContext()
  const { dispatchFields, getField } = useForm()
  const { collectionSlug, id: currentId, setDocFieldPreferences } = useDocumentInfo()
  const {
    config: { localization, routes },
  } = useConfig()
  const { code: currentLocale } = useLocale()
  const router = useRouter()

  // Read when a message comes in, not when the listener is set up
  const modified = useFormModified()
  const saving = useFormBackgroundProcessing()
  const unsaved = useRef(false)
  useEffect(() => {
    unsaved.current = modified || saving
  }, [modified, saving])
  // Survives the listener being set up again: the preview link changes with each save
  const leaving = useRef(false)
  // The edit view may stay mounted from one document to the next
  useEffect(() => {
    leaving.current = false
  }, [currentId, currentLocale])

  useEffect(() => {
    const origin = previewOrigin(url)
    if (!origin) return
    const locales = localization ? localization.localeCodes : []

    /**
     * Autosave is on: there is no "leave without saving" guard, and changes
     * younger than its interval are not stored yet. Wait for it to store
     * them, then leave; past the timeout, leave anyway.
     */
    const open = (page: { id: number | string; locale?: string }) => {
      if (!collectionSlug || leaving.current) return
      if (String(page.id) === String(currentId) && (page.locale ?? currentLocale) === currentLocale) return
      leaving.current = true
      const started = Date.now()
      const go = () => {
        if (unsaved.current && Date.now() - started < SAVE_TIMEOUT_MS) {
          window.setTimeout(go, SAVE_POLL_MS)
          return
        }
        router.push(formatAdminURL({ adminRoute: routes.admin, path: documentPath(collectionSlug, page) }))
      }
      go()
    }

    const onMessage = (event: MessageEvent) => {
      if (collectionSlug) {
        const page = readPreviewNavigate(event, { collection: collectionSlug, locales, origin })
        if (page) return open(page)
      }
      const target = readPreviewClick(event, { origin, path })
      if (!target) return
      const formPath = targetPath(path, target)
      let opening = false
      for (const row of rowsAlong(formPath)) {
        const rows = getField(row.path)?.rows ?? []
        const expanded = expandRow(rows, row.index)
        // The row is gone from the form (removed since the preview was saved)
        if (!expanded) return
        if (!rows[row.index]?.collapsed) continue
        opening = true
        dispatchFields({ type: 'SET_ROW_COLLAPSED', path: row.path, updatedRows: expanded.rows })
        // Like the row's own toggle, so the row stays open after a reload
        void setDocFieldPreferences(row.path, { collapsed: expanded.collapsedIDs })
      }
      reveal(formPath, opening)
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [
    url,
    path,
    collectionSlug,
    currentId,
    currentLocale,
    localization,
    routes.admin,
    router,
    dispatchFields,
    getField,
    setDocFieldPreferences,
  ])

  return null
}
