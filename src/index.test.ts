import type { Config } from 'payload'
import { describe, expect, it } from 'vitest'

import { LISTENER_PATH, previewClickPlugin } from '.'

const LISTENER = 'payload-preview-click/client#PreviewClickListener'

describe('previewClickPlugin', () => {
  const config = {
    collections: [
      { slug: 'pages', fields: [] },
      {
        slug: 'posts',
        fields: [],
        admin: { useAsTitle: 'navLabel', components: { edit: { beforeDocumentControls: ['/Other#Other'] } } },
      },
      { slug: 'media', fields: [] },
    ],
  } as unknown as Config

  const plugin = previewClickPlugin({ collections: { pages: 'layout', posts: 'sections' } })
  const collections = (plugin(config) as Config).collections ?? []

  it('listens to preview clicks on the blocks field of each collection', () => {
    expect(collections[0].admin?.components?.edit?.beforeDocumentControls).toEqual([
      { path: LISTENER, clientProps: { path: 'layout' } },
    ])
  })

  it('keeps what the collection already has', () => {
    expect(collections[1].admin?.useAsTitle).toBe('navLabel')
    expect(collections[1].admin?.components?.edit?.beforeDocumentControls).toEqual([
      '/Other#Other',
      { path: LISTENER, clientProps: { path: 'sections' } },
    ])
  })

  it('leaves other collections alone', () => {
    expect(collections[2]).toBe(config.collections?.[2])
  })
})

describe('previewClickPlugin options', () => {
  it('points the import map at the package client entry', () => {
    expect(LISTENER_PATH).toBe(LISTENER)
  })

  it('leaves the config unchanged when disabled', () => {
    const config = { collections: [{ slug: 'pages', fields: [] }] } as unknown as Config
    expect(previewClickPlugin({ collections: { pages: 'layout' }, disabled: true })(config)).toBe(config)
  })

  it('handles a config without collections', () => {
    expect((previewClickPlugin({ collections: { pages: 'layout' } })({} as Config) as Config).collections).toBeUndefined()
  })
})
