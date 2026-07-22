const URL_REFERENCE_PATTERN = /url\(\s*(["']?)\s*#([^)"']+?)\s*\1\s*\)/gi
const ARIA_REFERENCE_ATTRIBUTES = new Set([
  'aria-labelledby',
  'aria-describedby',
])

function safeNamespace(namespace: string): string {
  const cleaned = namespace
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')

  if (!cleaned) return 'svg'
  return /^[A-Za-z_]/.test(cleaned) ? cleaned : `svg-${cleaned}`
}

function rewriteUrlReferences(
  value: string,
  idMap: ReadonlyMap<string, string>,
): string {
  return value.replace(
    URL_REFERENCE_PATTERN,
    (reference, quote: string, rawId: string) => {
      const namespacedId = idMap.get(rawId.trim())
      return namespacedId
        ? `url(${quote}#${namespacedId}${quote})`
        : reference
    },
  )
}

function rewriteFragmentReference(
  value: string,
  idMap: ReadonlyMap<string, string>,
): string {
  const match = value.match(/^(\s*)#([^\s]+)(\s*)$/)
  if (!match) return value

  const namespacedId = idMap.get(match[2])
  return namespacedId ? `${match[1]}#${namespacedId}${match[3]}` : value
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function rewriteKnownIdSelectors(
  selector: string,
  idMap: ReadonlyMap<string, string>,
): string {
  const ids = Array.from(idMap.keys())
    .filter(Boolean)
    .sort((first, second) => second.length - first.length)
  if (ids.length === 0) return selector

  const pattern = new RegExp(
    `#(${ids.map(escapeRegExp).join('|')})(?![A-Za-z0-9_-])`,
    'g',
  )
  return selector.replace(
    pattern,
    (_match, id: string) => `#${idMap.get(id) ?? id}`,
  )
}

function rewriteStyle(
  style: string,
  idMap: ReadonlyMap<string, string>,
): string {
  const rewrittenUrls = rewriteUrlReferences(style, idMap)

  return rewrittenUrls.replace(/([^{}]+)\{/g, (block, prelude: string) => {
    if (prelude.trimStart().startsWith('@')) return block
    return `${rewriteKnownIdSelectors(prelude, idMap)}{`
  })
}

export function namespaceSvgIds(svg: string, namespace: string): string {
  let parsed: Document
  try {
    parsed = new DOMParser().parseFromString(svg, 'image/svg+xml')
  } catch {
    return svg
  }

  const root = parsed.documentElement
  if (
    root.localName.toLowerCase() !== 'svg' ||
    root.localName.toLowerCase() === 'parsererror' ||
    parsed.querySelector('parsererror')
  ) {
    return svg
  }

  const elements = [root, ...Array.from(root.querySelectorAll('*'))]
  const elementsWithIds = elements.filter((element) => element.hasAttribute('id'))
  if (elementsWithIds.length === 0) return svg

  const prefix = `${safeNamespace(namespace)}-`
  const idMap = new Map<string, string>()
  for (const element of elementsWithIds) {
    const id = element.getAttribute('id') ?? ''
    if (!idMap.has(id)) idMap.set(id, `${prefix}${id}`)
  }

  for (const element of elementsWithIds) {
    const id = element.getAttribute('id') ?? ''
    element.setAttribute('id', idMap.get(id) ?? `${prefix}${id}`)
  }

  for (const element of elements) {
    for (const attribute of Array.from(element.attributes)) {
      const attributeName = attribute.name.toLowerCase()
      let value = attribute.value

      if (attributeName === 'href' || attributeName === 'xlink:href') {
        value = rewriteFragmentReference(value, idMap)
      } else if (ARIA_REFERENCE_ATTRIBUTES.has(attributeName)) {
        value = value
          .trim()
          .split(/\s+/)
          .map((id) => idMap.get(id) ?? id)
          .join(' ')
      }

      value = rewriteUrlReferences(value, idMap)
      if (value !== attribute.value) element.setAttribute(attribute.name, value)
    }
  }

  for (const style of Array.from(root.querySelectorAll('style'))) {
    const content = style.textContent ?? ''
    style.textContent = rewriteStyle(content, idMap)
  }

  return new XMLSerializer().serializeToString(root)
}
