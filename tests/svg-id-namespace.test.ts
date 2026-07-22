import { describe, expect, it } from 'vitest'

import { namespaceSvgIds } from '../docs/.vitepress/theme/svg-id-namespace'

function parseSvg(svg: string): SVGSVGElement {
  const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml')
  const root = parsed.documentElement
  if (root.localName !== 'svg') throw new Error('SVG root not found')
  return root as unknown as SVGSVGElement
}

describe('namespaceSvgIds', () => {
  it('namespaces definitions and every supported reference to a known id', () => {
    const source = `
      <svg xmlns="http://www.w3.org/2000/svg"
        xmlns:xlink="http://www.w3.org/1999/xlink">
        <style>
          #node, #label { marker-end: url( '#arrow' ); clip-path: url(#clip); fill: #fff; }
          #fff { stroke: #123456; }
          #unknown { filter: url(#missing); }
        </style>
        <defs>
          <marker id="arrow" />
          <clipPath id="clip" />
          <filter id="shadow" />
        </defs>
        <title id="title">Title</title>
        <desc id="description">Description</desc>
        <text id="label">Label</text>
        <path id="fff" />
        <g id="node"
          marker-end="url( #arrow )"
          clip-path="url(&quot;#clip&quot;)"
          filter="url(#shadow) url( '#clip' ) url(#missing)"
          aria-labelledby="title label missing-label"
          aria-describedby="description missing-description">
          <a id="link" href="#node">
            <use id="shape" xlink:href="#fff" />
          </a>
          <use id="unknown-link" href="#missing" />
        </g>
      </svg>
    `

    const root = parseSvg(namespaceSvgIds(source, ' viewer / unsafe?! '))
    const prefix = 'viewer-unsafe-'
    const ids = Array.from(root.querySelectorAll('[id]'), (element) => element.id)

    expect(ids).toEqual([
      `${prefix}arrow`,
      `${prefix}clip`,
      `${prefix}shadow`,
      `${prefix}title`,
      `${prefix}description`,
      `${prefix}label`,
      `${prefix}fff`,
      `${prefix}node`,
      `${prefix}link`,
      `${prefix}shape`,
      `${prefix}unknown-link`,
    ])

    const node = root.querySelector<SVGGElement>(`#${prefix}node`)
    const link = root.querySelector<SVGAElement>(`#${prefix}link`)
    const shape = root.querySelector<SVGUseElement>(`#${prefix}shape`)
    const unknownLink = root.querySelector<SVGUseElement>(
      `#${prefix}unknown-link`,
    )
    const style = root.querySelector('style')?.textContent ?? ''

    expect(node?.getAttribute('marker-end')).toBe(`url(#${prefix}arrow)`)
    expect(node?.getAttribute('clip-path')).toBe(`url("#${prefix}clip")`)
    expect(node?.getAttribute('filter')).toBe(
      `url(#${prefix}shadow) url('#${prefix}clip') url(#missing)`,
    )
    expect(node?.getAttribute('aria-labelledby')).toBe(
      `${prefix}title ${prefix}label missing-label`,
    )
    expect(node?.getAttribute('aria-describedby')).toBe(
      `${prefix}description missing-description`,
    )
    expect(link?.getAttribute('href')).toBe(`#${prefix}node`)
    expect(shape?.getAttribute('xlink:href')).toBe(`#${prefix}fff`)
    expect(unknownLink?.getAttribute('href')).toBe('#missing')

    expect(style).toContain(`#${prefix}node, #${prefix}label`)
    expect(style).toContain(`url('#${prefix}arrow')`)
    expect(style).toContain(`url(#${prefix}clip)`)
    expect(style).toContain(`#${prefix}fff { stroke: #123456; }`)
    expect(style).toContain('#unknown { filter: url(#missing); }')
    expect(style).toContain('fill: #fff;')
  })

  it('creates a CSS-safe prefix from an empty or digit-leading namespace', () => {
    const source = '<svg xmlns="http://www.w3.org/2000/svg"><g id="node" /></svg>'

    expect(parseSvg(namespaceSvgIds(source, ' 123 / viewer!? ')).querySelector('[id]')?.id)
      .toBe('svg-123-viewer-node')
    expect(parseSvg(namespaceSvgIds(source, ' /?! ')).querySelector('[id]')?.id)
      .toBe('svg-node')
  })

  it.each([
    '<div id="node"></div>',
    '<svg><g id="node"></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><g /></svg>',
  ])('returns non-SVG, malformed, and id-free input unchanged', (source) => {
    expect(namespaceSvgIds(source, 'viewer')).toBe(source)
  })
})
