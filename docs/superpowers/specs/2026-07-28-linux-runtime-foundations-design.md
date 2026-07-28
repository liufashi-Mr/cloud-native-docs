# Linux 云原生应用运行基础设计

## Goal

建设一个面向应用开发者的 Linux 多页面模块，以 Ubuntu 24.04 LTS 为可验证实验基线，讲清应用从 Shell 启动到由 systemd 管理、被 kernel 调度、通过文件与 socket 访问资源、由 namespace 改变可见视图、由 cgroup v2 统计和约束资源的完整路径。

本模块继续使用 Docker / OCI 模块中的 `demo-api`，但直接在 Linux 主机运行它。读者应能把同一个应用在主机、Docker 和 Kubernetes 中的进程、身份、文件、信号、日志、网络端点和资源配置对应起来，为后续 Containerd、网络与 DNS、存储及云平台基础模块建立共同的操作系统语境。

## Audience And Baseline

- 读者是需要构建、部署或排查云原生应用的开发者，不假定其具备系统管理员经验。
- 实验基线是 Ubuntu 24.04 LTS 虚拟机或独立测试主机，使用 systemd、unified cgroup v2 hierarchy 和 Ubuntu 默认工具链。
- 文档明确区分 POSIX 或 Shell 语义、Linux kernel 接口、systemd 行为、Ubuntu 默认配置和推荐实践。
- Docker Desktop、WSL、容器内 Shell、远程主机及其他发行版可能缺少完整 systemd、可写 cgroup、主机 kernel 日志或相同软件包；涉及这些差异的步骤必须明确说明。
- 读者无需预先掌握 Shell 脚本。本模块包含一篇支撑后续实验的 Shell 实用基础，但不扩展为完整 Linux 入门课程。

## Scope

Linux 模块负责讲清：

- 路径、引用、变量、管道、重定向、退出状态和 Shell 脚本安全边界。
- 进程、线程、PID、父子关系、进程状态、环境变量、文件描述符和 `/proc` 证据。
- Linux 用户、组、数值 UID/GID、文件权限、umask、ownership、capability 和服务账户。
- 路径解析、inode、文件系统、mount、空间与 inode 耗尽，以及应用可见的 mount view。
- 信号、退出状态、前后台进程、graceful shutdown 和强制终止的边界。
- systemd unit、service lifecycle、dependency、restart、environment、credential 与 sandboxing 的应用开发者模型。
- stdout/stderr、journald、kernel log、结构化元数据、日志保留与证据关联。
- Linux namespaces 改变哪些资源视图，以及它们与虚拟机、安全边界和容器的关系。
- cgroup v2 的 hierarchy、controller、统计、限制、pressure 和 systemd delegation 边界。
- 监听 socket、连接、主机路由和 resolver 的必要观察接口。
- CPU、memory、I/O、进程数、磁盘空间与 inode pressure 的识别和分层排查。
- 主机应用安全边界及从症状到证据的系统化 Linux 排障流程。

以下内容只解释接口，不在本模块深入：

- iptables/nftables 规则设计、网络 namespace 拓扑、CNI、Service 转发和 DNS 架构，归入网络与 DNS 模块。
- 块设备、分区、LVM、RAID、CSI 和分布式存储归入存储模块；生产备份设计归入备份与灾备模块。
- containerd daemon、shim、snapshotter、namespace 和 CRI 插件内部机制，归入 Containerd 模块。
- Kubernetes API 对象和控制器的完整模型继续由 Kubernetes 模块负责。
- Linux 安装、桌面环境、编辑器、发行版选型、内核编译和完整系统管理员课程不在范围内。

## Information Architecture

```text
linux/
├── index.md
├── guide/
│   ├── shell-practical-basics.md
│   └── run-demo-api.md
├── concepts/
│   ├── processes-and-procfs.md
│   ├── users-groups-permissions.md
│   ├── filesystems-and-mounts.md
│   ├── signals-and-exit-status.md
│   ├── namespaces.md
│   └── cgroups-and-resources.md
├── runtime/
│   ├── systemd-services.md
│   ├── logs-and-journal.md
│   ├── sockets-and-name-resolution.md
│   └── resource-pressure.md
├── operations/
│   ├── security-boundaries.md
│   └── troubleshooting.md
└── reference/
    └── command-evidence-map.md
```

主学习路径是：Shell 实用基础、主机运行 `demo-api`、进程与 `/proc`、身份权限、文件与 mount、信号与退出、systemd、日志、namespace、cgroup、资源压力、安全边界、系统化排障。

### Start And Guides

- `index.md` 建立 Shell、systemd、kernel、process、filesystem、socket、namespace、cgroup 和 journal 的总关系，提供按顺序学习与按故障查阅两条路径。
- `guide/shell-practical-basics.md` 只覆盖后续实验需要的路径、引用、变量、管道、重定向、退出状态、条件执行、函数、`trap` 和 `set -euo pipefail` 的适用边界。
- `guide/run-demo-api.md` 在非 root 当前用户下安装并验证明确版本的 Node.js，创建 `demo-api` 源码，直接运行、访问、观察并安全停止应用，为后续页面提供共同进程与目录。

### Core Models

- `concepts/processes-and-procfs.md` 解释 process/thread、PID、PPID、state、environment、open file descriptor、`/proc` 和调度观察，不把进程表快照描述成完整历史。
- `concepts/users-groups-permissions.md` 解释 UID/GID、supplementary groups、mode bits、umask、ownership、ACL 与 capability 的职责边界，并创建专用 `demo-api` 服务账户。
- `concepts/filesystems-and-mounts.md` 解释 pathname、inode、link、filesystem、mount、space 与 inode exhaustion，以及应用从 mount namespace 看到的路径。
- `concepts/signals-and-exit-status.md` 解释 signal disposition、process group、exit status、shell wait、graceful shutdown 与 `SIGKILL` 的不可处理边界。
- `concepts/namespaces.md` 解释 mount、PID、network、UTS、IPC、user、cgroup 和 time namespace 改变的资源视图，明确 namespace 不是虚拟机或完整安全边界。
- `concepts/cgroups-and-resources.md` 解释 cgroup v2 hierarchy、controller、membership、accounting、limit、delegation 与 pressure，连接 systemd、Docker 和 Kubernetes 的资源模型。

### Runtime

- `runtime/systemd-services.md` 把 `demo-api` 交给 systemd，解释 unit load、dependency、service state、execution context、restart、stop timeout、resource control 和 drop-in override。
- `runtime/logs-and-journal.md` 从应用 stdout/stderr 到 journal entry，解释 unit、PID、boot、priority 和时间过滤，并区分 journal、kernel log 与应用业务日志。
- `runtime/sockets-and-name-resolution.md` 解释监听地址、端口、socket、connection、host route 和 resolver lookup 的观察顺序，只讲排障所需主机接口。
- `runtime/resource-pressure.md` 通过受控进程和 transient unit 观察 CPU、memory、I/O、PID、disk space 与 inode pressure，不在宿主机制造不可控 OOM 或磁盘耗尽。

### Operations And Reference

- `operations/security-boundaries.md` 串联最小权限服务账户、文件权限、capability、systemd sandboxing、secret 输入、日志敏感数据和主机共享 kernel 边界。
- `operations/troubleshooting.md` 按进程未创建、立即退出、权限拒绝、路径或文件缺失、端口不可达、DNS 失败、资源受限和 kernel/host pressure 分层定位。
- `reference/command-evidence-map.md` 按问题整理 `ps`、`procfs`、`systemctl`、`journalctl`、`ss`、`ip`、`getent`、`findmnt`、`df`、`stat`、`id` 和 cgroup 文件等证据，并链接回概念页。

## Continuous Example

全模块复用应用名 `demo-api`、端口 `3000` 和健康路径 `/healthz`。应用代码与 Docker / OCI 模块保持语义一致，避免读者把应用差异误认为运行环境差异。

实验分三个阶段：

1. 当前非 root 用户从实验目录直接启动应用，观察 PID、父进程、环境、文件描述符、socket 与退出状态。
2. 创建专用 `demo-api` 系统账户，把应用交给 `demo-api.service`，观察 execution context、journal、restart 和 graceful stop。
3. 通过 systemd drop-in 和 transient unit 设置或观察 cgroup v2 资源属性，再与 Docker CLI 参数和 Kubernetes Pod resources 建立对应关系。

Node.js 使用明确版本的官方 Linux 二进制发行包，并校验上游 checksum。实验安装到专用目录，不替换 Ubuntu 系统自带运行时，不使用不透明的远程安装脚本。文档说明版本会更新，读者应按上游受支持版本和组织策略复核版本与校验值。

## System Relationship

文档使用以下动作关系作为总模型：

```text
Shell 执行命令
  -> kernel 创建并调度进程
  -> 进程读取文件、环境变量和 socket
  -> systemd 创建服务进程并监督状态
  -> journal 收集服务输出和元数据
  -> namespace 改变进程可见的资源视图
  -> cgroup 组织、统计并约束进程资源
```

图中的 unit、文件、socket metadata、namespace 和 cgroup 都是配置或 kernel 对象，不主动执行应用代码。实际执行者是进程；systemd、Shell 和 kernel 分别在自己的职责内发起或完成动作。

## Safety And Cleanup

- 每个命令序列声明工作目录、Ubuntu 版本、所需权限和环境前置条件。
- 每个实验给出可观察的成功证据，而不是只以命令返回零状态作为理解完成。
- `sudo` 只用于创建专用账户、安装明确软件包、写入 unit 或读取受限证据；普通应用运行不以 root 为默认。
- 不把 `chmod 777`、禁用 AppArmor、关闭防火墙、清空 journal、`kill -9` 或删除系统目录作为常规修复。
- namespace、mount、cgroup 和 resource pressure 实验使用 transient unit、临时目录或明确命名的隔离进程，不要求修改宿主全局配置。
- 清理命令只停止并删除本实验创建的 unit、drop-in、账户、目录和进程；删除前验证目标身份和路径。
- 可能影响主机可用性的 OOM、磁盘填满、inode 耗尽、fork bomb 和无限 CPU 实验不实际执行，改用受限资源、静态证据或安全的小规模模拟。

## Content Standards

- 中文解释术语，官方命令、路径、directive、signal 和接口名保留原文。
- 明确区分 Shell、kernel、systemd、Ubuntu 与推荐实践各自规定的行为。
- 每个复杂页面至少包含命令、`/proc` 或 cgroup 证据、unit 配置、关系图、对比表、故障检查点中的一种。
- 输出片段只保留用于判断的字段；PID、时间、inode、地址和资源值标明是示意，不承诺逐字一致。
- 排障从可观察事实出发，依次定位 process、identity、file、service、journal、socket、resource 和 kernel/host 层，不堆砌命令。
- 安全建议说明威胁边界和代价，不把非 root、capability removal、namespace、systemd sandboxing 或 cgroup 单项描述为完整隔离。
- 关键技术结论使用 Linux kernel documentation、man-pages、systemd 官方手册和 Ubuntu 官方文档作为主要来源。
- 内部链接使用根绝对路径，只链接已经存在的模块页面。

## Cross-Module Boundaries

Linux 与 Docker / OCI 建立以下双向关系：

- 主机 process 与容器初始 process、PID 1 和 signal handling。
- UID/GID、file permission、capability 与容器 `USER`、bind mount ownership。
- filesystem、mount view、mount namespace 与容器 writable layer、Volume、bind mount。
- listening socket、host publication 与容器 network namespace。
- cgroup v2、systemd resource control 与 Docker resource flags。

Linux 与 Kubernetes 建立以下双向关系：

- 节点 process 与 Pod/container process。
- UID/GID、capability、seccomp 与 SecurityContext。
- signal、exit、systemd supervision 边界与 workload lifecycle、probe 和 restart behavior。
- cgroup resource evidence 与 Pod requests/limits、node pressure 和 eviction evidence。
- host-level process、journal、socket、filesystem 和 resource evidence 与 Kubernetes 排障边界。

Containerd、网络与 DNS、存储等未完成模块不创建空链接。Linux 页面只在正文中说明这些主题的边界。

## Site Integration

- 在 `docs/.vitepress/config.mts` 中为 `/linux/` 添加独立侧边栏，顺序与主学习路径一致。
- 在 `docs/.vitepress/theme/home-content.ts` 中仅在全部正文和集成验证完成后把 Linux 改为 `available` 并链接 `/linux/`。
- Docker / OCI 和 Kubernetes 对应页面增加指向 Linux 真实页面的反向链接。
- 本地搜索、上一篇/下一篇导航和生产构建包含全部 Linux 页面。
- 不修改现有主题、品牌、交互、Docker / OCI 或 Kubernetes 的技术内容，交叉链接所需的局部补充除外。

## Testing

- 新增 Linux canonical route manifest，验证 16 个 Markdown 页面、侧边栏条目和生产 HTML 清单完全一致。
- 新增逐页内容契约，验证必要术语、真实动作关系、实验命令、安全边界、环境说明和官方来源。
- 对 `bash` 代码块运行 `bash -n` 静态语法检查；标为输出的代码块不得被当作脚本执行。
- 解析 systemd unit 示例，验证 section、directive、unit name、service account、working directory、command 和 restart/stop 配置的一致性。
- 检查连续示例始终使用 `demo-api`、端口 `3000`、健康路径 `/healthz`、专用服务账户和 `demo-api.service`。
- 验证 Linux 与已发布 Docker / OCI、Kubernetes 页面之间要求的双向链接。
- 扩展全局内部链接、Mermaid、首页状态和生产构建测试，确保 Linux 路由真实可访问而其他规划主题仍不可点击。
- 运行全量 Vitest、`npm run typecheck`、`npm run build` 和 `git diff --check`。

CI 不要求拥有 root、运行中的 systemd、可写 cgroup hierarchy 或修改主机 namespace 的能力。真实主机步骤通过内容契约、Shell/unit 静态解析、官方资料核对和人工技术审查验证；文档不得声称这些命令已在 CI 实际执行。

## Completion Criteria

Linux 模块只有同时满足以下条件才算完成：

- 16 页信息架构覆盖已确认的学习路径，不存在占位符、未解释的关键跳跃或超出边界的专题复制。
- `demo-api` 可以按文档在 Ubuntu 24.04 LTS 上由当前用户运行，再由专用账户和 systemd 管理，并能观察其 process、file、journal、socket 和 cgroup 证据。
- Shell、kernel、systemd、Ubuntu、Docker、Containerd 和 Kubernetes 的职责边界准确。
- 高影响命令都有权限、风险、成功证据和精确清理说明。
- 侧边栏、首页入口、内部链接、双向链接、搜索和构建产物完整。
- 内容测试、全量测试、类型检查和生产构建通过，桌面与移动视口没有导航、表格或代码块溢出回归。
- 首页仅在上述检查完成后把 Linux 标记为已完成。

## Out Of Scope

- 本轮不同时编写 Containerd、网络与 DNS、存储、云平台基础或其他后续模块正文。
- 不提供生产主机加固基线、组织级账户生命周期、集中日志平台或发行版迁移方案。
- 不要求测试或 CI 环境执行 root、systemd、mount、namespace、cgroup 或资源耗尽操作。
- 不修改 GitHub Pages 配置或处理当前延期的 Pages 验证。
