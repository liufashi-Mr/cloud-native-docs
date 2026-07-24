# 顶部品牌、导航与外观控件设计

## Goal

让站点顶部栏准确表达“云原生开发手册”的整体范围，并把品牌素材、favicon 和外观控制统一起来。

## Brand

- VitePress `title`、顶部 `siteTitle` 和首页浏览器标题统一为“云原生开发手册”。
- 顶部 logo 使用 `docs/public/logo.png`，源文件保持 1:1 比例并优化为 256 x 256，通过 `withBase`/站点 base 路径正确加载。
- 顶部栏将 logo 渲染为 32 x 32，右侧保留 4px 间距，并使用 `object-fit: contain` 保持图片比例。
- favicon 使用同一份 `logo.png`，不再引用 Kubernetes 专属 SVG。
- 保留 logo 的空替代文本，由旁边的站点名称承担可访问名称；图片加载失败时站点名称仍然可见。

## Navigation

- 移除顶部 `nav` 配置，避免渲染当前无效的 404 导航入口。
- 侧栏和文档内部导航保持不变，不影响 Kubernetes 文档的阅读路径。

## Appearance Controls

- 顶部栏保留主题色按钮，但与明暗模式按钮分开渲染。
- 明暗模式只渲染一个按钮，按照 `auto -> light -> dark -> auto` 循环切换。
- 按钮图标分别使用 `Monitor`、`Sun`、`Moon`，图标代表当前模式；`aria-label` 和 `title` 同时说明当前模式及点击后的下一模式。
- 主题色弹出层保留现有预设色、自定义色和键盘关闭行为；明暗模式按钮不打开主题色弹出层。
- 桌面导航和移动导航都提供两个独立按钮，保持现有响应式插槽位置和焦点样式。

## Testing

- 配置测试锁定品牌标题、logo/favicon 路径和空导航。
- 外观控件测试锁定主题色按钮与模式按钮独立存在，并验证模式循环顺序、三个图标状态和 aria/title 文案。
- 类型检查、全量 Vitest 和生产构建必须通过。

## Scope

- 本次不改 Kubernetes 正文、侧栏结构、主题色算法或本地存储键名。
- Docker/OCI 等后续专题文档另行按规划实现，不与顶部栏改造混在同一功能范围内。
