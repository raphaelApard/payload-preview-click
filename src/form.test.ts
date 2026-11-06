import { describe, expect, it } from 'vitest'

import { documentPath, expandRow, rowElementId, rowsAlong, targetPath, targetSelectors } from './form'

describe('expandRow', () => {
  const rows = [
    { id: 'a', collapsed: true, blockType: 'hero' },
    { id: 'b', collapsed: true, blockType: 'faq' },
    { id: 'c', collapsed: false, blockType: 'quote' },
  ]

  it('opens one row and keeps the others as they are', () => {
    const result = expandRow(rows, 1)
    expect(result?.rows.map((row) => row.collapsed)).toEqual([true, false, false])
    expect(result?.rows[1]).toMatchObject({ id: 'b', blockType: 'faq' })
    expect(result?.collapsedIDs).toEqual(['a'])
  })

  it('does not change the rows it is given', () => {
    expandRow(rows, 0)
    expect(rows[0].collapsed).toBe(true)
  })

  it('has nothing to open past the last row', () => {
    expect(expandRow(rows, 3)).toBeNull()
    expect(expandRow([], 0)).toBeNull()
  })
})

describe('targetPath', () => {
  it('joins the blocks field, the block and the field', () => {
    expect(targetPath('layout', { index: 3 })).toBe('layout.3')
    expect(targetPath('layout', { index: 0, field: 'items.2.question' })).toBe('layout.0.items.2.question')
  })
})

describe('rowsAlong', () => {
  it('lists the rows to open, outermost first', () => {
    expect(rowsAlong('layout.3.items.2.question')).toEqual([
      { path: 'layout', index: 3 },
      { path: 'layout.3.items', index: 2 },
    ])
    expect(rowsAlong('sections.1.cta.label')).toEqual([{ path: 'sections', index: 1 }])
    expect(rowsAlong('layout.3.items.2')).toEqual([
      { path: 'layout', index: 3 },
      { path: 'layout.3.items', index: 2 },
    ])
  })
})

describe('targetSelectors', () => {
  it('finds a row by its id', () => {
    expect(targetSelectors('layout.3')).toEqual(['#layout-row-3'])
    expect(targetSelectors('layout.3.items.2')).toEqual(['#layout-3-items-row-2'])
  })

  it('finds a field by its input id, or its rich text wrapper', () => {
    expect(targetSelectors('layout.3.items.2.question')).toEqual([
      '#field-layout__3__items__2__question',
      '[data-field-path="layout.3.items.2.question"]',
    ])
  })
})

describe('rowElementId', () => {
  it('follows the ids Payload gives rows', () => {
    expect(rowElementId('layout', 3)).toBe('layout-row-3')
    expect(rowElementId('content.sections', 0)).toBe('content-sections-row-0')
  })
})

describe('documentPath', () => {
  it('points to the edit view of the document, in its locale', () => {
    expect(documentPath('pages', { id: 4 })).toBe('/collections/pages/4')
    expect(documentPath('pages', { id: 4, locale: 'fr' })).toBe('/collections/pages/4?locale=fr')
  })
})
