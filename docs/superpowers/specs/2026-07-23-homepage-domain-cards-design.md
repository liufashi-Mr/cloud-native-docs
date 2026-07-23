# Homepage Domain Cards and Search Removal Design

## Goal

Make the homepage technology catalog visually independent by domain and remove the duplicate homepage search button, while preserving the global VitePress search entry.

## Scope

- Remove the homepage search proxy button, its click handler, its icon import, and its focused test fixture/assertion.
- Keep the existing global navigation search unchanged.
- Render the six technology domains as independent responsive units.
- Keep the existing 24-topic catalog, Kubernetes link, planned-topic semantics, domain colors, theme switching, and route behavior unchanged.

## Visual Design

- The domain grid has no shared outer border.
- Each domain uses its own `1px` border, maximum `6px` radius, subtle theme-aware background tint, and restrained shadow.
- Domain cards are separated by a stable `16px` grid gap and use `align-items: start`, so different topic counts produce intentional independent heights.
- Topic rows remain compact and readable inside each domain, with lower-contrast borders so the domain boundary is the primary grouping signal.
- Wide layouts use three domain columns, medium layouts use two, and mobile layouts use one. The page must not overflow horizontally.
- Light/dark modes continue to use existing VitePress variables; domain tones remain small-area accents rather than large color fields.

## Behavior and Accessibility

- No homepage search button is rendered.
- Planned topics remain non-interactive `div` elements without keyboard focus.
- Kubernetes remains the only interactive topic and recommended-start link.
- Existing heading hierarchy, focus styles, theme behavior, and VitePress global search remain intact.

## Verification

- Focused homepage tests assert there is no homepage search button and continue to assert the five paths, six domains, 24 topics, exact path sequences, Kubernetes link, and planned-topic semantics.
- Typecheck and the full Vitest suite pass.
- Production build and browser checks verify independent domain boundaries, responsive layout, readable light/dark rendering, and working global search.

## Out of Scope

- No changes to Kubernetes content, route structure, global navigation labels, CI, or the existing diagram/fullscreen implementation.
