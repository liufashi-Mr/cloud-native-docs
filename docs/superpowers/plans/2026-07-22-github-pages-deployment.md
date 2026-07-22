# GitHub Pages Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the production VitePress site from `main` to GitHub Pages with the correct `/k8s-doc/` project-site base path.

**Architecture:** A GitHub Actions workflow uses the official Pages actions, installs from `package-lock.json`, runs all quality gates, builds with VitePress's CLI `--base` override, uploads `docs/.vitepress/dist`, and deploys through the Pages environment. A focused test parses the YAML contract and verifies that a project-base build emits prefixed asset, navigation, logo, and favicon URLs.

**Tech Stack:** GitHub Actions, Node.js 22, npm, VitePress 1.6, Vitest, YAML parser.

---

### Task 1: Add the Pages workflow contract

**Files:**
- Create: `.github/workflows/deploy-pages.yml`
- Create: `tests/github-pages.test.ts`
- Modify: `docs/.vitepress/config.mts` only for a base-aware favicon; preserve all existing user edits in this dirty file.

- [ ] **Step 1: Write the failing workflow test**

Parse the workflow with the existing `yaml` package and assert the triggers, permissions, pinned official actions, install/test/typecheck/build/upload/deploy steps, artifact path, environment, and concurrency group:

```ts
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parse } from 'yaml'
import { describe, expect, it } from 'vitest'

describe('GitHub Pages deployment', () => {
  it('builds and deploys the documentation with official Pages actions', async () => {
    const source = await readFile(
      resolve(process.cwd(), '.github/workflows/deploy-pages.yml'),
      'utf8',
    )
    const workflow = parse(source)
    expect(workflow.on.push.branches).toEqual(['main'])
    expect(workflow.on).toHaveProperty('workflow_dispatch')
    expect(workflow.permissions).toEqual({
      contents: 'read',
      pages: 'write',
      'id-token': 'write',
    })
    expect(source).toContain('actions/checkout@v4')
    expect(source).toContain('actions/setup-node@v4')
    expect(source).toContain('actions/configure-pages@v5')
    expect(source).toContain('actions/upload-pages-artifact@v3')
    expect(source).toContain('actions/deploy-pages@v4')
    expect(source).toContain('npm ci')
    expect(source).toContain('npm test')
    expect(source).toContain('npm run typecheck')
    expect(source).toContain('npm run build -- --base="$BASE_PATH"')
    expect(source).toContain('path: docs/.vitepress/dist')
  })
})
```

- [ ] **Step 2: Run the test and observe RED**

```bash
npm test -- tests/github-pages.test.ts
```

Expected: FAIL because the workflow does not exist.

- [ ] **Step 3: Add the official GitHub Pages workflow**

Create:

```yaml
name: Deploy documentation to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Check out repository
        uses: actions/checkout@v4
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - name: Install dependencies
        run: npm ci
      - name: Run tests
        run: npm test
      - name: Run type checking
        run: npm run typecheck
      - name: Configure Pages
        uses: actions/configure-pages@v5
      - name: Build documentation
        run: |
          BASE_PATH="/${GITHUB_REPOSITORY#*/}/"
          npm run build -- --base="$BASE_PATH"
      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: docs/.vitepress/dist

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 4: Make the existing favicon respect the CLI base**

The CLI override rewrites theme links but not literal custom `head` URLs. Use VitePress's `transformHead` hook so the favicon receives the resolved site base without hard-coding the repository name:

```ts
export default defineConfig({
  // Keep every existing user-owned option unchanged.
  transformHead({ siteData }) {
    return [
      [
        'link',
        {
          rel: 'icon',
          type: 'image/svg+xml',
          href: `${siteData.base}kubernetes-logo.svg`,
        },
      ],
    ]
  },
```

Remove only the existing static favicon tuple from `head`; retain the theme bootstrap script and the user's `outlineTitle` and `returnToTopLabel` changes byte-for-byte.

Because `docs/.vitepress/config.mts` already has unrelated user edits, do not use `git add docs/.vitepress/config.mts`. Stage only the favicon hunk with a non-interactive index patch, then confirm `git diff --cached` contains no outline, sidebar, BackToTop, or unrelated style changes.

- [ ] **Step 5: Verify the workflow and project-base build**

Run:

```bash
npm test -- tests/github-pages.test.ts
npm test
npm run typecheck
npm run build -- --base=/k8s-doc/
git diff --check
```

Inspect `docs/.vitepress/dist/index.html` and require `/k8s-doc/assets/`, `/k8s-doc/kubernetes-logo.svg`, and `/k8s-doc/concepts/resource-model.html`; reject root-only `href="/kubernetes-logo.svg"`.

- [ ] **Step 6: Commit only the deployment changes**

Stage the new files normally and the config favicon hunk only:

```bash
git add .github/workflows/deploy-pages.yml tests/github-pages.test.ts
git diff --cached --check
git diff --cached --name-only
git commit -m "ci: deploy documentation to GitHub Pages"
```

Expected staged files: the workflow, the test, and only the intended config hunk. Existing BackToTop, outline spacing, and other user work remains in the working tree unchanged.

### Task 2: Validate the deployment artifact and workflow syntax

**Files:**
- Modify only if verification finds a defect: `.github/workflows/deploy-pages.yml`
- Modify only if verification finds a defect: `tests/github-pages.test.ts`

- [ ] **Step 1: Validate YAML and repository state**

```bash
npm test -- tests/github-pages.test.ts
git diff --check
git status --short
```

Expected: YAML parses, the focused test passes, and pre-existing user files remain modified/untracked rather than being dropped.

- [ ] **Step 2: Verify the generated project-site links**

```bash
npm run build -- --base=/k8s-doc/
rg -n '(/k8s-doc/assets/|/k8s-doc/kubernetes-logo.svg|/k8s-doc/concepts/resource-model.html)' docs/.vitepress/dist/index.html
```

Expected: every deploy-sensitive asset and navigation URL includes `/k8s-doc/`; no favicon points to the domain root.

- [ ] **Step 3: Document the repository setting**

The workflow uses GitHub's Pages deployment API. In the final handoff, state that the repository's **Settings → Pages → Build and deployment → Source** must be set to **GitHub Actions**. Do not change remote repository settings without explicit user authorization.
