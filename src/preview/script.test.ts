// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest'

import { PREVIEW_CLICK, PREVIEW_NAVIGATE } from '../message'
import { pageResolver } from './links'
import { BLOCKS_END, blockMarker } from './markers'
import { initPreviewClick, type PreviewScriptOptions } from './script'

const CMS = 'https://cms.example.com'

const page = `
  <header><a id="menu-about" href="/about/">About</a><a id="menu-out" href="https://elsewhere.example.org/">Out</a>
  <a id="menu-home" href="/">Home</a><a id="anchor" href="#top">Top</a></header>
  ${blockMarker(0, 'hero')}
  <section id="hero"><h1 id="hero-title" data-preview-field="title">Hello</h1></section>
  ${blockMarker(1, 'faq')}
  <section id="faq">
    <div id="items" data-preview-field="items">
      <article id="item-0" data-preview-field="items.0">
        <h3 id="question-0" data-preview-field="items.0.question">Q?</h3>
        <a id="inner-link" href="/about/">About</a>
      </article>
    </div>
  </section>
  <aside id="faq-aside">Also part of block 1</aside>
  ${BLOCKS_END}
  <div id="cards" data-preview-block="2" data-preview-block-type="cards"><p id="card-text" data-preview-field="text">Card</p></div>
  <form id="form"><button id="submit">Send</button></form>
  <footer id="footer">Footer</footer>
`

const click = (id: string, init: MouseEventInit = {}) => {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init })
  document.getElementById(id)!.dispatchEvent(event)
  return event
}

let postMessage: Mock<(message: unknown, targetOrigin: string) => void>
let stop: () => void

const start = (options: Partial<PreviewScriptOptions> = {}) => {
  stop = initPreviewClick({
    cmsOrigin: `${CMS}/admin`,
    path: 'layout',
    target: { postMessage },
    resolvePage: pageResolver({ collection: 'pages', links: { '/': [1, 'en'], '/about': [2, 'en'] } }),
    current: { collection: 'pages', id: 1, locale: 'en' },
    ...options,
  })
}

beforeEach(() => {
  sessionStorage.clear()
  document.body.innerHTML = page
  postMessage = vi.fn()
})

afterEach(() => stop?.())

describe('initPreviewClick', () => {
  it('does nothing outside the admin', () => {
    stop = initPreviewClick({ cmsOrigin: CMS, path: 'layout' })
    expect(document.querySelector('[data-preview-click-ui]')).toBeNull()
    expect(click('menu-about').defaultPrevented).toBe(false)
  })

  it('refuses an admin origin that is not a URL', () => {
    expect(() => initPreviewClick({ cmsOrigin: 'cms', path: 'layout', target: { postMessage } })).toThrow(/cmsOrigin/)
  })

  it('posts the block a click selects, to the admin origin only', () => {
    start()
    click('hero-title')
    expect(postMessage).toHaveBeenLastCalledWith({ type: PREVIEW_CLICK, path: 'layout', index: 0 }, CMS)
    click('faq-aside')
    expect(postMessage).toHaveBeenLastCalledWith({ type: PREVIEW_CLICK, path: 'layout', index: 1 }, CMS)
  })

  it('goes one level down with each click inside the selection, and up with Escape', () => {
    start()
    click('question-0')
    expect(postMessage).toHaveBeenLastCalledWith({ type: PREVIEW_CLICK, path: 'layout', index: 1 }, CMS)
    click('question-0')
    expect(postMessage).toHaveBeenLastCalledWith({ type: PREVIEW_CLICK, path: 'layout', index: 1, field: 'items' }, CMS)
    click('question-0')
    expect(postMessage).toHaveBeenLastCalledWith(
      { type: PREVIEW_CLICK, path: 'layout', index: 1, field: 'items.0' },
      CMS,
    )
    click('question-0')
    expect(postMessage).toHaveBeenLastCalledWith(
      { type: PREVIEW_CLICK, path: 'layout', index: 1, field: 'items.0.question' },
      CMS,
    )
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(postMessage).toHaveBeenLastCalledWith(
      { type: PREVIEW_CLICK, path: 'layout', index: 1, field: 'items.0' },
      CMS,
    )
  })

  it('reads blocks marked with attributes', () => {
    start()
    click('card-text')
    expect(postMessage).toHaveBeenLastCalledWith({ type: PREVIEW_CLICK, path: 'layout', index: 2 }, CMS)
    click('card-text')
    expect(postMessage).toHaveBeenLastCalledWith({ type: PREVIEW_CLICK, path: 'layout', index: 2, field: 'text' }, CMS)
  })

  it('shows what is selected in the badge', () => {
    start({ labels: { block: 'Section' } })
    click('question-0')
    expect(document.querySelector('[data-preview-click-ui] span')?.textContent).toBe('✎ Section 02 · faq')
  })

  it('posts nothing for a click outside the blocks', () => {
    start()
    click('footer')
    expect(postMessage).not.toHaveBeenCalled()
  })

  it('opens the page a link outside the blocks points to', () => {
    start()
    const event = click('menu-about')
    expect(event.defaultPrevented).toBe(true)
    expect(postMessage).toHaveBeenCalledTimes(1)
    expect(postMessage).toHaveBeenLastCalledWith(
      { type: PREVIEW_NAVIGATE, collection: 'pages', id: 2, locale: 'en' },
      CMS,
    )
  })

  it('selects on a plain click on a link inside a block, opens its page on ⌘/Ctrl + click', () => {
    start()
    expect(document.getElementById('inner-link')?.title).toMatch(/Ctrl/)
    click('inner-link')
    expect(postMessage).toHaveBeenLastCalledWith({ type: PREVIEW_CLICK, path: 'layout', index: 1 }, CMS)
    click('inner-link', { ctrlKey: true })
    expect(postMessage).toHaveBeenLastCalledWith(
      { type: PREVIEW_NAVIGATE, collection: 'pages', id: 2, locale: 'en' },
      CMS,
    )
    click('inner-link', { metaKey: true })
    expect(postMessage).toHaveBeenCalledTimes(3)
    expect(postMessage.mock.calls[2][0]).toMatchObject({ type: PREVIEW_NAVIGATE, id: 2 })
  })

  it('blocks other links, says so, and stays on anchors and the page shown', () => {
    start({ labels: { blockedLink: 'Blocked' } })
    expect(click('menu-out').defaultPrevented).toBe(true)
    expect(document.querySelector('[role="status"]')?.textContent).toBe('Blocked')
    click('menu-home')
    click('anchor')
    expect(postMessage).not.toHaveBeenCalled()
  })

  it('blocks links even without a resolver', () => {
    start({ resolvePage: undefined })
    expect(click('menu-about').defaultPrevented).toBe(true)
    expect(postMessage).not.toHaveBeenCalled()
  })

  it('blocks form submissions', () => {
    start()
    const event = new Event('submit', { bubbles: true, cancelable: true })
    document.getElementById('form')!.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  })

  it('keeps the selection when the admin reloads the preview', () => {
    start()
    click('question-0')
    click('question-0')
    stop()
    document.body.innerHTML = page
    start()
    expect(document.querySelector('[data-preview-click-ui] span')?.textContent).toBe('✎ Block 02 · faq › items')
    expect(postMessage).toHaveBeenCalledTimes(2)
  })

  it('stops and removes what it added', () => {
    start()
    stop()
    expect(document.querySelector('[data-preview-click-ui]')).toBeNull()
    click('hero-title')
    expect(click('menu-about').defaultPrevented).toBe(false)
    expect(postMessage).not.toHaveBeenCalled()
  })
})
