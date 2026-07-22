import { describe, expect, it } from 'vitest'

import {
  clamp,
  fitDiagram,
  panDiagram,
  zoomDiagram,
} from '../docs/.vitepress/theme/diagram-viewport'

describe('diagram viewport geometry', () => {
  it('fits and centers a diagram inside the viewport', () => {
    expect(fitDiagram(1000, 700, 2000, 1000, 48)).toEqual({
      scale: 0.452,
      x: 48,
      y: 124,
    })
  })

  it('keeps the pointer over the same diagram coordinate while zooming', () => {
    expect(
      zoomDiagram({ scale: 1, x: 20, y: 30 }, 2, 120, 130),
    ).toEqual({
      scale: 2,
      x: -80,
      y: -70,
    })
  })

  it('adds pointer movement to the current pan', () => {
    expect(
      panDiagram({ scale: 1, x: 20, y: 30 }, 15, -5),
    ).toEqual({
      scale: 1,
      x: 35,
      y: 25,
    })
  })

  it('clamps values to inclusive scale bounds', () => {
    expect(clamp(0.01, 0.1, 4)).toBe(0.1)
    expect(clamp(2, 0.1, 4)).toBe(2)
    expect(clamp(8, 0.1, 4)).toBe(4)
    expect(clamp(Number.NEGATIVE_INFINITY, 0.1, 4)).toBe(0.1)
    expect(clamp(Number.POSITIVE_INFINITY, 0.1, 4)).toBe(4)
    expect(clamp(Number.NaN, 0.1, 4)).toBe(0.1)
  })

  it('clamps zoom to the default scale bounds', () => {
    expect(zoomDiagram({ scale: 1, x: 0, y: 0 }, 0.01, 0, 0)).toEqual({
      scale: 0.1,
      x: 0,
      y: 0,
    })
    expect(zoomDiagram({ scale: 1, x: 0, y: 0 }, 8, 0, 0)).toEqual({
      scale: 4,
      x: 0,
      y: 0,
    })
  })

  it.each([
    { minimum: -4, maximum: -0.1, requested: 2, expected: 2 },
    { minimum: 0, maximum: 4, requested: 0, expected: 0.1 },
    {
      minimum: Number.NaN,
      maximum: 4,
      requested: Number.POSITIVE_INFINITY,
      expected: 4,
    },
    { minimum: 5, maximum: 2, requested: 3, expected: 3 },
  ])(
    'normalizes zoom bounds $minimum and $maximum to a positive finite range',
    ({ minimum, maximum, requested, expected }) => {
      const result = zoomDiagram(
        { scale: 1, x: 0, y: 0 },
        requested,
        0,
        0,
        minimum,
        maximum,
      )

      expect(result.scale).toBe(expected)
      expect(Number.isFinite(result.scale)).toBe(true)
      expect(result.scale).toBeGreaterThan(0)
    },
  )

  it('preserves the anchor diagram coordinate from a non-unit scale', () => {
    const current = { scale: 2, x: 40, y: -20 }
    const anchor = { x: 160, y: 100 }
    const before = {
      x: (anchor.x - current.x) / current.scale,
      y: (anchor.y - current.y) / current.scale,
    }
    const result = zoomDiagram(current, 0.75, anchor.x, anchor.y)

    expect((anchor.x - result.x) / result.scale).toBeCloseTo(before.x)
    expect((anchor.y - result.y) / result.scale).toBeCloseTo(before.y)
  })

  it('keeps fit dimensions finite when padding consumes the viewport', () => {
    expect(fitDiagram(80, 60, 1000, 500, 100)).toEqual({
      scale: 0.001,
      x: 39.5,
      y: 29.75,
    })
  })

  it('normalizes invalid fit inputs to finite geometry', () => {
    expect(
      fitDiagram(Number.NaN, Number.POSITIVE_INFINITY, 0, -1, Number.NaN),
    ).toEqual({
      scale: 1,
      x: -0.5,
      y: -0.5,
    })
    expect(
      fitDiagram(100, 100, Number.NaN, Number.POSITIVE_INFINITY, 0),
    ).toEqual({
      scale: 1,
      x: 49.5,
      y: 49.5,
    })
  })

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'normalizes the invalid current scale %s before zooming',
    (scale) => {
      expect(zoomDiagram({ scale, x: 20, y: 30 }, 2, 120, 130)).toEqual({
        scale: 2,
        x: -80,
        y: -70,
      })
    },
  )

  it('does not propagate non-finite zoom inputs', () => {
    expect(
      zoomDiagram(
        {
          scale: Number.NaN,
          x: Number.POSITIVE_INFINITY,
          y: Number.NEGATIVE_INFINITY,
        },
        Number.NaN,
        Number.POSITIVE_INFINITY,
        Number.NaN,
      ),
    ).toEqual({ scale: 0.1, x: 0, y: 0 })
  })

  it('does not propagate non-finite pan inputs', () => {
    expect(
      panDiagram(
        {
          scale: Number.NaN,
          x: Number.POSITIVE_INFINITY,
          y: Number.NEGATIVE_INFINITY,
        },
        Number.NaN,
        Number.POSITIVE_INFINITY,
      ),
    ).toEqual({ scale: 1, x: 0, y: 0 })
  })
})
