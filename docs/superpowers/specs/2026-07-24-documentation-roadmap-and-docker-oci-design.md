# 云原生模块路线与 Docker / OCI 设计

## Goal

在现有 Kubernetes 模块基础上，逐个完成首页列出的其余云原生主题。每个主题都建设为独立的多页面模块，但不使用统一章节模板，不限制页面数量或单篇篇幅；模块结构只由讲清该主题所需的知识关系和实践路径决定。

第一个新模块是 Docker / OCI。它需要从应用开发者视角打通源码、构建上下文、镜像、容器、Registry、OCI 规范和 Kubernetes 运行时边界，为后续 Containerd、Registry / Harbor 和供应链安全模块建立共同语境。

## Module Principles

- 每个主题使用独立路由、目录和侧边栏，是完整模块而不是单页占位。
- 不强制复刻 Kubernetes 的目录层级，也不设置页数、字数或固定的四层结构。
- 以准确、完整、易于理解为完成标准；一个概念是否单独成篇由它与其他概念的关系和实践复杂度决定。
- 先说明参与者、资源和数据流，再介绍命令或配置，避免让工具命令代替概念模型。
- 从应用开发者的日常任务出发，覆盖必要的运行示例、常见误区、故障定位和生产边界。
- 深入内容归属到最合适的模块。当前模块说明跨模块接口，但不复制未来模块的完整内容。
- 只有正文、导航、链接和测试全部完成后，首页主题才从“规划中”切换为“已完成”。
- 新模块完成后补充与既有模块的双向链接；不得链接尚未存在的规划页面。

## Roadmap

按以下顺序逐个完成模块：

1. Docker / OCI
2. Linux
3. Containerd
4. Registry / Harbor
5. SBOM 与签名
6. 网络与 DNS
7. 存储
8. 云平台基础
9. Helm
10. Kustomize
11. Gateway API
12. CI/CD
13. GitHub Actions
14. Argo CD / GitOps
15. Identity / RBAC
16. Secret 管理
17. Policy
18. Prometheus
19. Grafana
20. Loki / Logging
21. OpenTelemetry
22. 备份与灾备
23. 成本与弹性

Docker / OCI 按用户要求首先完成。随后用 Linux 补齐容器行为依赖的操作系统基础，再依次展开运行时、制品分发和供应链验证。运行基础完成后进入平台交付、安全、可观测性与韧性主题。

该顺序是编写顺序，不表示阅读时必须线性完成。每个模块应提供自己的起点和与前置模块的链接。

## Docker / OCI Scope

Docker / OCI 模块负责讲清：

- 从源码和构建上下文生成镜像，再由镜像创建容器的完整路径。
- Docker CLI、Docker Engine、BuildKit、containerd、runc 和 Registry 的职责与调用边界。
- 镜像、容器、可写层、挂载和进程之间的关系。
- OCI Image Specification、Image Layout、Distribution Specification 和 Runtime Specification 之间的关系。
- Dockerfile、构建缓存、多阶段构建、多平台镜像和可复现构建的关键实践。
- 容器 PID 1、信号、退出码、健康检查、重启策略和资源约束。
- Docker 网络、名称解析、端口发布、Volume、bind mount 和 tmpfs 的应用开发者模型。
- Compose 在本地多容器开发中的定位和使用边界。
- Docker 镜像进入 Kubernetes 后保留的配置，以及由 PodSpec、CRI 和容器运行时接管的职责。
- Docker 主机、镜像和容器的安全边界，以及构建、拉取、启动、联网和存储问题的分层排查方法。

以下内容只解释接口，不在本模块深入：

- Containerd daemon、shim、snapshotter、namespace 和 CRI 插件内部机制，归入 Containerd 模块。
- Registry 鉴权、复制、保留策略、垃圾回收和 Harbor 运维，归入 Registry / Harbor 模块。
- SBOM 生成体系、provenance、签名、验证和准入策略，归入 SBOM 与签名模块。
- Linux namespace、cgroup、capability、文件系统和网络栈的系统化教学，归入 Linux、网络与 DNS、存储模块。
- Kubernetes 工作负载、Service、Volume 和安全资源的完整模型，继续由 Kubernetes 模块负责。

## Docker / OCI Information Architecture

```text
docker-oci/
├── index.md
├── guide/
│   ├── source-to-container.md
│   └── container-to-kubernetes.md
├── concepts/
│   ├── docker-architecture.md
│   ├── image-model.md
│   └── container-model.md
├── build/
│   ├── dockerfile.md
│   ├── buildkit-cache.md
│   └── multi-platform-builds.md
├── runtime/
│   ├── process-lifecycle.md
│   ├── networking.md
│   ├── storage.md
│   └── compose.md
├── oci/
│   └── specifications.md
├── operations/
│   ├── security.md
│   └── troubleshooting.md
└── reference/
    └── command-map.md
```

页面在实施过程中可以因内容关系而合并或拆分，但不得为了缩短篇幅删除必要解释，也不得为了达到某个页数机械拆分。任何页面结构调整都必须保持下列学习路径完整。

### Start And Guides

- `index.md` 建立源码、BuildKit、镜像、Registry、Docker Engine、containerd、OCI runtime 和容器进程的总关系，提供阅读路径。
- `guide/source-to-container.md` 使用同一个示例应用完成构建、检查、运行、访问、停止和清理，作为模块的可运行入口。
- `guide/container-to-kubernetes.md` 对照 Docker 配置与 PodSpec，说明镜像配置、命令参数、环境变量、端口、健康检查、挂载和资源约束如何交接。

### Concepts

- `concepts/docker-architecture.md` 区分客户端、daemon、BuildKit、containerd、runc 和 Registry，明确调用者与被调用者。
- `concepts/image-model.md` 解释 descriptor、digest、manifest、index、config、layer、media type、tag 和平台选择。
- `concepts/container-model.md` 解释镜像只读层、容器可写层、进程隔离、挂载、网络命名空间和容器生命周期。

### Build

- `build/dockerfile.md` 解释构建上下文、`.dockerignore`、指令语义、shell/exec 形式、多阶段构建、用户与文件权限。
- `build/buildkit-cache.md` 解释缓存键、层复用、cache mount、secret mount、构建参数和缓存失效定位。
- `build/multi-platform-builds.md` 解释 OCI index、目标平台、原生构建、交叉编译、QEMU、builder 驱动和可复现性边界。

### Runtime

- `runtime/process-lifecycle.md` 解释 PID 1、ENTRYPOINT/CMD、信号转发、停止超时、退出码、健康检查、重启和资源限制。
- `runtime/networking.md` 解释 bridge、容器 DNS、端口发布、host/none 网络和容器间访问路径。
- `runtime/storage.md` 对比可写层、named volume、bind mount 和 tmpfs，说明数据生命周期、权限与备份边界。
- `runtime/compose.md` 使用 Compose 组织示例应用的依赖、网络、Volume、健康条件、环境配置和清理流程。

### OCI, Operations And Reference

- `oci/specifications.md` 串联 OCI Image、Image Layout、Distribution 和 Runtime 规范，展示同一内容寻址对象如何被构建、分发和运行。
- `operations/security.md` 覆盖 Docker socket、daemon 权限、rootless、非 root 用户、capability、seccomp、构建 secret、凭据和镜像来源。
- `operations/troubleshooting.md` 按构建、拉取、创建、启动、进程、网络、存储和磁盘占用分层定位问题。
- `reference/command-map.md` 按目标整理检查镜像、容器、网络、Volume、构建缓存和磁盘占用的命令，并链接回概念页面。

## Example Strategy

- 全模块围绕一个不引入第三方应用包的 HTTP 示例应用演进；语言运行时使用明确版本的官方基础镜像，避免每页创建互不相干的示例。
- 示例包含源码、Dockerfile、`.dockerignore` 和 Compose 配置；每一步说明工作目录和需要创建的文件。
- 命令必须可以按页面顺序执行，并包含检查结果、停止或删除资源的清理步骤。
- 镜像标签用于人类操作示例，涉及不可变身份和部署时同时展示 digest。
- 外部镜像使用明确版本或 digest，并解释版本固定与更新责任，不使用含义不明确的 `latest` 作为生产建议。
- 多平台、rootless、BuildKit secret 等需要特定环境的示例必须显式说明 Docker/Buildx/平台前置条件。
- 输出片段只保留判断结果所需字段；与本机、时间或随机 ID 相关的值标为示意，不承诺逐字一致。

## Content Standards

- 术语首次出现时给出中文解释和英文原名，后续用词保持一致。
- 关系图中的边必须描述真实动作，例如客户端请求 daemon、BuildKit 读取构建上下文、runtime 创建容器进程；不得让 manifest、image 或 container 等数据对象执行主动行为。
- 每个复杂页面至少包含一种能验证理解的材料：可运行命令、配置、关系表、故障检查点或对比案例。
- 明确区分“Docker 的默认行为”“OCI 规范要求”“特定实现行为”和“推荐实践”。
- 安全建议说明威胁边界和代价，不把 `USER`、rootless 或签名等单项措施描述为完整防护。
- 排障内容从可观察事实出发，给出检查顺序和分层结论，不堆砌命令列表。
- 内部链接使用根绝对路径，并只链接已经存在的页面。
- 关键技术结论以 Docker 官方文档、OCI 规范和 Kubernetes/CRI 官方文档为事实依据。

## Site Integration

- 在 `docs/.vitepress/config.mts` 中为 `/docker-oci/` 添加独立侧边栏，顺序与模块学习路径一致。
- 在 `docs/.vitepress/theme/home-content.ts` 中把 Docker / OCI 改为 `available`，目标为 `/docker-oci/`。
- 在 Docker / OCI 和 Kubernetes 对应页面之间添加双向链接，重点覆盖镜像、容器运行时、命令参数、健康检查、网络、存储和资源限制。
- 保持 Containerd、Registry / Harbor、SBOM 与签名等未完成首页主题为 `planned`，不得创建空路由。
- VitePress 本地搜索和上一篇/下一篇导航应自动包含新模块页面。

## Testing

- 新增 Docker / OCI 路由清单，验证每个计划页面存在、出现在侧边栏并生成生产 HTML。
- 新增内容契约，按页面验证必要术语、关键角色关系、示例和误区或边界说明。
- 扩展内部链接检查，确保根绝对链接解析到真实 Markdown 页面，拒绝逃逸文档根目录的路径。
- 对 Mermaid fence 使用现有解析和渲染约束，确保图语法有效且关键边存在。
- 解析 Compose YAML 示例，验证 YAML 语法和核心 `services`、`networks`、`volumes` 结构；普通 shell、Dockerfile 和输出块按围栏类型与关键内容检查。
- 验证首页 Docker / OCI 入口为可访问链接，其他规划主题仍不可点击。
- 验证生产构建包含完整 Docker / OCI HTML 清单、正确首页入口和既有 Kubernetes 页面。
- 运行全量 Vitest、`npm run typecheck`、`npm run build` 和 `git diff --check`。

测试套件不要求本机或 CI 必须连接 Docker daemon。需要 daemon、Buildx、多架构模拟器或特定操作系统能力的命令由文档明确标注前置条件，并通过内容契约、配置解析和人工技术审查验证。

## Completion Criteria

Docker / OCI 模块只有同时满足以下条件才算完成：

- 信息架构覆盖本规格定义的学习路径，正文不存在占位符或未解释的关键跳跃。
- 示例应用可以从源码构建为镜像、运行和访问，并能沿后续页面扩展到 Compose 与 Kubernetes 对照。
- Docker、OCI、Containerd、Registry 和 Kubernetes 的职责边界准确且不互相代替。
- 侧边栏、首页入口、内部链接、双向链接、搜索和构建产物完整。
- 所有内容与构建测试通过，类型检查通过，桌面和移动视口没有导航或代码块溢出回归。
- 首页仅在上述检查完成后把 Docker / OCI 标记为已完成。

## Out Of Scope

- 本轮不同时编写 Linux、Containerd、Registry / Harbor、SBOM 与签名或其他后续模块正文。
- 不修改现有主题色、明暗模式、品牌、favicon、侧边栏拖拽和首页视觉层级。
- 不要求为文档测试环境安装或启动 Docker daemon。
- 不把 Docker Desktop 的商业授权、Kubernetes 集群安装或 Harbor 集群运维纳入 Docker / OCI 模块。
