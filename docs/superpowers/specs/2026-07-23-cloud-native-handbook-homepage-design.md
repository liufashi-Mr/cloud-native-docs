# 云原生开发手册首页设计

## 目标

将当前单一的 Kubernetes 文档站升级为“云原生开发手册”的入口页。站点面向应用开发者，首页同时表达两层内容结构：

- 跨技术开发路径：围绕构建、发布、联网、运行、观察和安全等真实任务串联多个技术。
- 单技术专题：分别讲清 Linux、容器、Kubernetes、Helm、GitOps、可观测性等技术。

首期只完成首页和 Kubernetes 入口，用于验证整体方向。除 Kubernetes 外的路径和专题只展示规划状态，不实现内容和跳转。

## 已确认决策

- 站点名称为“云原生开发手册”。
- 目标读者是应用开发者，不以集群管理员或平台工程师为第一受众。
- 内容采用“先广后深”：先展示完整技术版图，再逐步补充专题。
- 专题采用任务导向模板：解决的问题、核心关系、使用边界、最小示例、常见故障和上下游链接。
- 首页采用“技术工作台”视觉方向：紧凑、清晰、可扫描，使用克制的多色标识提升层次。
- 首页采用“跨技术路径 + 单技术专题”的双层结构。
- Kubernetes 全部内容在首期迁入 `/kubernetes/` 目录；项目没有历史兼容负担，不保留旧地址或跳转页。

## 首期范围

### 包含

1. 新的站点名称、描述和全局导航。
2. 新首页，展示跨技术路径和完整技术领域。
3. Kubernetes 专题作为唯一可点击的专题。
4. 将当前 Kubernetes 概念总览、指南、概念、运行实践和速查页面全部迁到 `/kubernetes/**`。
5. 更新现有 Kubernetes 侧栏、正文链接和构建配置，使其只引用新路径。
6. 保留主题色、深浅模式、响应式导航、搜索、Mermaid 和全屏图表能力。
7. 桌面、平板和手机布局。

### 不包含

- 编写 Kubernetes 以外的技术正文。
- 让未完成专题或开发路径产生跳转。
- 为旧 `/concepts/`、`/operations/`、`/reference/` 和 `/guide/` 路径提供兼容页或跳转。
- 登录、进度记录、收藏、评论或后端服务。
- 重新设计现有 Kubernetes 正文页面和图表交互。

## 信息架构

### 跨技术开发路径

首页展示五条规划路径：

1. 构建与发布应用：Git、CI、OCI、Registry、Kubernetes、Helm、GitOps。
2. 让请求到达应用：DNS、TLS、Gateway、Service、Pod。
3. 配置与持久化：Config、Secret、Volume、CSI、Backup。
4. 观察与定位故障：Metrics、Logs、Traces、Alert、Linux。
5. 建立安全基线：Identity、RBAC、Policy、供应链安全。

首期路径为非交互展示项，明确标记“规划中”。它们用于表达站点未来如何串联技术，不伪装成可点击链接。

### 单技术专题

首页展示六个领域及 24 个技术入口：

| 领域 | 专题 |
| --- | --- |
| 运行基础 | Linux、网络与 DNS、存储、云平台基础 |
| 容器与制品 | Docker / OCI、Containerd、Registry / Harbor、SBOM 与签名 |
| 平台与编排 | Kubernetes、Helm、Kustomize、Gateway API |
| 持续交付 | CI/CD、GitHub Actions、Argo CD / GitOps |
| 可观测性 | Prometheus、Grafana、Loki / Logging、OpenTelemetry |
| 安全与韧性 | Identity / RBAC、Policy、Secret 管理、备份与灾备、成本与弹性 |

首期只有 Kubernetes 具备链接和“已完成”状态。其余专题使用静态、非交互条目展示“规划中”，不使用空 `href`、`javascript:` 链接或点击后无反馈的按钮。

## 页面结构

首页使用 VitePress 的 `page` 布局和独立 Vue 组件，不使用默认营销式 Hero。首屏直接提供可用入口，并露出下一段技术目录。

从上到下依次为：

1. 紧凑站点栏：云原生开发手册、技术目录、学习路径、搜索和外观设置。
2. 工作台标题：说明站点服务于应用的构建、发布、观察和排障。
3. 本地搜索入口：复用 VitePress 搜索能力，不新增搜索实现。
4. 跨技术路径：五个稳定尺寸的路径单元，展示关键技术链路和“规划中”状态。
5. 技术领域目录：六个全宽分组，每组包含技术入口；避免把页面分区本身做成浮动卡片。
6. 推荐起点：Kubernetes 作为当前已完成专题，引导用户进入现有手册。

路径和专题是重复数据项，可以使用边框轻、圆角不超过 6px 的紧凑卡片。页面分区保持无外层卡片的全宽布局，不出现卡片套卡片。

## 视觉设计

- 延续现有白色/近黑页面基础、可配置主题色和清晰边框。
- 使用多种克制的领域色区分基础、容器、平台、交付、可观测性和安全，避免页面被单一色系统治。
- 领域色只用于图标底色、顶部状态线和小面积强调，不作为大面积背景。
- 使用现有 Lucide 图标表达任务和领域；Kubernetes 使用现有本地官方 Logo。
- 标题保持文档工具尺度，不使用超大营销标题。
- 字间距保持 `0`，不使用随视口变化的字体尺寸。
- 首页内容宽度自适应屏幕，不设置固定页面宽度。
- 所有路径单元和专题条目具有稳定的网格尺寸，状态文字不得导致布局跳动。

## 路由和导航

- `/`：新的云原生开发手册首页。
- `/kubernetes/`：当前 Kubernetes 概念总览。
- `/kubernetes/concepts/*`：Kubernetes 核心概念。
- `/kubernetes/operations/*`：Kubernetes 运行实践。
- `/kubernetes/reference/*`：Kubernetes 速查内容。
- `/kubernetes/guide/*`：Kubernetes 开发者指南。

全局导航调整为：

- 首页：`/`
- 技术专题：`/#technologies`
- 学习路径：`/#paths`
- Kubernetes：`/kubernetes/`

Kubernetes 页面继续使用现有侧栏，所有侧栏链接统一增加 `/kubernetes/` 前缀。旧根路径和旧章节路径不再生成，因为项目当前没有需要兼容的外部链接或收藏。

## 组件边界

### `CloudNativeHome.vue`

负责首页语义结构和展示，不持有外部状态。数据通过同文件中的只读常量或独立小型数据模块定义，包括：

- 开发路径列表。
- 技术领域和专题列表。
- 专题状态与可选链接。

组件只对存在有效链接的专题渲染 `<a>`；规划项渲染普通语义容器。

### VitePress 配置

负责站点名称、描述、导航、侧栏和 `/kubernetes/` 路由入口。现有外观、Mermaid 和搜索配置保持不变。

### Kubernetes 内容

当前 `docs/index.md` 的 Kubernetes 正文迁到 `docs/kubernetes/index.md`，并按原有层级迁移以下目录：

- `docs/concepts/` → `docs/kubernetes/concepts/`
- `docs/operations/` → `docs/kubernetes/operations/`
- `docs/reference/` → `docs/kubernetes/reference/`
- `docs/guide/` → `docs/kubernetes/guide/`

所有内部链接改为 `/kubernetes/**` 绝对路径。旧文件不保留，构建产物不生成旧路由。

## 响应式行为

- 宽屏：开发路径五列，技术领域两至三列，页面利用可用宽度。
- 中屏：开发路径两至三列，技术领域两列。
- 手机：所有入口单列；顶部使用现有移动导航；状态和标题允许换行。
- 页面本身不能产生横向滚动；只有现有图表、代码和表格内部允许滚动。
- 首屏至少露出第一组内容，避免首页标题占满整个视口。

## 可访问性

- 页面保留一个明确的 `h1`，章节按 `h2`、`h3` 顺序组织。
- 可点击 Kubernetes 专题具备清晰焦点样式和可理解的链接文本。
- 规划项不设置 `tabindex`，避免键盘用户进入不可操作元素。
- 颜色不是唯一状态表达；同时显示“已完成”或“规划中”文字。
- 浅色和深色模式下正文、状态和边框满足可读对比度。
- 图标均为装饰时设置 `aria-hidden`；Kubernetes Logo 提供合适替代文本或由链接文本提供名称。

## 异常与降级

- 若 Kubernetes Logo 加载失败，专题名称和状态仍能完整表达入口。
- 若 JavaScript 尚未加载，首页静态结构和 Kubernetes 链接仍可使用。
- 未完成专题不会触发导航、Toast 或占位错误页。
- 搜索继续依赖 VitePress 本地索引；首页自定义展示不改变搜索失败行为。

## 验证策略

### 自动化测试

- 首页数据包含 5 条路径、6 个领域和 24 个专题。
- Kubernetes 是唯一带链接且状态为已完成的专题。
- 规划专题不会渲染为空链接或按钮。
- `/kubernetes/` 及其 `concepts`、`operations`、`reference`、`guide` 子路径包含全部迁移后的 Kubernetes 内容。
- 所有侧栏、正文交叉链接和上一页/下一页导航只引用 `/kubernetes/**` 新路径。
- 构建产物不包含旧 `/concepts/`、`/operations/`、`/reference/` 和 `/guide/` 页面。
- 配置中的站点标题、导航和侧栏链接正确。
- 现有外观、Mermaid、搜索和 GitHub Pages 测试继续通过。
- 类型检查和默认、GitHub Pages 子路径构建通过。

### 浏览器验证

- 桌面和手机端检查首页信息层级、换行和无页面横向溢出。
- 浅色、深色和跟随系统模式下检查六个领域色和文字对比度。
- 点击 Kubernetes 专题能进入 `/kubernetes/`，现有章节、侧栏和图表可继续使用。
- 非 Kubernetes 专题不能点击，也不会获得键盘焦点。
- 浏览器控制台无错误。

## 完成标准

- 根首页成为可用的云原生技术工作台。
- 首页清楚表达跨技术路径与单技术专题的区别。
- Kubernetes 是唯一真实入口，其他内容明确处于规划状态。
- 现有 Kubernetes 内容和交互能力没有回归。
- 桌面和手机端均保持当前站点的响应式、主题和可访问性质量。
