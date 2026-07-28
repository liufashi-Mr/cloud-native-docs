# Cloud Native 项目命名迁移设计

## Goal

项目已经从单一 Kubernetes 手册扩展为覆盖 Docker / OCI、Kubernetes 及后续云原生主题的开发手册。本次迁移把仍代表旧项目身份的 `k8s`、`k8s-doc` 和 `k8s-concepts-handbook` 统一调整为 `cloud-native`，使仓库、发布地址、包信息、运行时命名和维护文档与当前产品范围一致。

本次迁移只修改项目身份命名，不把 Kubernetes 技术主题改名。Kubernetes 模块、路由、API、资源名称、示例和技术正文继续使用 Kubernetes 的正式名称。

## Naming Boundary

下列名称属于项目身份，统一使用 `cloud-native`：

- 本地仓库目录：`k8s` 改为 `cloud-native`。
- GitHub 仓库：`liufashi-Mr/k8s-doc` 改为 `liufashi-Mr/cloud-native-docs`。
- GitHub Pages 项目路径：`/k8s-doc/` 改为 `/cloud-native/`。
- npm 包名：`k8s-concepts-handbook` 改为 `cloud-native`。
- 自定义 CSS 变量：`--k8s-*` 改为 `--cloud-native-*`。
- 自定义 CSS 类、Vue transition 名称和根元素状态类：`k8s-*` 改为 `cloud-native-*`。
- 浏览器持久化键：当前键统一为 `cloud-native-*`。
- 测试、注释、历史 specs/plans 中代表项目身份的旧名称。

下列名称属于技术领域，保持不变：

- `Kubernetes`、`kubernetes` 和必要的通用缩写 `k8s`，当它们明确指向 Kubernetes 技术本身时。
- `/kubernetes/` 及其子路由、`docs/kubernetes/`、Kubernetes 侧边栏和路由清单。
- Kubernetes API kind、YAML 示例、命令、外部链接、模块标题和正文术语。
- `k8s.io` 等 Kubernetes 生态中的真实域名、镜像名、包名、label 或 annotation key。

迁移采用语义判断，不执行不加区分的全仓库字符串替换。

## Runtime Identifiers

所有当前运行时标识使用 `cloud-native` 前缀，包括：

- 主题与布局 token，例如 `--cloud-native-accent`、`--cloud-native-sidebar-width`。
- 外观控件、返回顶部和侧边栏拖拽等组件类名。
- 侧边栏拖拽期间写入根元素的状态类。
- VitePress 首屏内联脚本和客户端 hydration 后的同一组变量。

首屏脚本与 Vue 客户端必须共享相同的新键和新变量，避免 hydration 前后出现主题闪烁或宽度跳变。只修改命名，不改变现有颜色算法、模式切换、侧边栏尺寸范围、交互语义和视觉表现。

## Browser State Migration

当前持久化键调整为：

| 设置 | 新键 | 旧键 |
| --- | --- | --- |
| 主题色 | `cloud-native-theme-color` | `k8s-theme-color` |
| 明暗模式 | `cloud-native-theme-mode` | `k8s-theme-mode` |
| 侧边栏宽度 | `cloud-native-sidebar-width` | `k8s-sidebar-width` |

迁移规则如下：

1. 优先读取并验证新键。
2. 新键缺失或无效时，读取并验证对应旧键。
3. 旧值有效时，把规范化后的值写入新键；新键写入成功后删除旧键。
4. 新旧值都无效时使用现有默认值，不迁移无效数据。
5. `localStorage` 不可用、读取失败或写入失败时保持当前容错行为，页面仍使用默认设置。

旧 `k8s-*` 字符串只允许作为迁移常量存在，不再作为当前存储键写入。迁移逻辑同时覆盖首屏内联脚本和客户端组件初始化，确保首次加载和后续交互一致。

## Repository And Deployment Migration

GitHub 仓库重命名为 `cloud-native-docs`，本地 `origin` 更新为 `git@github.com:liufashi-Mr/cloud-native-docs.git`。GitHub 通常会为旧仓库 URL 提供跳转，但代码和文档不依赖该兼容行为。

项目 Pages 基路径同步改为 `/cloud-native/`。部署测试、构建命令和历史维护文档中的项目站点示例全部更新；根路径构建仍用于本地和域名根路径场景。

仓库内改动完成并提交后，再把工作区目录从 `/Users/liufashi/workspace/personal/k8s` 改为 `/Users/liufashi/workspace/personal/cloud-native`。目录改名不属于 Git 内容，因此放在最后执行，并在新路径重新启动开发服务器。

## Historical Documents

历史 specs/plans 也纳入命名清理，但保留其技术语义：

- 文件名或标题把旧项目称为 `k8s` 时，改成能表达当前 `cloud-native` 项目身份的名称。
- 包名、CSS 命名、存储键、仓库名和 Pages 基路径示例更新为新的当前名称。
- 当历史文档描述当时只建设 Kubernetes 模块的范围时，继续保留 `Kubernetes`；不把事实改写成当时已经建设完整云原生手册。
- 旧存储键仅在本次迁移设计、实施计划和兼容代码中保留，用来解释或执行迁移。

## Testing

测试按行为和命名两层覆盖：

- 先更新或新增失败测试，约束 npm 包名、Pages 基路径、CSS 变量、组件类名和当前存储键。
- 为三个浏览器设置分别验证新键优先、有效旧值迁移、无效旧值忽略以及存储异常降级。
- 保持主题色、明暗模式、首屏无闪烁、侧边栏拖拽、返回顶部和移动导航的既有行为测试。
- 增加项目身份扫描，禁止旧包名、旧 Pages 路径和当前运行时 `k8s-*` 命名回归；迁移常量和合法 Kubernetes 技术内容进入明确允许范围。
- 运行全量 Vitest、TypeScript 类型检查、根路径生产构建、`/cloud-native/` 基路径生产构建和 `git diff --check`。
- 在桌面与移动视口验证首页、Kubernetes 页面和 Docker / OCI 页面，确认资源、favicon、导航、主题和侧边栏行为没有回归。

## Migration Order

1. 用测试定义新的包名、运行时命名、存储迁移和 Pages 基路径。
2. 更新浏览器存储与首屏初始化逻辑。
3. 更新 CSS 变量、类名、Vue 模板和组件状态类。
4. 更新包元数据、部署基路径、测试与维护文档。
5. 语义审查剩余 `k8s` 命中，只保留 Kubernetes 技术内容和兼容迁移常量。
6. 完成自动化测试、构建与浏览器视觉回归检查。
7. 提交仓库内改动，重命名 GitHub 仓库并确认 Pages 配置。
8. 重命名本地工作区目录，在新路径重新启动并复查站点。

## Error Handling And Rollback

- 浏览器状态迁移失败时使用默认设置，不阻塞渲染。
- GitHub 仓库重命名前必须确认自动化测试和 `/cloud-native/` 基路径构建通过。
- 远端重命名后立即核对 `origin`、默认分支和 Pages 工作流；若 Pages 尚未就绪，保留本地构建结果，不修改 Kubernetes 或 Docker / OCI 路由来规避部署问题。
- 本地目录只在所有仓库内操作结束后改名，避免运行中的命令、编辑器和开发服务器在中途失去工作目录。

## Completion Criteria

- 项目身份在本地目录、GitHub 仓库、npm 包、Pages 路径、运行时命名、测试和维护文档中统一为 `cloud-native`。
- 合法 Kubernetes 技术命名、内容和路由保持完整。
- 已有用户的有效主题色、明暗模式和侧边栏宽度自动迁移到新键。
- 根路径和 `/cloud-native/` 基路径均能成功构建，自动化测试和类型检查通过。
- 桌面与移动页面没有视觉或交互回归，favicon 和静态资源在新 Pages 路径下可加载。
- 远端仓库、本地 `origin` 和本地工作区目录都使用新名称。

## Out Of Scope

- 不重写 Kubernetes、Docker / OCI 或后续模块的正文内容。
- 不调整现有视觉设计、主题算法、logo、favicon 图像或页面信息架构。
- 不改变 `/kubernetes/`、`/docker-oci/` 等专题路由。
- 不为旧 `/k8s-doc/` Pages 路径在站点内部增加重复页面或客户端跳转；仓库重命名后的外部跳转行为由 GitHub 管理。
