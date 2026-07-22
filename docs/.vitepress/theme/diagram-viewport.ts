export interface DiagramTransform {
  scale: number
  x: number
  y: number
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback
}

function positiveFiniteOr(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback
}

export function clamp(value: number, minimum: number, maximum: number): number {
  const finiteMinimum = finiteOr(minimum, 0)
  const finiteMaximum = finiteOr(maximum, finiteMinimum)
  const lower = Math.min(finiteMinimum, finiteMaximum)
  const upper = Math.max(finiteMinimum, finiteMaximum)
  const comparableValue = Number.isNaN(value) ? lower : value
  return Math.min(upper, Math.max(lower, comparableValue))
}

export function fitDiagram(
  viewportWidth: number,
  viewportHeight: number,
  diagramWidth: number,
  diagramHeight: number,
  padding: number,
): DiagramTransform {
  const width = finiteOr(viewportWidth, 0)
  const height = finiteOr(viewportHeight, 0)
  const contentWidth = positiveFiniteOr(diagramWidth, 1)
  const contentHeight = positiveFiniteOr(diagramHeight, 1)
  const inset = Math.max(0, finiteOr(padding, 0))
  const availableWidth = Math.max(1, width - inset * 2)
  const availableHeight = Math.max(1, height - inset * 2)
  const scale = Math.min(
    1,
    availableWidth / contentWidth,
    availableHeight / contentHeight,
  )

  return {
    scale,
    x: finiteOr((width - contentWidth * scale) / 2, 0),
    y: finiteOr((height - contentHeight * scale) / 2, 0),
  }
}

export function zoomDiagram(
  current: DiagramTransform,
  requestedScale: number,
  anchorX: number,
  anchorY: number,
  minimumScale = 0.1,
  maximumScale = 4,
): DiagramTransform {
  const currentScale = positiveFiniteOr(current.scale, 1)
  const currentX = finiteOr(current.x, 0)
  const currentY = finiteOr(current.y, 0)
  const anchorLeft = finiteOr(anchorX, 0)
  const anchorTop = finiteOr(anchorY, 0)
  const scale = clamp(requestedScale, minimumScale, maximumScale)
  const ratio = scale / currentScale

  return {
    scale,
    x: finiteOr(anchorLeft - (anchorLeft - currentX) * ratio, currentX),
    y: finiteOr(anchorTop - (anchorTop - currentY) * ratio, currentY),
  }
}

export function panDiagram(
  current: DiagramTransform,
  deltaX: number,
  deltaY: number,
): DiagramTransform {
  const scale = positiveFiniteOr(current.scale, 1)
  const x = finiteOr(current.x, 0)
  const y = finiteOr(current.y, 0)

  return {
    scale,
    x: finiteOr(x + finiteOr(deltaX, 0), x),
    y: finiteOr(y + finiteOr(deltaY, 0), y),
  }
}
