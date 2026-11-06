/**
 * The script of the preview page (alpha). Framework-agnostic: it only reads
 * the markers of ./markers.ts from the DOM.
 *
 * The first click in a block selects it, each further click inside it goes
 * one level down (an array row, then a field), Escape goes back up. Every
 * selection is posted to the admin, which opens it in the form. A link to
 * another page of the site opens that page in the admin: on a click outside
 * the blocks (menu, footer), on ⌘/Ctrl + click inside a block, where a plain
 * click selects. Other links and form submissions do nothing in the preview.
 */
import { previewClickMessage, previewNavigateMessage } from '../message'
import type { ResolvePage, ResolvedPage } from './links'
import {
  BLOCK_ATTRIBUTE,
  BLOCK_MARKER_PREFIX,
  BLOCK_TYPE_ATTRIBUTE,
  FIELD_ATTRIBUTE,
  readBlockMarker,
} from './markers'

export type PreviewLabels = {
  /** What the badge calls a block: `Block 03 · faq`. */
  block: string
  /** Shown when a link leads outside the site's pages. */
  blockedLink: string
  /** Shown when a link opens its page in the admin. */
  openingPage: string
  /** Title of the links inside blocks that ⌘/Ctrl + click opens in the admin. */
  modifierHint: string
}

export const DEFAULT_LABELS: PreviewLabels = {
  block: 'Block',
  blockedLink: 'This link does not lead to a page of the site: it is not followed in the preview.',
  openingPage: 'Opening the page in the admin…',
  modifierHint: '⌘ or Ctrl + click: open this page in the admin',
}

export type PreviewScriptOptions = {
  /** URL or origin of the Payload admin. Messages are only posted to it. */
  cmsOrigin: string
  /** Path of the blocks field the page marks, e.g. `layout`: the plugin's option for this collection. */
  path: string
  /**
   * Turns a link into the document it shows, so the link opens that document
   * in the admin. Without it, every link is blocked. See `pageResolver()`.
   */
  resolvePage?: ResolvePage
  /** The document shown: a link to it opens nothing. */
  current?: { collection?: string; id: number | string; locale?: string }
  /** Texts shown to the editor, in their language. */
  labels?: Partial<PreviewLabels>
  /** Outline and badge color. */
  color?: string
  /**
   * Keep the scroll position and the selection when the admin reloads the
   * preview after a save. Default `true`.
   */
  keepState?: boolean
  /**
   * Storage key of the kept state. Default: the page path with the
   * `collection`, `id` and `locale` query parameters (not the ones that change
   * with every save, like a token).
   */
  storageKey?: string
  /** Window to post to. Default: the admin window that frames the preview, or opened it. */
  target?: MessageTarget | null
}

/** What the script posts to: the admin window. */
export type MessageTarget = { postMessage(message: unknown, targetOrigin: string): void }

type Block = { elements: Element[]; index: number; type: string }
type Selection = { block: Block; el: Element | null }

const noop = () => {}

/** The admin window: it frames the preview, or opened it in a window of its own. */
const adminWindow = (): MessageTarget | null =>
  window.parent !== window ? window.parent : window.opener

const originOf = (url: string) => {
  try {
    return new URL(url).origin
  } catch {
    throw new Error(`payload-preview-click: cmsOrigin is not a URL: ${url}`)
  }
}

const defaultStorageKey = () => {
  const params = new URLSearchParams(location.search)
  return `${location.pathname}?${['collection', 'id', 'locale'].map((name) => params.get(name) ?? '').join(':')}`
}

/** Storage can be blocked in a third-party frame: the preview still works, without keeping state. */
const storage = {
  read(key: string): string | null {
    try {
      return sessionStorage.getItem(key)
    } catch {
      return null
    }
  },
  write(key: string, value: string | null) {
    try {
      if (value === null) sessionStorage.removeItem(key)
      else sessionStorage.setItem(key, value)
    } catch {
      // Not kept across reloads
    }
  },
}

/**
 * Starts click to edit on the preview page. Call it once the page is parsed
 * (it waits for DOMContentLoaded otherwise). Does nothing when the page is
 * neither framed nor opened by another window. Returns a function that stops
 * it and removes what it added.
 */
export function initPreviewClick(options: PreviewScriptOptions): () => void {
  const target = options.target === undefined ? adminWindow() : options.target
  if (!target) return noop
  const cmsOrigin = originOf(options.cmsOrigin)
  const labels = { ...DEFAULT_LABELS, ...options.labels }
  const color = options.color ?? '#2563eb'
  const keepState = options.keepState ?? true
  const key = `payload-preview-click:${options.storageKey ?? defaultStorageKey()}`
  const resolvePage = options.resolvePage ?? (() => null)
  const current = options.current

  const controller = new AbortController()
  const { signal } = controller
  const listen = <K extends keyof DocumentEventMap>(
    on: Document | HTMLElement | Window,
    type: K,
    handler: (event: DocumentEventMap[K]) => void,
    extra: AddEventListenerOptions = {},
  ) => on.addEventListener(type, handler as EventListener, { ...extra, signal })

  const added: Element[] = []
  const blocks: Block[] = []
  let selected: Selection | null = null
  let hovered: Selection | null = null
  let hoverBox: HTMLElement
  let selectBox: HTMLElement
  let badge: HTMLElement
  let toast: HTMLElement | null = null

  /* Keep the scroll position when the admin reloads the frame after a save. */
  if (keepState) {
    const y = Number(storage.read(`${key}:scroll`)) || 0
    if (y) {
      if (document.readyState === 'complete') scrollTo(0, y)
      else listen(window, 'load' as keyof DocumentEventMap, () => scrollTo(0, y))
    }
    listen(window, 'pagehide' as keyof DocumentEventMap, () => storage.write(`${key}:scroll`, String(scrollY)))
  }

  const isMarker = (node: Node | null): node is Comment =>
    !!node && node.nodeType === Node.COMMENT_NODE && (node as Comment).data.startsWith(BLOCK_MARKER_PREFIX)

  /* Tags the elements between two marker comments with the index of their block, then adds the blocks marked
     with attributes. */
  function collect() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_COMMENT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const marker = readBlockMarker((node as Comment).data)
      if (!marker) continue
      const block: Block = { index: marker.index, type: marker.blockType, elements: [] }
      for (let el = node.nextSibling; el && !isMarker(el); el = el.nextSibling) {
        if (!(el instanceof Element) || el.tagName === 'SCRIPT' || el.tagName === 'STYLE') continue
        el.setAttribute(BLOCK_ATTRIBUTE, String(marker.index))
        block.elements.push(el)
      }
      if (block.elements.length) blocks[block.index] = block
    }
    for (const el of Array.from(document.querySelectorAll(`[${BLOCK_ATTRIBUTE}]`))) {
      const index = Number(el.getAttribute(BLOCK_ATTRIBUTE))
      if (!Number.isInteger(index) || index < 0) continue
      if (el.parentElement?.closest(`[${BLOCK_ATTRIBUTE}]`)) continue
      const block = (blocks[index] ??= { index, type: el.getAttribute(BLOCK_TYPE_ATTRIBUTE) ?? '', elements: [] })
      if (!block.elements.includes(el)) block.elements.push(el)
    }
  }

  function blockOf(node: EventTarget | null): Block | null {
    const el = node instanceof Element ? node.closest(`[${BLOCK_ATTRIBUTE}]`) : null
    return el ? (blocks[Number(el.getAttribute(BLOCK_ATTRIBUTE))] ?? null) : null
  }

  /* The field elements around a node, outermost first, within its block. */
  function chainOf(node: EventTarget | null): Element[] {
    const chain: Element[] = []
    let el = node instanceof Element ? node.closest(`[${FIELD_ATTRIBUTE}]`) : null
    while (el) {
      chain.unshift(el)
      el = el.parentElement?.closest(`[${FIELD_ATTRIBUTE}]`) ?? null
    }
    return chain
  }

  /* What a click on node selects: its block when another block (or none) is selected; inside the selection, one
     level down; elsewhere in the selected block, the element at the selection's level. */
  function next(node: EventTarget | null): Selection | null {
    const block = blockOf(node)
    if (!block) return null
    if (!selected || selected.block !== block) return { block, el: null }
    const chain = chainOf(node)
    if (!selected.el) return { block, el: chain[0] ?? null }
    const at = chain.indexOf(selected.el)
    if (at >= 0) return { block, el: chain[at + 1] ?? selected.el }
    const depth = chainOf(selected.el).length - 1
    return { block, el: chain[Math.min(depth, chain.length - 1)] ?? null }
  }

  function up(selection: Selection | null): Selection | null {
    if (!selection?.el) return null
    const chain = chainOf(selection.el)
    return { block: selection.block, el: chain[chain.length - 2] ?? null }
  }

  const same = (a: Selection | null, b: Selection | null) => !!a && !!b && a.block === b.block && a.el === b.el

  /* A box-less element (display: contents) is measured by its content. */
  function rectOf(el: Element): DOMRect {
    if (getComputedStyle(el).display !== 'contents') return el.getBoundingClientRect()
    const range = document.createRange()
    range.selectNodeContents(el)
    return range.getBoundingClientRect()
  }

  function bounds(selection: Selection) {
    const els = selection.el ? [selection.el] : selection.block.elements
    let top = Infinity
    let left = Infinity
    let bottom = -Infinity
    let right = -Infinity
    for (const el of els) {
      const r = rectOf(el)
      if (!r.width && !r.height) continue
      top = Math.min(top, r.top)
      left = Math.min(left, r.left)
      bottom = Math.max(bottom, r.bottom)
      right = Math.max(right, r.right)
    }
    return top === Infinity ? null : { top, left, width: right - left, height: bottom - top }
  }

  function label(selection: Selection) {
    const name = `${labels.block} ${String(selection.block.index + 1).padStart(2, '0')}${selection.block.type ? ` · ${selection.block.type}` : ''}`
    return selection.el ? `${name} › ${selection.el.getAttribute(FIELD_ATTRIBUTE)}` : name
  }

  function draw(box: HTMLElement, selection: Selection | null) {
    const b = selection && bounds(selection)
    if (!b) {
      box.style.display = 'none'
      return
    }
    box.style.display = 'block'
    box.style.top = `${b.top}px`
    box.style.left = `${b.left}px`
    box.style.width = `${b.width}px`
    box.style.height = `${b.height}px`
    if (box !== selectBox) return
    /* Above the selection when there is room, so it hides nothing; kept in view. */
    const height = badge.offsetHeight
    const width = badge.offsetWidth
    badge.style.top = `${b.top >= height ? -height : Math.min(Math.max(0, -b.top), Math.max(0, b.height - height))}px`
    badge.style.left = `${Math.max(-b.left, Math.min(0, innerWidth - b.left - width))}px`
  }

  function place() {
    draw(selectBox, selected)
    draw(hoverBox, same(hovered, selected) ? null : hovered)
  }

  function remember() {
    if (!keepState) return
    storage.write(
      `${key}:selection`,
      selected
        ? JSON.stringify({ index: selected.block.index, field: selected.el?.getAttribute(FIELD_ATTRIBUTE) ?? null })
        : null,
    )
  }

  function select(selection: Selection | null, post: boolean) {
    selected = selection
    if (selected) badge.textContent = `✎ ${label(selected)}`
    remember()
    place()
    if (!selected || !post) return
    const field = selected.el?.getAttribute(FIELD_ATTRIBUTE) ?? undefined
    target!.postMessage(previewClickMessage(options.path, { index: selected.block.index, field }), cmsOrigin)
    selectBox.animate?.([{ backgroundColor: `${color}33` }, { backgroundColor: `${color}00` }], { duration: 700 })
  }

  /* The admin reloads the frame after each save: keep what was selected. */
  function restore() {
    if (!keepState) return
    let saved: { field?: string | null; index?: number } | null = null
    try {
      saved = JSON.parse(storage.read(`${key}:selection`) ?? 'null')
    } catch {
      // Not a selection
    }
    const block = typeof saved?.index === 'number' ? blocks[saved.index] : undefined
    if (!block) return
    let el: Element | null = null
    if (saved?.field) {
      for (const root of block.elements) {
        const fields = [root, ...Array.from(root.querySelectorAll(`[${FIELD_ATTRIBUTE}]`))]
        el = fields.find((candidate) => candidate.getAttribute(FIELD_ATTRIBUTE) === saved!.field) ?? null
        if (el) break
      }
    }
    select({ block, el }, false)
  }

  function overlay(css: string) {
    const box = document.createElement('div')
    box.setAttribute('data-preview-click-ui', '')
    box.style.cssText = `position:fixed;z-index:2147483647;display:none;pointer-events:none;box-sizing:border-box;${css}`
    document.body.appendChild(box)
    added.push(box)
    return box
  }

  function pageOf(link: HTMLAnchorElement): ResolvedPage | null {
    let url: URL
    try {
      url = new URL(link.href)
    } catch {
      return null
    }
    return resolvePage(url, link)
  }

  const isShownPage = (page: ResolvedPage) =>
    !!current &&
    String(page.id) === String(current.id) &&
    (current.collection === undefined || page.collection === current.collection) &&
    (page.locale ?? current.locale) === current.locale

  function notify(text: string) {
    if (!toast) {
      toast = document.createElement('div')
      toast.setAttribute('role', 'status')
      toast.setAttribute('data-preview-click-ui', '')
      toast.style.cssText =
        'position:fixed;z-index:2147483647;left:50%;bottom:16px;transform:translateX(-50%);max-width:calc(100vw - 32px);padding:6px 12px;border-radius:4px;background:#1e293b;color:#fff;font:500 12px/1.4 system-ui,sans-serif;pointer-events:none;opacity:0'
      document.body.appendChild(toast)
      added.push(toast)
    }
    toast.textContent = text
    toast.getAnimations?.().forEach((animation) => animation.cancel())
    toast.animate?.([{ opacity: 1 }, { opacity: 1, offset: 0.75 }, { opacity: 0 }], { duration: 2400 })
  }

  /* The preview shows one draft: links do not leave it. */
  function onLink(event: MouseEvent) {
    const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null
    if (!link) return
    event.preventDefault()
    if (blockOf(link) && !event.metaKey && !event.ctrlKey) return
    const page = pageOf(link)
    if (page && isShownPage(page)) return
    /* An anchor of this page: nothing to say */
    if (!page && link.hash && link.href.split('#')[0] === location.href.split('#')[0]) return
    if (!page) {
      notify(labels.blockedLink)
      return
    }
    event.stopPropagation()
    target!.postMessage(
      previewNavigateMessage(page.collection, page.locale === undefined ? { id: page.id } : { id: page.id, locale: page.locale }),
      cmsOrigin,
    )
    notify(labels.openingPage)
  }

  function init() {
    if (signal.aborted) return
    collect()
    listen(document, 'click', onLink, { capture: true })
    listen(document, 'submit', (event) => event.preventDefault(), { capture: true })
    if (!blocks.some(Boolean)) return
    for (const link of Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))) {
      const page = !link.title && blockOf(link) ? pageOf(link) : null
      if (page && !isShownPage(page)) link.title = labels.modifierHint
    }
    hoverBox = overlay(`outline:1px dashed ${color};outline-offset:-1px;background:${color}0a`)
    selectBox = overlay(`outline:2px solid ${color};outline-offset:-2px`)
    badge = document.createElement('span')
    badge.style.cssText = `position:absolute;left:0;padding:4px 10px;border-radius:4px;background:${color};color:#fff;font:600 12px/1.4 system-ui,sans-serif;white-space:nowrap;max-width:100vw;overflow:hidden;text-overflow:ellipsis`
    selectBox.appendChild(badge)
    restore()

    listen(document, 'mouseover', (event) => {
      hovered = next(event.target)
      place()
    })
    listen(document.documentElement, 'mouseleave', () => {
      hovered = null
      place()
    })
    listen(window, 'scroll', place, { passive: true })
    listen(window, 'resize', place)
    listen(document, 'toggle' as keyof DocumentEventMap, () => requestAnimationFrame(place), { capture: true })
    listen(document, 'click', (event) => {
      if (event.button !== 0) return
      const selection = next(event.target)
      if (!selection) {
        select(null, false)
        hovered = null
        place()
        return
      }
      select(selection, true)
      hovered = next(event.target)
      place()
    })
    listen(document, 'keydown', (event) => {
      if (event.key !== 'Escape' || !selected) return
      select(up(selected), !!selected.el)
    })
  }

  if (document.readyState === 'loading') listen(document, 'DOMContentLoaded' as keyof DocumentEventMap, init)
  else init()

  return () => {
    controller.abort()
    for (const el of added) el.remove()
  }
}
