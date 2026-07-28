# 顶部品牌、导航与外观控件 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将站点顶部品牌统一为“云原生开发手册”，移除无效导航，并把主题色与明暗模式改成两个独立按钮。

**Architecture:** 品牌、favicon 和导航继续由 VitePress 配置负责；外观状态仍由 `appearance-state.ts` 单例管理。`AppearanceControl.vue` 保留主题色弹层，但把明暗模式移到独立循环按钮，避免改变现有存储键和主题应用算法。

**Tech Stack:** VitePress 1.6、Vue 3、Lucide Vue、Vitest、Vue Test Utils、TypeScript

---

## File Map

- Modify `docs/.vitepress/config.mts`: 站点标题、logo、favicon 和顶部导航。
- Modify `docs/.vitepress/theme/components/AppearanceControl.vue`: 主题色弹层和独立模式循环按钮。
- Modify `docs/.vitepress/theme/styles.css`: 两个按钮及精简后弹层的布局。
- Modify `tests/appearance-integration.test.ts`: 品牌配置、favicon、空导航和布局集成契约。
- Modify `tests/github-pages.test.ts`: base 路径下的 favicon 契约。
- Modify `tests/appearance-control.test.ts`: 模式循环、图标、无障碍文案和双实例同步。
- Modify `tests/build-output.test.ts`: 生产构建中的品牌文案与 `logo.png`。
- Add `docs/public/logo.png`: 用户提供的统一品牌图片。

### Task 1: Brand configuration and navigation

**Files:**
- Modify: `tests/appearance-integration.test.ts`
- Modify: `tests/github-pages.test.ts`
- Modify: `tests/build-output.test.ts`
- Modify: `docs/.vitepress/config.mts`
- Add: `docs/public/logo.png`

- [ ] **Step 1: Write failing brand configuration tests**

Update the integration expectations to require:

```ts
expect(config).toContain("title: '云原生开发手册'")
expect(config).toContain("siteTitle: '云原生开发手册'")
expect(config).toContain("logo: '/logo.png'")
expect(config).not.toMatch(/\bnav:\s*\[/)
expect(config).toMatch(
  /rel:\s*'icon'[\s\S]*type:\s*'image\/png'[\s\S]*href:\s*`\$\{siteData\.base\}logo\.png`/,
)
```

Update the Pages test to require `` `${siteData.base}logo.png` `` and the build test to require `dist/logo.png` plus the new site title.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
npx vitest run tests/appearance-integration.test.ts tests/github-pages.test.ts tests/build-output.test.ts
```

Expected: failures reference the existing Kubernetes title/logo, SVG favicon, and populated `nav` array.

- [ ] **Step 3: Implement the brand configuration**

Change `docs/.vitepress/config.mts` to:

```ts
title: '云原生开发手册',
description: '面向应用开发者的云原生技术工作台。',
```

Use the PNG for both brand surfaces:

```ts
transformHead({ siteData }) {
  return [[
    'link',
    { rel: 'icon', type: 'image/png', href: `${siteData.base}logo.png` },
  ]]
},

themeConfig: {
  logo: '/logo.png',
  siteTitle: '云原生开发手册',
  // no nav property
}
```

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```bash
npx vitest run tests/appearance-integration.test.ts tests/github-pages.test.ts tests/build-output.test.ts
```

Expected: all selected tests pass and the production build fixture contains `logo.png`.

- [ ] **Step 5: Commit the brand configuration**

```bash
git add docs/.vitepress/config.mts docs/public/logo.png tests/appearance-integration.test.ts tests/github-pages.test.ts tests/build-output.test.ts
git commit -m "feat: update cloud native handbook branding"
```

### Task 2: Split color and mode controls

**Files:**
- Modify: `tests/appearance-control.test.ts`
- Modify: `docs/.vitepress/theme/components/AppearanceControl.vue`
- Modify: `docs/.vitepress/theme/styles.css`

- [ ] **Step 1: Write failing mode-cycle tests**

Replace tests for the three popover mode buttons with one standalone trigger:

```ts
const modeTrigger = wrapper.get('button[data-mode-trigger]')
expect(modeTrigger.attributes('data-mode')).toBe('auto')
expect(modeTrigger.attributes('aria-label')).toContain('当前自适应')
expect(modeTrigger.get('svg').attributes('aria-hidden')).toBe('true')

await modeTrigger.trigger('click')
expect(modeTrigger.attributes('data-mode')).toBe('light')
await modeTrigger.trigger('click')
expect(modeTrigger.attributes('data-mode')).toBe('dark')
await modeTrigger.trigger('click')
expect(modeTrigger.attributes('data-mode')).toBe('auto')
```

Assert the color dialog contains no `[data-mode]` controls, retains all color swatches, and desktop/mobile instances synchronize through the same shared state.

- [ ] **Step 2: Run the focused control test and verify RED**

Run:

```bash
npx vitest run tests/appearance-control.test.ts
```

Expected: the standalone `[data-mode-trigger]` button is missing and old mode controls still exist in the dialog.

- [ ] **Step 3: Implement the cycle model and icon metadata**

In `AppearanceControl.vue`, define:

```ts
const modeSequence: readonly AppearanceMode[] = ['auto', 'light', 'dark']
const modeOptions = {
  auto: { current: '自适应', next: '浅色', icon: Monitor },
  light: { current: '浅色', next: '深色', icon: Sun },
  dark: { current: '深色', next: '自适应', icon: Moon },
} satisfies Record<AppearanceMode, { current: string; next: string; icon: Component }>

const currentModeOption = computed(() => modeOptions[mode.value])
const modeButtonLabel = computed(
  () => `明暗模式：当前${currentModeOption.value.current}，点击切换为${currentModeOption.value.next}`,
)

function cycleMode(): void {
  const index = modeSequence.indexOf(mode.value)
  selectAppearanceMode(modeSequence[(index + 1) % modeSequence.length])
}
```

Render the palette trigger and a sibling mode trigger inside `.cloud-native-appearance`. Remove the “明暗模式” label and three mode buttons from the color dialog.

- [ ] **Step 4: Update styles for two independent buttons**

Make the wrapper an inline flex group and share icon-button styling:

```css
.cloud-native-appearance {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.cloud-native-appearance__trigger,
.cloud-native-appearance__mode-trigger {
  display: inline-flex;
  width: 36px;
  height: 32px;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
}
```

Delete the unused `.cloud-native-appearance__modes` rules while preserving the popover, swatches, custom input and mobile slot rules.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:

```bash
npx vitest run tests/appearance-control.test.ts tests/appearance-integration.test.ts
```

Expected: all selected tests pass, including cycle order, icon state, persistence, auto-mode system tracking and desktop/mobile synchronization.

- [ ] **Step 6: Commit the appearance control**

```bash
git add docs/.vitepress/theme/components/AppearanceControl.vue docs/.vitepress/theme/styles.css tests/appearance-control.test.ts tests/appearance-integration.test.ts
git commit -m "feat: split theme color and mode controls"
```

### Task 3: Full verification

**Files:**
- Verify all modified files from Tasks 1-2.

- [ ] **Step 1: Run the complete test suite**

```bash
npm test
```

Expected: all Vitest files and assertions pass.

- [ ] **Step 2: Run type checking**

```bash
npm run typecheck
```

Expected: `vue-tsc --noEmit` exits with status 0.

- [ ] **Step 3: Run the production build**

```bash
npm run build
```

Expected: VitePress completes client/server bundling and page rendering; `docs/.vitepress/dist/logo.png` exists.

- [ ] **Step 4: Inspect the final diff**

```bash
git diff --check
git status --short
```

Expected: no whitespace errors and only scoped project changes remain.
