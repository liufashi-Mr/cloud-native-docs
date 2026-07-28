# Cloud Native Project Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename every project-identity use of k8s to cloud-native while preserving Kubernetes technical naming and migrating existing browser preferences.

**Architecture:** Keep the current VitePress structure and interaction behavior. Rename active CSS, component, package, deployment, and persistence identifiers in place; both the pre-paint script and hydrated Vue code read new storage keys first and migrate valid legacy keys. Treat the GitHub repository and local workspace rename as final operational steps after the repository content passes all checks.

**Tech Stack:** VitePress 1.6, Vue 3, TypeScript, Vitest, GitHub Actions, GitHub CLI

---

## File Map

- `package.json`, `package-lock.json`: canonical npm project name.
- `.github/workflows/deploy-pages.yml`: dynamic Pages base calculation; behavior remains unchanged.
- `docs/.vitepress/config.mts`: base-aware site setup and pre-paint preference migration.
- `docs/.vitepress/theme/appearance.ts`: hydrated appearance persistence, migration, and CSS variable writes.
- `docs/.vitepress/theme/components/SidebarResizeHandle.vue`: sidebar persistence migration and component/runtime class rename.
- `docs/.vitepress/theme/components/AppearanceControl.vue`: appearance component class rename.
- `docs/.vitepress/theme/components/BackToTop.vue`: button and transition class rename.
- `docs/.vitepress/theme/Layout.vue`: desktop/mobile slot class rename.
- `docs/.vitepress/theme/styles.css`: complete custom token and shared class namespace rename.
- `tests/appearance.test.ts`, `tests/appearance-control.test.ts`: client appearance migration and current-key behavior.
- `tests/appearance-integration.test.ts`: pre-paint script and integrated class/token contract.
- `tests/sidebar-resize-handle.test.ts`: sidebar migration and current-key behavior.
- `tests/theme-styles.test.ts`, `tests/back-to-top.test.ts`, `tests/content.test.ts`: renamed visual contracts.
- `tests/github-pages.test.ts`: renamed GitHub repository and Pages base contract.
- `tests/project-naming.test.ts`: active project identity regression guard.
- `docs/superpowers/specs/2026-07-21-k8s-concepts-docs-design.md`: rename the initial module design and update project identifiers.
- `docs/superpowers/specs/2026-07-22-brand-and-mermaid-viewer-design.md`: update the historical visible-brand reference.
- `docs/superpowers/plans/2026-07-21-k8s-concepts-site.md`: rename the initial implementation plan and update project identifiers.
- `docs/superpowers/plans/2026-07-22-github-pages-deployment.md`: update package and Pages path examples.
- `docs/superpowers/plans/2026-07-22-kubernetes-brand-mermaid-viewer.md`: update the historical visible-brand reference.
- `docs/superpowers/plans/2026-07-23-cloud-native-handbook-homepage.md`: update CSS, storage, and Pages examples.
- `docs/superpowers/plans/2026-07-24-brand-navigation-and-appearance.md`: update appearance class examples.

### Task 1: Package And Pages Identity

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `tests/github-pages.test.ts`
- Create: `tests/project-naming.test.ts`

- [ ] **Step 1: Write the failing package and Pages identity tests**

Create `tests/project-naming.test.ts`:

~~~ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const root = process.cwd()

describe('cloud-native project identity', () => {
  it('uses cloud-native as the npm package name', () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(root, 'package.json'), 'utf8'),
    ) as { name: string }
    const packageLock = JSON.parse(
      readFileSync(resolve(root, 'package-lock.json'), 'utf8'),
    ) as { name: string; packages: Record<string, { name?: string }> }

    expect(packageJson.name).toBe('cloud-native')
    expect(packageLock.name).toBe('cloud-native')
    expect(packageLock.packages['']?.name).toBe('cloud-native')
  })
})
~~~

In `tests/github-pages.test.ts`, change the project Pages case to:

~~~ts
['project Pages', 'liufashi-Mr/cloud-native', '/cloud-native/'],
~~~

- [ ] **Step 2: Run the focused tests to verify they fail**

Run:

~~~bash
npx vitest run tests/project-naming.test.ts tests/github-pages.test.ts
~~~

Expected: FAIL because the package is still `k8s-concepts-handbook`. The Pages case already passes because the workflow derives its base from the repository value supplied by the test.

- [ ] **Step 3: Update package metadata**

Set the root `name` in `package.json`, `package-lock.json`, and `package-lock.json.packages[""]` to:

~~~json
{
  "name": "cloud-native"
}
~~~

Do not change dependency names or integrity hashes.

- [ ] **Step 4: Run the focused tests**

Run:

~~~bash
npx vitest run tests/project-naming.test.ts tests/github-pages.test.ts
~~~

Expected: PASS.

- [ ] **Step 5: Commit package and Pages identity**

~~~bash
git add package.json package-lock.json tests/github-pages.test.ts tests/project-naming.test.ts
git commit -m "chore: rename project package identity"
~~~

### Task 2: Appearance Preference And Token Migration

**Files:**
- Modify: `docs/.vitepress/theme/appearance.ts`
- Modify: `tests/appearance.test.ts`
- Modify: `tests/appearance-control.test.ts`

- [ ] **Step 1: Write failing migration tests**

In `tests/appearance.test.ts`, update current-key assertions to `cloud-native-theme-color` and `cloud-native-theme-mode`, then add:

~~~ts
it('migrates valid legacy appearance preferences', () => {
  localStorage.setItem('k8s-theme-color', '#2b69a7')
  localStorage.setItem('k8s-theme-mode', 'dark')

  expect(loadAppearance()).toEqual({ color: '#2B69A7', mode: 'dark' })
  expect(localStorage.getItem('cloud-native-theme-color')).toBe('#2B69A7')
  expect(localStorage.getItem('cloud-native-theme-mode')).toBe('dark')
  expect(localStorage.getItem('k8s-theme-color')).toBeNull()
  expect(localStorage.getItem('k8s-theme-mode')).toBeNull()
})

it('prefers valid cloud-native appearance preferences', () => {
  localStorage.setItem('cloud-native-theme-color', '#555DB0')
  localStorage.setItem('cloud-native-theme-mode', 'light')
  localStorage.setItem('k8s-theme-color', '#2B69A7')
  localStorage.setItem('k8s-theme-mode', 'dark')

  expect(loadAppearance()).toEqual({ color: '#555DB0', mode: 'light' })
})

it('falls back to valid legacy values when current values are invalid', () => {
  localStorage.setItem('cloud-native-theme-color', '#xyzxyz')
  localStorage.setItem('cloud-native-theme-mode', 'sepia')
  localStorage.setItem('k8s-theme-color', '#2b69a7')
  localStorage.setItem('k8s-theme-mode', 'dark')

  expect(loadAppearance()).toEqual({ color: '#2B69A7', mode: 'dark' })
})
~~~

Update every CSS-variable expectation in this test and `tests/appearance-control.test.ts` from `--k8s-*` to `--cloud-native-*`. Update control persistence assertions to the new current keys.

- [ ] **Step 2: Verify the appearance tests fail**

Run:

~~~bash
npx vitest run tests/appearance.test.ts tests/appearance-control.test.ts
~~~

Expected: FAIL on new storage keys, migration behavior, and renamed CSS variables.

- [ ] **Step 3: Add current and legacy key handling**

In `appearance.ts`, define:

~~~ts
const COLOR_STORAGE_KEY = 'cloud-native-theme-color'
const MODE_STORAGE_KEY = 'cloud-native-theme-mode'
const LEGACY_COLOR_STORAGE_KEY = 'k8s-theme-color'
const LEGACY_MODE_STORAGE_KEY = 'k8s-theme-mode'

function readMigratedValue<T extends string>(
  storage: Storage,
  currentKey: string,
  legacyKey: string,
  normalize: (value: string) => T | null,
): T | null {
  let currentValue: string | null = null
  try {
    currentValue = storage.getItem(currentKey)
  } catch {
    return null
  }

  const normalizedCurrent = normalize(currentValue ?? '')
  if (normalizedCurrent !== null) return normalizedCurrent

  let legacyValue: string | null = null
  try {
    legacyValue = storage.getItem(legacyKey)
  } catch {
    return null
  }

  const normalizedLegacy = normalize(legacyValue ?? '')
  if (normalizedLegacy === null) return null

  try {
    storage.setItem(currentKey, normalizedLegacy)
    storage.removeItem(legacyKey)
  } catch {
    // Migration is best-effort; the valid value still applies in memory.
  }
  return normalizedLegacy
}
~~~

Use `readMigratedValue` in `loadAppearance()`:

~~~ts
const storedColor = readMigratedValue(
  storage,
  COLOR_STORAGE_KEY,
  LEGACY_COLOR_STORAGE_KEY,
  normalizeHex,
)
if (storedColor !== null) color = storedColor

const storedMode = readMigratedValue(
  storage,
  MODE_STORAGE_KEY,
  LEGACY_MODE_STORAGE_KEY,
  (value) => (isAppearanceMode(value) ? value : null),
)
if (storedMode !== null) mode = storedMode
~~~

`saveAppearance()` writes only the two `cloud-native-*` keys.

- [ ] **Step 4: Rename appearance CSS variable writes**

Change every `root.style.setProperty('--k8s-...')` in `applyAppearance()` to the corresponding `--cloud-native-...` name. Preserve all derived values and contrast logic.

- [ ] **Step 5: Run the focused appearance tests**

Run:

~~~bash
npx vitest run tests/appearance.test.ts tests/appearance-control.test.ts
~~~

Expected: PASS.

- [ ] **Step 6: Commit appearance migration**

~~~bash
git add docs/.vitepress/theme/appearance.ts tests/appearance.test.ts tests/appearance-control.test.ts
git commit -m "feat: migrate cloud-native appearance settings"
~~~

### Task 3: Pre-Paint And Sidebar Migration

**Files:**
- Modify: `docs/.vitepress/config.mts`
- Modify: `docs/.vitepress/theme/components/SidebarResizeHandle.vue`
- Modify: `tests/appearance-integration.test.ts`
- Modify: `tests/sidebar-resize-handle.test.ts`

- [ ] **Step 1: Write failing pre-paint and sidebar tests**

In `tests/appearance-integration.test.ts`, require all current keys and tokens:

~~~ts
for (const contract of [
  'cloud-native-theme-color',
  'cloud-native-theme-mode',
  'cloud-native-sidebar-width',
  '--cloud-native-accent',
  '--cloud-native-accent-dark',
  '--cloud-native-accent-text',
  '--cloud-native-accent-text-dark',
  '--cloud-native-accent-button',
  '--cloud-native-accent-button-hover',
  '--cloud-native-accent-button-active',
]) {
  expect(config).toContain(contract)
}

for (const legacyKey of [
  'k8s-theme-color',
  'k8s-theme-mode',
  'k8s-sidebar-width',
]) {
  expect(config).toContain(legacyKey)
}
~~~

In `tests/sidebar-resize-handle.test.ts`, update current-key/token/class assertions to `cloud-native` and add:

~~~ts
it('migrates a valid legacy sidebar width', async () => {
  localStorage.setItem('k8s-sidebar-width', '260')

  const wrapper = mount(SidebarResizeHandle)
  await nextTick()

  expect(wrapper.get('[role="separator"]').attributes('aria-valuenow')).toBe('260')
  expect(localStorage.getItem('cloud-native-sidebar-width')).toBe('260')
  expect(localStorage.getItem('k8s-sidebar-width')).toBeNull()
})

it('prefers a valid cloud-native sidebar width', async () => {
  localStorage.setItem('cloud-native-sidebar-width', '272')
  localStorage.setItem('k8s-sidebar-width', '260')

  const wrapper = mount(SidebarResizeHandle)
  await nextTick()

  expect(wrapper.get('[role="separator"]').attributes('aria-valuenow')).toBe('272')
})
~~~

- [ ] **Step 2: Verify the focused tests fail**

Run:

~~~bash
npx vitest run tests/appearance-integration.test.ts tests/sidebar-resize-handle.test.ts
~~~

Expected: FAIL because the pre-paint script and sidebar still use old current identifiers.

- [ ] **Step 3: Implement pre-paint migration**

Inside the inline head script in `config.mts`, add a validator-driven helper:

~~~js
function readPreference(currentKey, legacyKey, normalize) {
  var currentValue = localStorage.getItem(currentKey)
  var normalizedCurrent = normalize(currentValue || '')
  if (normalizedCurrent !== null) return normalizedCurrent

  var legacyValue = localStorage.getItem(legacyKey)
  var normalizedLegacy = normalize(legacyValue || '')
  if (normalizedLegacy === null) return null

  try {
    localStorage.setItem(currentKey, normalizedLegacy)
    localStorage.removeItem(legacyKey)
  } catch (_) {}
  return normalizedLegacy
}
~~~

Read color, mode, and width with new keys first and the corresponding legacy keys second. Normalize color to uppercase; accept only `auto|light|dark`; accept only numeric width from 220 through 380. Write `--cloud-native-sidebar-width` and all `--cloud-native-accent*` variables. Keep the outer storage `try/catch` and existing dark-mode calculation unchanged.

- [ ] **Step 4: Implement sidebar migration**

Use these keys in `SidebarResizeHandle.vue`:

~~~ts
const STORAGE_KEY = 'cloud-native-sidebar-width'
const LEGACY_STORAGE_KEY = 'k8s-sidebar-width'

function validStoredWidth(value: string | null): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= MIN_WIDTH && parsed <= MAX_WIDTH
    ? parsed
    : null
}

function readStoredItem(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function persistStoredItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Persistence is optional; the current width still applies in memory.
  }
}

function removeStoredItem(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // Persistence is optional; resetting still updates the current page.
  }
}

function readInitialWidth(): void {
  const current = validStoredWidth(readStoredItem(STORAGE_KEY))
  if (current !== null) {
    applyWidth(current, false)
    return
  }

  const legacy = validStoredWidth(readStoredItem(LEGACY_STORAGE_KEY))
  if (legacy !== null) {
    applyWidth(legacy, false)
    persistStoredItem(STORAGE_KEY, String(legacy))
    if (readStoredItem(STORAGE_KEY) === String(legacy)) {
      removeStoredItem(LEGACY_STORAGE_KEY)
    }
    return
  }

  width.value = clampWidth(Math.min(296, Math.max(232, window.innerWidth * 0.19)))
}
~~~

Use `persistStoredItem` inside `applyWidth` and `removeStoredItem` inside `resetWidth`. Rename the sidebar CSS variable and root resizing state class to `cloud-native`. Reset removes the current key and current CSS variable; it must not write the legacy key.

- [ ] **Step 5: Run the focused tests**

Run:

~~~bash
npx vitest run tests/appearance-integration.test.ts tests/sidebar-resize-handle.test.ts
~~~

Expected: PASS.

- [ ] **Step 6: Commit pre-paint and sidebar migration**

~~~bash
git add docs/.vitepress/config.mts docs/.vitepress/theme/components/SidebarResizeHandle.vue tests/appearance-integration.test.ts tests/sidebar-resize-handle.test.ts
git commit -m "feat: migrate prepaint and sidebar settings"
~~~

### Task 4: CSS And Component Namespace

**Files:**
- Modify: `docs/.vitepress/theme/styles.css`
- Modify: `docs/.vitepress/theme/Layout.vue`
- Modify: `docs/.vitepress/theme/components/AppearanceControl.vue`
- Modify: `docs/.vitepress/theme/components/BackToTop.vue`
- Modify: `docs/.vitepress/theme/components/SidebarResizeHandle.vue`
- Modify: `tests/appearance-integration.test.ts`
- Modify: `tests/back-to-top.test.ts`
- Modify: `tests/content.test.ts`
- Modify: `tests/sidebar-resize-handle.test.ts`
- Modify: `tests/theme-styles.test.ts`

- [ ] **Step 1: Change all visual-contract tests to the new namespace**

Apply these exact test mappings:

~~~text
--k8s-*                         -> --cloud-native-*
.k8s-appearance*               -> .cloud-native-appearance*
.k8s-sidebar-resize-handle*    -> .cloud-native-sidebar-resize-handle*
k8s-sidebar-resizing           -> cloud-native-sidebar-resizing
.k8s-back-to-top*              -> .cloud-native-back-to-top*
k8s-appearance-slot*           -> cloud-native-appearance-slot*
~~~

Do not alter VitePress-owned `--vp-*` variables.

- [ ] **Step 2: Run the visual-contract tests to verify failure**

Run:

~~~bash
npx vitest run tests/appearance-integration.test.ts tests/back-to-top.test.ts tests/content.test.ts tests/sidebar-resize-handle.test.ts tests/theme-styles.test.ts
~~~

Expected: FAIL on old CSS variables and component classes.

- [ ] **Step 3: Rename the active CSS variable namespace**

In `styles.css`, replace every custom variable definition and reference with the same suffix under `--cloud-native-*`. This includes:

~~~css
--cloud-native-page
--cloud-native-surface
--cloud-native-soft
--cloud-native-text
--cloud-native-muted
--cloud-native-line
--cloud-native-code
--cloud-native-accent
--cloud-native-accent-dark
--cloud-native-accent-text
--cloud-native-accent-text-dark
--cloud-native-accent-button
--cloud-native-accent-button-hover
--cloud-native-accent-button-active
--cloud-native-accent-active
--cloud-native-accent-soft
--cloud-native-sidebar-width
--cloud-native-outline-width
--cloud-native-content-padding
~~~

Preserve every existing value and responsive rule.

- [ ] **Step 4: Rename component and transition classes**

Apply the mappings from Step 1 consistently in Vue templates, scoped styles, global styles, and transition names. The BackToTop template must become:

~~~vue
<Transition name="cloud-native-back-to-top">
  <button
    v-if="visible"
    class="cloud-native-back-to-top"
    type="button"
    aria-label="返回顶部"
    title="返回顶部"
    @click="scrollToTop"
  >
    <ArrowUp :size="18" aria-hidden="true" />
  </button>
</Transition>
~~~

Keep all dimensions, colors, accessibility attributes, events, and motion timings unchanged.

- [ ] **Step 5: Run the visual-contract tests**

Run:

~~~bash
npx vitest run tests/appearance-integration.test.ts tests/back-to-top.test.ts tests/content.test.ts tests/sidebar-resize-handle.test.ts tests/theme-styles.test.ts
~~~

Expected: PASS.

- [ ] **Step 6: Commit the CSS and component namespace**

~~~bash
git add docs/.vitepress/theme/styles.css docs/.vitepress/theme/Layout.vue docs/.vitepress/theme/components/AppearanceControl.vue docs/.vitepress/theme/components/BackToTop.vue docs/.vitepress/theme/components/SidebarResizeHandle.vue tests/appearance-integration.test.ts tests/back-to-top.test.ts tests/content.test.ts tests/sidebar-resize-handle.test.ts tests/theme-styles.test.ts
git commit -m "refactor: rename cloud-native ui namespace"
~~~

### Task 5: Historical Maintenance Documents And Naming Guard

**Files:**
- Rename: `docs/superpowers/specs/2026-07-21-k8s-concepts-docs-design.md`
- Modify: `docs/superpowers/specs/2026-07-22-brand-and-mermaid-viewer-design.md`
- Rename: `docs/superpowers/plans/2026-07-21-k8s-concepts-site.md`
- Modify: `docs/superpowers/plans/2026-07-22-github-pages-deployment.md`
- Modify: `docs/superpowers/plans/2026-07-22-kubernetes-brand-mermaid-viewer.md`
- Modify: `docs/superpowers/plans/2026-07-23-cloud-native-handbook-homepage.md`
- Modify: `docs/superpowers/plans/2026-07-24-brand-navigation-and-appearance.md`
- Modify: `tests/project-naming.test.ts`

- [ ] **Step 1: Add active-identity regression tests**

Append to `tests/project-naming.test.ts`:

~~~ts
it('does not use the old project namespace in active UI code', () => {
  const activeFiles = [
    'docs/.vitepress/theme/Layout.vue',
    'docs/.vitepress/theme/components/AppearanceControl.vue',
    'docs/.vitepress/theme/components/BackToTop.vue',
    'docs/.vitepress/theme/components/SidebarResizeHandle.vue',
    'docs/.vitepress/theme/styles.css',
  ]

  for (const file of activeFiles) {
    const source = readFileSync(resolve(root, file), 'utf8')
    expect(source, file).not.toMatch(/(?:--|\.)k8s-/)
    expect(source, file).not.toContain('k8s-sidebar-resizing')
  }
})

it('keeps legacy storage keys isolated to migration sources', () => {
  const runtimeFiles = [
    'docs/.vitepress/config.mts',
    'docs/.vitepress/theme/appearance.ts',
    'docs/.vitepress/theme/components/SidebarResizeHandle.vue',
    'docs/.vitepress/theme/components/AppearanceControl.vue',
    'docs/.vitepress/theme/components/BackToTop.vue',
    'docs/.vitepress/theme/Layout.vue',
    'docs/.vitepress/theme/styles.css',
  ]
  const sources = new Map(
    runtimeFiles.map((file) => [
      file,
      readFileSync(resolve(root, file), 'utf8'),
    ]),
  )
  const owners = (legacyKey: string) =>
    runtimeFiles.filter((file) => sources.get(file)?.includes(legacyKey))

  expect(owners('k8s-theme-color')).toEqual([
    'docs/.vitepress/config.mts',
    'docs/.vitepress/theme/appearance.ts',
  ])
  expect(owners('k8s-theme-mode')).toEqual([
    'docs/.vitepress/config.mts',
    'docs/.vitepress/theme/appearance.ts',
  ])
  expect(owners('k8s-sidebar-width')).toEqual([
    'docs/.vitepress/config.mts',
    'docs/.vitepress/theme/components/SidebarResizeHandle.vue',
  ])

  for (const [file, source] of sources) {
    expect(source, file).toContain('cloud-native-')
  }

  const styles = sources.get('docs/.vitepress/theme/styles.css') ?? ''
  expect(styles).not.toContain('k8s-')
})
~~~

- [ ] **Step 2: Run the naming guard**

Run:

~~~bash
npx vitest run tests/project-naming.test.ts
~~~

Expected: PASS because Task 4 completed the namespace cleanup; these tests prevent future regressions.

- [ ] **Step 3: Rename the two historical project files**

Use these exact target names:

~~~text
docs/superpowers/specs/2026-07-21-k8s-concepts-docs-design.md
  -> docs/superpowers/specs/2026-07-21-cloud-native-handbook-initial-kubernetes-module-design.md

docs/superpowers/plans/2026-07-21-k8s-concepts-site.md
  -> docs/superpowers/plans/2026-07-21-cloud-native-handbook-initial-kubernetes-module.md
~~~

Rename with `mv`, then use `apply_patch` for content edits so Git records readable renames.

- [ ] **Step 4: Update historical project-identity references**

Across historical specs/plans, make these semantic updates:

~~~text
k8s-concepts-handbook             -> cloud-native
liufashi-Mr/k8s-doc               -> liufashi-Mr/cloud-native
/k8s-doc/                         -> /cloud-native/
--k8s-*                           -> --cloud-native-*
.k8s-appearance*                  -> .cloud-native-appearance*
old local-storage current keys    -> cloud-native-* current keys
~~~

Rewrite sentences that explicitly discuss the old identifiers so they remain true, for example:

~~~text
Do not rename existing --k8s-* CSS variables...
  -> Keep the existing --cloud-native-* CSS variables stable in this task...
~~~

Keep every Kubernetes module name, `/kubernetes/` route, Kubernetes API term, `k8s.io` domain, manifest key, and technical statement unchanged. The approved rename design and this implementation plan may retain old strings where they document migration inputs.

- [ ] **Step 5: Audit every remaining lowercase k8s match**

Run:

~~~bash
rg -n --hidden --glob '!node_modules' --glob '!.git' --glob '!docs/.vitepress/dist/**' 'k8s' .
~~~

Expected remaining categories only:

~~~text
approved rename design and implementation plan migration descriptions
the three legacy localStorage key constants/usages
real Kubernetes ecosystem identifiers such as *.k8s.io
technical prose where k8s is intentionally a Kubernetes abbreviation
~~~

Any package, repository, Pages, CSS, component, or current storage identifier match must be fixed.

- [ ] **Step 6: Run the naming and focused integration tests**

Run:

~~~bash
npx vitest run tests/project-naming.test.ts tests/appearance-integration.test.ts tests/theme-styles.test.ts
~~~

Expected: PASS.

- [ ] **Step 7: Commit historical cleanup and naming guard**

~~~bash
git add docs/superpowers/specs docs/superpowers/plans tests/project-naming.test.ts
git commit -m "docs: align project history with cloud-native naming"
~~~

### Task 6: Full Verification And Browser Regression

**Files:**
- Verify all modified files.
- Modify only files needed to correct a discovered regression.

- [ ] **Step 1: Run the complete automated suite**

~~~bash
npm test
npm run typecheck
git diff --check
~~~

Expected: all Vitest suites pass, typecheck exits 0, and `git diff --check` prints no output.

- [ ] **Step 2: Verify both supported build bases**

Run:

~~~bash
npm run build
BASE_PATH=/cloud-native/ npm run build -- --base=/cloud-native/
~~~

Expected: both builds complete successfully. In the second build, generated asset and favicon URLs begin with `/cloud-native/`, while topic links resolve under the same base.

- [ ] **Step 3: Inspect the production output identity**

Run:

~~~bash
rg -n 'cloud-native-(theme|sidebar)|--cloud-native-' docs/.vitepress/dist/index.html
rg -n '/cloud-native/(assets/|logo\.png|kubernetes/|docker-oci/)' docs/.vitepress/dist/index.html
~~~

Expected: the inline script contains new current identifiers and legacy keys only in migration reads; asset and topic links are base-aware.

- [ ] **Step 4: Run the local site and perform visual checks**

Start:

~~~bash
npm run dev -- --host 127.0.0.1 --port 5173
~~~

Using the in-app browser, inspect these routes at desktop 1440x900 and mobile 390x844:

~~~text
http://127.0.0.1:5173/
http://127.0.0.1:5173/kubernetes/
http://127.0.0.1:5173/docker-oci/
~~~

Verify logo/favicon loading, theme color persistence, auto/light/dark cycling, sidebar visibility and resizing, back-to-top behavior, and absence of layout shifts. Confirm the browser writes only `cloud-native-*` current keys after interaction.

For the migration check, clear the six related keys, set these legacy values, and reload a page with a sidebar:

~~~js
localStorage.setItem('k8s-theme-color', '#2B69A7')
localStorage.setItem('k8s-theme-mode', 'dark')
localStorage.setItem('k8s-sidebar-width', '260')
location.reload()
~~~

Expected after reload: the page is dark with the blue accent and a 260px sidebar; the three `cloud-native-*` keys contain the migrated values and the three legacy keys are absent.

- [ ] **Step 5: Commit any verification fixes**

If verification required source changes, rerun the affected focused test first, then:

~~~bash
git add -u docs/.vitepress tests package.json package-lock.json
git commit -m "fix: resolve cloud-native rename regression"
~~~

If no fixes were needed, do not create an empty commit.

### Task 7: GitHub Repository And Local Workspace Rename

**Files:**
- External: GitHub repository `liufashi-Mr/k8s-doc`
- Local Git config: `remote.origin.url`
- Local directory: `/Users/liufashi/workspace/personal/k8s`

- [ ] **Step 1: Confirm clean, verified local state and GitHub access**

Run:

~~~bash
git status --short --branch
gh auth status
gh repo view liufashi-Mr/k8s-doc --json nameWithOwner,url,defaultBranchRef
if gh repo view liufashi-Mr/cloud-native >/dev/null 2>&1; then exit 1; fi
test ! -e /Users/liufashi/workspace/personal/cloud-native
~~~

Expected: working tree clean, GitHub authentication valid, old repository resolves with default branch `main`, no repository named `liufashi-Mr/cloud-native` exists yet, and the target local directory does not exist.

- [ ] **Step 2: Rename the GitHub repository**

Run:

~~~bash
gh repo rename cloud-native --repo liufashi-Mr/k8s-doc --yes
gh repo view liufashi-Mr/cloud-native --json nameWithOwner,url,defaultBranchRef
~~~

Expected: `nameWithOwner` is `liufashi-Mr/cloud-native`.

- [ ] **Step 3: Update origin and publish main**

Run:

~~~bash
git remote set-url origin git@github.com:liufashi-Mr/cloud-native.git
git remote -v
git ls-remote origin HEAD
git push origin main
~~~

Expected: fetch and push URLs use `cloud-native.git`, remote HEAD resolves, and `main` pushes successfully.

- [ ] **Step 4: Verify the Pages deployment**

Run:

~~~bash
gh run list --repo liufashi-Mr/cloud-native --workflow deploy-pages.yml --branch main --limit 1
gh api repos/liufashi-Mr/cloud-native/pages --jq '{html_url, status}'
~~~

Resolve and watch the newest deployment run:

~~~bash
pages_run_id="$(gh run list --repo liufashi-Mr/cloud-native --workflow deploy-pages.yml --branch main --limit 1 --json databaseId --jq '.[0].databaseId')"
test -n "$pages_run_id"
gh run watch "$pages_run_id" --repo liufashi-Mr/cloud-native --exit-status
~~~

Expected: workflow succeeds and the Pages API reports the new `/cloud-native/` site URL.

- [ ] **Step 5: Stop the old-path dev server and rename the workspace**

Resolve any process listening on port 5173 with:

~~~bash
lsof -nP -iTCP:5173 -sTCP:LISTEN
~~~

Stop only the listed VitePress process, then run from `/Users/liufashi/workspace/personal`:

~~~bash
mv /Users/liufashi/workspace/personal/k8s /Users/liufashi/workspace/personal/cloud-native
~~~

Expected: the old path no longer exists and the new directory contains `.git`.

- [ ] **Step 6: Restart and verify from the new workspace path**

Run from `/Users/liufashi/workspace/personal/cloud-native`:

~~~bash
git status --short --branch
git remote -v
npm run dev -- --host 127.0.0.1 --port 5173
~~~

Expected: clean `main`, origin uses `cloud-native.git`, and the site loads at `http://127.0.0.1:5173/`.

## Final Acceptance

- [ ] npm package, GitHub repository, Pages path, remote URL, and local directory all use `cloud-native`.
- [ ] Active CSS variables, CSS classes, transition names, runtime root classes, and current storage keys all use the new prefix.
- [ ] Valid old appearance and sidebar preferences migrate once without visual flicker or behavior loss.
- [ ] Kubernetes technical names, routes, examples, and content remain unchanged.
- [ ] Full tests, typecheck, root build, project-base build, browser checks, GitHub Actions, and Pages deployment pass.
- [ ] Final `git status --short --branch` is clean.
