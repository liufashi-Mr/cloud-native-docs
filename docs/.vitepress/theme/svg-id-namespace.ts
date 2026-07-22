import { generate, ident, parse, walk } from 'css-tree'

const URL_REFERENCE_PATTERN = /url\(\s*(["']?)\s*#([^)"']+?)\s*\1\s*\)/gi
const ARIA_REFERENCE_ATTRIBUTES = new Set([
  'aria-labelledby',
  'aria-describedby',
])
const XLINK_NAMESPACE = 'http://www.w3.org/1999/xlink'

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

function rewriteCss(
  css: string,
  idMap: ReadonlyMap<string, string>,
  context: 'declarationList' | undefined,
): string {
  try {
    let parseFailed = false
    const ast = parse(css, {
      context,
      parseCustomProperty: true,
      onParseError: () => {
        parseFailed = true
      },
    })
    if (parseFailed) return css

    walk(ast, (node) => {
      if (context === undefined && node.type === 'IdSelector') {
        const namespacedId = idMap.get(ident.decode(node.name))
        if (namespacedId) node.name = ident.encode(namespacedId)
        return
      }
      if (node.type !== 'Url' || !node.value.startsWith('#')) return

      const namespacedId = idMap.get(node.value.slice(1))
      if (namespacedId) node.value = `#${namespacedId}`
    })
    return generate(ast)
  } catch {
    return css
  }
}

function rewriteStyle(
  style: string,
  idMap: ReadonlyMap<string, string>,
): string {
  return rewriteCss(style, idMap, undefined)
}

function rewriteInlineStyle(
  style: string,
  idMap: ReadonlyMap<string, string>,
): string {
  return rewriteCss(style, idMap, 'declarationList')
}

function allocateElementIds(
  elements: Element[],
  prefix: string,
): ReadonlyMap<string, string> {
  const firstTargetBySource = new Map<string, string>()
  const usedTargets = new Set<string>()

  for (const element of elements) {
    const sourceId = element.getAttribute('id') ?? ''
    const baseTarget = `${prefix}${sourceId}`
    let targetId = baseTarget
    let suffix = 2
    while (usedTargets.has(targetId)) {
      targetId = `${baseTarget}-${suffix}`
      suffix += 1
    }

    usedTargets.add(targetId)
    if (!firstTargetBySource.has(sourceId)) {
      firstTargetBySource.set(sourceId, targetId)
    }
    element.setAttribute('id', targetId)
  }

  return firstTargetBySource
}

function isHrefReference(attribute: Attr): boolean {
  return attribute.localName.toLowerCase() === 'href' &&
    (attribute.namespaceURI === null || attribute.namespaceURI === XLINK_NAMESPACE)
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
  const idMap = allocateElementIds(elementsWithIds, prefix)

  for (const element of elements) {
    for (const attribute of Array.from(element.attributes)) {
      const attributeName = attribute.name.toLowerCase()
      let value = attribute.value

      if (isHrefReference(attribute)) {
        value = rewriteFragmentReference(value, idMap)
      } else if (ARIA_REFERENCE_ATTRIBUTES.has(attributeName)) {
        value = value
          .trim()
          .split(/\s+/)
          .map((id) => idMap.get(id) ?? id)
          .join(' ')
      }

      value = attribute.localName.toLowerCase() === 'style'
        ? rewriteInlineStyle(value, idMap)
        : rewriteUrlReferences(value, idMap)
      if (value === attribute.value) continue
      if (attribute.namespaceURI) {
        element.setAttributeNS(attribute.namespaceURI, attribute.name, value)
      } else {
        element.setAttribute(attribute.name, value)
      }
    }
  }

  for (const style of Array.from(root.querySelectorAll('style'))) {
    const content = style.textContent ?? ''
    style.textContent = rewriteStyle(content, idMap)
  }

  return new XMLSerializer().serializeToString(root)
}
