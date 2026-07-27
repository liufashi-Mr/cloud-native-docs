# Docker 命令速查

命令速查不能替代对应概念页的边界说明。先确认 Docker context、对象类型和数据生命周期，再执行命令；尤其不要把 image、container、Volume 和 build cache 当作同一类可删除对象。

前置条件：已安装 Docker CLI，并只想读取当前目标的环境与磁盘概况。下面三条命令不创建或删除对象；输出应先确认 context 名称、Client/Server 版本以及各类对象占用：

```bash
docker context show
docker version
docker system df --verbose
```

## 环境与 daemon

| 目标 | 首要证据 | 命令 |
| --- | --- | --- |
| 确认 CLI/Engine 版本 | Client 与 Server 两段版本 | `docker version` |
| 确认 daemon 配置 | storage、cgroup、rootless、警告 | `docker info` |
| 确认当前目标 | context 名称 | `docker context show` |
| 比较 context | endpoint 与 TLS 配置 | `docker context inspect <name>` |
| 建立时间线 | create/start/die/oom 事件 | `docker events --since 30m --until 0s` |

远程 context 下，publish 绑定中的 `127.0.0.1` 属于 daemon host；本地 `curl` 中的 `127.0.0.1` 属于 CLI host。两条回环路径可能位于不同主机，不能互相代替。

## 镜像与 Registry

| 目标 | 首要证据 | 命令 |
| --- | --- | --- |
| 查看 image config | Entrypoint、Cmd、Env、User、digest | `docker image inspect demo-api:dev` |
| 列出本地镜像 | repository、tag、image ID、size | `docker image ls --digests` |
| 拉取并记录结果 | resolved digest 与状态 | `docker pull <reference>` |
| 查看多平台 index | manifest descriptors 与 platform | `docker buildx imagetools inspect <reference>` |
| 查看历史元数据 | history 条目与大小 | `docker history --no-trunc demo-api:dev` |
| 删除确认过的本地引用 | 被删除的 tag/layer 引用 | `docker image rm <reference>` |

tag 可变，image ID 只描述本地对象，Registry digest 才适合跨环境固定内容；digest 完整性不等于发布者可信。

## 构建与 cache

| 目标 | 首要证据 | 命令 |
| --- | --- | --- |
| 显示完整构建步骤 | stage、命令与错误输出 | `docker buildx build --progress=plain --tag demo-api:dev .` |
| 刷新基础镜像 | 新解析的 base digest | `docker buildx build --pull --tag demo-api:dev .` |
| 绕过构建 cache | 每一步重新执行 | `docker buildx build --no-cache --tag demo-api:dev .` |
| 查看 cache 占用 | record、可回收大小、last used | `docker buildx du --verbose` |
| 检查 builder | driver、节点与平台 | `docker buildx inspect --bootstrap` |
| 删除 build cache | 删除记录与释放空间 | `docker builder prune` |

`--no-cache` 不会自动重新拉取基础镜像；需要刷新时同时评估 `--pull`。`docker builder prune` 是破坏性操作，会降低后续构建命中率，远程/共享 builder 上还可能影响其他使用者。

## 容器与进程

| 目标 | 首要证据 | 命令 |
| --- | --- | --- |
| 查看全部容器 | name、status、ports | `docker container ls --all` |
| 查看最终配置/状态 | `.Config`、`.HostConfig`、`.State` | `docker container inspect <container>` |
| 查看应用输出 | 带时间的 stdout/stderr | `docker logs --timestamps --tail 200 <container>` |
| 查看容器进程 | PID、用户、参数 | `docker top <container> -eo pid,user,args` |
| 查看资源快照 | CPU、memory、I/O | `docker stats --no-stream <container>` |
| 查看端口映射 | 主机地址与端口 | `docker port <container>` |
| 优雅停止 | stop 信号与最终状态 | `docker stop --timeout 10 <container>` |
| 删除已确认容器 | container object 与 writable layer 删除 | `docker rm <container>` |

`docker rm --force` 会跳过正常 grace period；只有已判断无需优雅关闭且目标名称准确时使用。

## 网络

| 目标 | 首要证据 | 命令 |
| --- | --- | --- |
| 列出网络 | driver 与 scope | `docker network ls` |
| 查看 endpoint/DNS | containers、subnet、gateway | `docker network inspect <network>` |
| 创建 user-defined bridge | 新 network ID | `docker network create demo-net` |
| 将既有容器接入网络 | endpoint 出现在 inspect | `docker network connect demo-net <container>` |
| 断开容器 | endpoint 从 inspect 消失 | `docker network disconnect demo-net <container>` |
| 删除空网络 | network ID 被删除 | `docker network rm demo-net` |

删除 network 前确认没有仍需通信的 endpoint。`host`、`none` 与 user-defined bridge 的隔离和 DNS 行为不同，参见[网络](/docker-oci/runtime/networking)。

## 存储

| 目标 | 首要证据 | 命令 |
| --- | --- | --- |
| 列出 Volume | driver 与名称 | `docker volume ls` |
| 查看 Volume | mountpoint、labels、scope | `docker volume inspect <volume>` |
| 查看容器挂载 | type、source、destination、RW | `docker container inspect <container> --format '{{json .Mounts}}'` |
| 创建命名 Volume | volume name | `docker volume create <volume>` |
| 删除已确认 Volume | volume 删除结果 | `docker volume rm <volume>` |
| 查看整体磁盘 | image/container/volume/cache 占用 | `docker system df --verbose` |

Volume 删除通常不可恢复。删除前停止写入、按应用语义备份并验证恢复；live database 的直接 tar 不等于一致性备份。

## Compose

| 目标 | 首要证据 | 命令 |
| --- | --- | --- |
| 展开最终模型 | 插值后的 services/networks/volumes | `docker compose config` |
| 查看插值来源 | 解析使用的环境变量 | `docker compose config --environment` |
| 构建并等待 | service 状态/health | `docker compose up --build --wait` |
| 查看项目容器 | service、state、health、ports | `docker compose ps` |
| 跟踪日志 | 按 service 标记的输出 | `docker compose logs --tail 200` |
| 删除项目容器与网络 | removed objects | `docker compose down` |
| 同时删除声明 Volume | removed volumes | `docker compose down --volumes` |

`down --volumes` 比普通 `down` 多删除 Compose 文件声明的 named volumes 和附着于 containers 的 anonymous volumes，可能永久删除数据；external volumes 不由 Compose 删除。

## 清理与破坏性操作

清理命令执行前先检查目标和数据生命周期。以下命令不应作为通用排障第一步：

| 命令 | 删除范围 | 恢复影响 |
| --- | --- | --- |
| `docker rm <container>` | 删除一个 stopped container 及其 writable layer；不自动删除 Volume | 可按原配置重建容器；未持久化数据和未另存的现场证据丢失 |
| `docker container prune` | 所有 stopped containers | writable layer 与未另存的证据丢失 |
| `docker image rm <reference>` | 删除指定本地 image 引用；无其他 tag 或容器引用时回收 image 数据 | 可重新 pull/build；未推送且无其他引用的内容可能丢失 |
| `docker image prune -a` | 所有未被容器引用的镜像 | 需要重新 pull/build，未推送内容可能丢失 |
| `docker network rm demo-net` | 删除指定的无活动 endpoint network；不删除容器 | 可重建 network；自定义 subnet、options 与连接关系需重新配置 |
| `docker volume rm <volume>` | 删除指定且未被容器使用的 Volume | 持久数据通常不可恢复，只能从已验证备份还原 |
| `docker volume prune` | 默认删除未被任何 container 使用的 anonymous local volumes；`--all` 才扩入未使用的 named volumes | 被删除的 Volume 数据通常不可恢复 |
| `docker builder prune` | 可回收 build cache | 后续构建变慢；共享 builder 影响更大 |
| `docker system prune` | 默认删除所有 stopped containers、未被 container 使用的 networks、dangling images 和未使用 build cache；`-a` 将 image 范围扩为所有未使用 images，`--volumes` 加入未使用 anonymous volumes | 多类现场与 cache 丢失；未推送 image 需重建，加入 `--volumes` 后持久数据通常不可恢复 |
| `docker compose down --volumes` | 当前 Compose project containers、Compose 创建的 networks、Compose 文件声明的 named volumes 和附着于 containers 的 anonymous volumes；不删除 external volumes | 被删除的 project Volume 数据可能永久丢失 |

建议先运行 `docker system df --verbose`、各类 `ls`/`inspect`，记录明确的 ID/名称，再执行最窄的删除命令。不要用宽泛 prune 代替根因分析。

完整选项与版本差异见 Docker 官方 [Docker CLI reference](https://docs.docker.com/reference/cli/docker/) 和 [`docker compose down`](https://docs.docker.com/reference/cli/docker/compose/down/)；速查表只保留常用证据路径，不替代命令的 `--help` 输出。

概念与流程入口：[Docker 架构](/docker-oci/concepts/docker-architecture)、[镜像模型](/docker-oci/concepts/image-model)、[容器模型](/docker-oci/concepts/container-model)、[安全边界](/docker-oci/operations/security)和[故障排查](/docker-oci/operations/troubleshooting)。
