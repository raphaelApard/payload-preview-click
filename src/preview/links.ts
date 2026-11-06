/**
 * Turning a link of the preview into the document it shows. Which documents
 * a site's addresses serve is up to the site: it passes `resolvePage` to the
 * script. These helpers build one from a list of addresses.
 */

/** A document of the edited collection a link can open, in a locale. */
export type ResolvedPage = {
  /** Collection of the document. The admin only opens documents of the collection being edited. */
  collection: string
  id: number | string
  locale?: string
}

/** Turns a link's URL into the document it shows, or null for any other link. */
export type ResolvePage = (url: URL, link: HTMLAnchorElement) => null | ResolvedPage

/** A document and the locale an address serves it in. */
export type PageLink = [id: number | string, locale?: string]

/** How addresses are compared: no trailing slash, `/` for the root. */
export const linkPath = (path: string) => path.replace(/\/+$/, '') || '/'

/**
 * Every address of the site's documents, and the document and locale each one
 * serves. `paths` maps a locale to the document's path in it.
 *
 * ```ts
 * pageLinks([{ id: 1, paths: { en: '/', fr: '/fr/' } }]) // { '/': [1, 'en'], '/fr': [1, 'fr'] }
 * ```
 */
export function pageLinks(
  pages: { id: number | string; paths: Partial<Record<string, string>> }[],
): Record<string, PageLink> {
  const links: Record<string, PageLink> = {}
  for (const page of pages) {
    for (const [locale, path] of Object.entries(page.paths)) {
      if (path) links[linkPath(path)] = [page.id, locale]
    }
  }
  return links
}

export type PageResolverOptions = {
  /** Collection of the documents the addresses serve, e.g. `pages`. */
  collection: string
  /** Address path → document, e.g. from `pageLinks()`. */
  links: Record<string, PageLink>
  /**
   * Origins whose links count as links to the site, besides the preview's own,
   * e.g. the live site's `https://www.example.com`.
   */
  origins?: string[]
}

/**
 * A `resolvePage` that looks a link's path up in a map of addresses. Links to
 * other origins than the preview's and `origins` resolve to nothing.
 */
export const pageResolver = ({ collection, links, origins = [] }: PageResolverOptions): ResolvePage => {
  const allowed = origins.map(originOf)
  return (url) => {
    const own = typeof location === 'undefined' ? null : location.origin
    if (url.origin !== own && !allowed.includes(url.origin)) return null
    let path = url.pathname
    try {
      path = decodeURI(path)
    } catch {
      // Malformed escapes: keep the path encoded
    }
    const page = Object.prototype.hasOwnProperty.call(links, linkPath(path)) ? links[linkPath(path)] : undefined
    if (!page) return null
    return page[1] === undefined ? { collection, id: page[0] } : { collection, id: page[0], locale: page[1] }
  }
}

/** `https://example.com/` → `https://example.com`; kept as is when not a URL. */
const originOf = (url: string) => {
  try {
    return new URL(url).origin
  } catch {
    return url
  }
}
