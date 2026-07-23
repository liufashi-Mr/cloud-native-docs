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
- Domains have no individual border, radius, shadow, or colored outline. They remain visually independent through generous internal padding and very light grid separators only where an adjacent domain exists.
- Use a zero-gap grid with separators between columns and rows. Wide layouts separate three columns, medium layouts separate two, and mobile layouts separate each stacked neighbor; no line should appear beside an empty grid slot.
- Topic rows form a compact list inside each module: use subtle separators and no nested mini-card treatment. The Kubernetes row may use a very light brand-tinted surface without a strong border.
- Wide layouts use three domain columns, medium layouts use two, and mobile layouts use one. The page must not overflow horizontally.
- Light/dark modes continue to use existing VitePress variables; domain tones remain small-area accents rather than large color fields.

## Behavior and Accessibility

- No homepage search button is rendered.
- The completed Kubernetes status is rendered as a lightweight status icon plus text, without a bordered pill.
- Planned topics remain non-interactive `div` elements without keyboard focus.
- Kubernetes remains the only interactive topic and recommended-start link.
- Existing heading hierarchy, focus styles, theme behavior, and VitePress global search remain intact.

## Verification

- Focused homepage tests assert there is no homepage search button and continue to assert the five paths, six domains, 24 topics, exact path sequences, Kubernetes link, and planned-topic semantics.
- Typecheck and the full Vitest suite pass.
- Production build and browser checks verify independent domain boundaries, responsive layout, readable light/dark rendering, and working global search.

## Out of Scope

- No changes to Kubernetes content, route structure, global navigation labels, CI, or the existing diagram/fullscreen implementation.
