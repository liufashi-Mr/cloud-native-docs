# K8s 概念文档站设计说明

## 1. 项目目标

创建一个面向开发人员的 Kubernetes 概念文档站，帮助读者在约 30 分钟内建立完整心智模型，并能在后续开发、部署和排障时作为速查手册使用。

项目需要同时满足：

- 解释常见 Kubernetes 概念，而不是只罗列 API 字段。
- 清楚展示对象之间的控制、包含、选择、引用和流量关系。
- 提供最小但可复用的 YAML 示例。
- 兼顾首次通读、按主题查阅和故障定位。
- 支持桌面、平板和手机。
- 支持多种预设主题色、自定义取色、浅色、深色和跟随系统模式。

## 2. 目标读者与范围

目标读者是了解容器基础、需要使用 Kubernetes 发布应用的开发人员。

文档覆盖：

- 声明式 API、期望状态、控制循环和资源对象模型。
- 集群、控制平面、Node 和节点代理。
- Pod 及主要工作负载控制器。
- Service、EndpointSlice、Ingress、Gateway API、DNS 和 NetworkPolicy。
- ConfigMap、Secret、Volume、PV、PVC、StorageClass 和 CSI。
- ServiceAccount、RBAC、SecurityContext 和 Pod Security Standards。
- 调度约束、资源请求与限制、健康检查、扩缩容和滚动更新。
- 一次部署的完整链路、常见误区和排障路径。

不覆盖 Kubernetes 安装、云厂商集群创建、Operator 开发、Service Mesh 和深入内核实现。这些内容可在后续版本中作为扩展专题加入。

## 3. 技术架构

项目采用 VitePress，内容使用 Markdown，关系图使用 Mermaid，局部交互使用 Vue 组件。

主要组成：

- `docs/`：文档内容和导航入口。
- `docs/.vitepress/config.mts`：站点信息、侧边栏、页内目录、本地搜索和 Mermaid 配置。
- `docs/.vitepress/theme/`：扩展 VitePress 默认主题。
- `docs/.vitepress/theme/components/AppearanceControl.vue`：外观设置弹层。
- `docs/.vitepress/theme/appearance.ts`：主题色派生、持久化和系统模式监听。
- `docs/.vitepress/theme/styles.css`：全宽布局、响应式规则和设计令牌。
- `tests/`：外观状态和文档结构的自动化测试。

使用 VitePress 默认主题作为可访问性和导航基础，在其 Layout 插槽中加入外观控制。内置本地搜索负责全文检索，移动端菜单沿用默认主题的抽屉行为并补充样式。

## 4. 内容架构

文档采用“总览 + 部署链路 + 分类详解 + 速查”的混合结构。

### 4.1 开始

1. `概念总览`：一句话解释 Kubernetes、四条主关系、核心对象关系图。
2. `一次部署的完整链路`：从 YAML 到容器运行，再到外部请求进入应用。

### 4.2 核心概念

1. `资源对象与元数据`：apiVersion、kind、metadata、spec、status、Namespace、Label、Selector、Annotation、OwnerReference 和 Finalizer。
2. `集群与节点`：Cluster、Control Plane、API Server、etcd、Controller Manager、Scheduler、Node、kubelet、kube-proxy、容器运行时、CNI 和 CSI。
3. `工作负载`：Pod、ReplicaSet、Deployment、StatefulSet、DaemonSet、Job 和 CronJob。
4. `网络与流量`：Pod 网络、Service、EndpointSlice、CoreDNS、Ingress、Gateway API 和 NetworkPolicy。
5. `配置与存储`：ConfigMap、Secret、Volume、PV、PVC、StorageClass 和 CSI。
6. `身份与安全`：ServiceAccount、Role、ClusterRole、RoleBinding、ClusterRoleBinding、SecurityContext 和 Pod Security Standards。
7. `调度与资源`：requests、limits、QoS、NodeSelector、Affinity、Taint、Toleration、PriorityClass 和 PDB。

### 4.3 运行实践

1. `健康检查与生命周期`：startup、readiness、liveness、生命周期钩子和终止流程。
2. `发布与扩缩容`：滚动更新、回滚、HPA、VPA 和 Cluster Autoscaler 的关系。
3. `排障速查`：沿“对象已创建 → Pod 已调度 → 容器已运行 → Pod 已就绪 → Service 有端点 → 流量可达”的顺序定位问题。
4. `概念关系速查表`：对象、作用域、创建者、选择或引用对象、生命周期和常用命令。

## 5. 概念关系表达

每个主题统一使用四种表达方式：

1. 一句话定义。
2. “它解决什么问题”。
3. 与相邻对象的关系图或表格。
4. 一个最小 YAML 或命令示例。

关系图至少覆盖：

- `Deployment → ReplicaSet → Pod → Container`。
- `Ingress / Gateway → Service → EndpointSlice → Pod`。
- `ConfigMap / Secret / PVC → Pod`。
- `kubectl / Client → API Server → etcd`，以及 Controller、Scheduler、kubelet 的协调链路。
- `PVC → StorageClass → PV → CSI / 存储系统`。
- `Subject → RoleBinding → Role → API Resource`。
- `HPA → Deployment / StatefulSet → Pod` 和指标来源。

箭头旁必须写明关系动词，例如“管理”“创建”“选择”“引用”“挂载”“授权”或“路由到”，避免只有节点和连线却缺少语义。

## 6. 页面与视觉设计

整体风格为克制的工程手册：中性背景、清晰的排版层级、少量强调色和高对比代码区。

页面不设置固定最大宽度：

- 桌面端使用 `clamp()` 控制左侧导航和右侧目录宽度，正文占据剩余空间。
- 正文水平内边距随视口变化，不按视口缩放字号。
- 宽屏可将说明和 YAML 示例并排；中小屏改为上下排列。
- Mermaid 图在宽屏横向展开，在窄屏采用纵向布局或允许局部横向滚动。

设计令牌由 CSS 变量提供，包括页面背景、表面层、正文、弱化文本、边框、强调色、强调色弱背景、代码背景和代码文字。

## 7. 外观系统

顶栏只显示一个紧凑的“外观”入口，避免多个颜色和模式按钮挤占导航。点击后打开弹层。

弹层包含：

- 10 个预设主题色：松绿、青碧、海蓝、靛蓝、紫藤、莓红、砖红、赭橙、芥黄和石墨。
- 原生颜色取色器，用于自定义主题色。
- 三态明暗模式：跟随系统、浅色、深色。

行为规则：

- 默认明暗模式为跟随系统，并监听 `prefers-color-scheme` 变化。
- 用户选择保存到 `localStorage`，刷新页面后恢复。
- 自定义颜色转换为 HSL，并分别限制浅色和深色模式下的亮度范围，保证强调文字和选中状态具有可读对比度。
- 主题色只影响强调文字、边框、选中态、链接和提示块，不改变正文颜色。
- 页面加载时通过内联初始化脚本尽早应用持久化设置，减少主题闪烁。

## 8. 响应式与交互

断点行为：

- `>= 1100px`：左侧章节导航、流式正文和右侧页内目录同时显示。
- `768px - 1099px`：隐藏右侧页内目录，左侧导航可收起或通过菜单打开。
- `< 768px`：左侧导航改为抽屉；顶栏保留菜单、站点名、搜索和外观入口。

手机抽屉需要支持：

- 点击菜单按钮打开。
- 点击遮罩或按 Esc 关闭。
- 打开时禁止背景滚动。
- 焦点限制在抽屉内，关闭后返回菜单按钮。
- 当前章节保持明显选中状态。

表格和代码块在小屏允许局部横向滚动，长资源名可换行，不允许页面整体产生横向滚动。

## 9. 可访问性

- 正文、弱化文字、链接和选中态在浅色与深色模式下均满足可读对比度。
- 图标按钮提供 `aria-label` 和工具提示。
- 色板按钮使用 `aria-pressed` 表示选中状态，不能只依靠颜色传达状态。
- 外观弹层和移动端抽屉支持键盘操作与 Esc 关闭。
- Mermaid 图旁保留文字或表格解释，避免图形成为唯一信息来源。
- 尊重 `prefers-reduced-motion`，关闭非必要过渡。

## 10. 异常与降级

- `localStorage` 不可用时保留当前会话设置，不影响阅读。
- `matchMedia` 不可用时默认浅色模式。
- Mermaid 渲染失败时保留代码块或替代文字。
- JavaScript 禁用时核心 Markdown 内容、导航链接和代码示例仍可阅读。
- 自定义颜色解析失败时恢复默认松绿色。

## 11. 验证策略

自动化验证：

- 主题色转换、明暗模式解析和持久化逻辑的单元测试。
- 导航配置中的每个页面都存在，内部链接无断链。
- `npm run build` 生成静态站点且无错误。
- 页面不出现未解析的 Mermaid 代码或 Vue 组件警告。

浏览器验证：

- 桌面宽屏、平板和手机视口截图检查。
- 验证外观弹层打开与关闭、预设色、自定义色、三态明暗模式和刷新恢复。
- 验证手机菜单、遮罩、Esc、背景滚动锁定和焦点返回。
- 检查正文、代码块、表格和关系图在各视口没有重叠或页面级横向溢出。

## 12. 完成标准

- 上述章节全部具备可阅读的中文内容、关系说明和示例。
- 核心关系图和概念速查表完整。
- 本地搜索、侧边栏、页内目录和上一页/下一页导航可用。
- 外观系统和响应式导航满足已确认交互。
- 自动化测试和生产构建通过。
- 本地开发服务器启动，桌面与手机视觉验证通过。
