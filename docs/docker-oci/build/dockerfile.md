# Dockerfile：从构建输入到运行默认值

Dockerfile 是 builder 执行的构建定义，不是容器启动脚本，也不是 OCI Image Specification 的组成部分。Docker/BuildKit 解释其中的指令，生成文件系统层与镜像配置；OCI 镜像只保留构建结果，不要求消费者能够还原原始 Dockerfile。先走通[从源码到第一个容器](/docker-oci/guide/source-to-container)，再用本页收紧那条构建路径。

## build context 与 `.dockerignore`

`docker build ... .` 最后的 `.` 指定 build context（构建上下文）根目录。对普通 `COPY` 和 `ADD`，构建只能读取 build context 中的文件，不能用 `../` 越过这个边界读取主机任意路径。Git、远端 tar、named context 或 `RUN --mount` 只有在构建请求或 Dockerfile 中显式声明时才形成额外输入；读取范围由这些显式输入共同决定，而不是由 Dockerfile 所在目录无限扩展。

`.dockerignore` 在上下文发送给 builder 前排除路径。对 `demo-api`，可保持输入最小：

```text
.git
node_modules
npm-debug.log
.env
```

排除文件既减少传输和无关缓存失效，也降低误复制本地秘密的机会；它不是秘密管理机制。若后续指令确实需要某文件而它已被忽略，`COPY` 会失败。Dockerfile-specific ignore file 还能覆盖根目录规则，完整匹配行为见 Docker 官方的 [Build context](https://docs.docker.com/build/building/context/) 文档。

## 指令分成三类看

把常用指令按结果边界分类，比把每条指令都等同为“新建一层”更准确：

| 类别 | 常见指令 | 主要结果 |
| --- | --- | --- |
| stage 与输入 | `FROM`、`ARG` | 选择基础镜像、声明构建期参数并开启 stage |
| 文件系统操作 | `COPY`、`ADD`、`RUN` | 在当前 stage 中复制或生成文件系统变化 |
| 镜像配置 | `WORKDIR`、`USER`、`ENV`、`ENTRYPOINT`、`CMD`、`EXPOSE` | 设置创建容器时使用的默认配置 |

这是理解模型，不是 OCI 的指令分类要求。Docker 的具体 builder 可以在 history 中记录 config-only 指令，但它们不一定产生文件系统 layer；镜像中的 history 也不是可靠的 Dockerfile 审计日志。镜像结构可回看[镜像模型](/docker-oci/concepts/image-model)。

## 持续示例：两阶段 `demo-api`

以下 Dockerfile 延续 `server.mjs`、端口 `3000` 和 `/healthz`，只使用 Node 内置 `node:http`，不增加 npm 依赖。第一个 stage 检查语法并准备文件，第二个 stage 只接收运行所需结果：

```dockerfile
# syntax=docker/dockerfile:1
ARG NODE_IMAGE=node:24.11.1-alpine3.22

FROM ${NODE_IMAGE} AS verify
WORKDIR /src
COPY server.mjs .
RUN node --check server.mjs \
    && mkdir /out \
    && cp server.mjs /out/server.mjs

FROM ${NODE_IMAGE}
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app
COPY --from=verify --chown=node:node /out/server.mjs ./server.mjs
USER node
EXPOSE 3000
ENTRYPOINT ["node"]
CMD ["server.mjs"]
```

这个 multi-stage build 的 `verify` stage 不会自动成为最终镜像的一部分；最终 stage 只通过 `COPY --from=verify` 取得一个文件。multi-stage 的价值在于把编译器、测试工具和中间产物留在前置 stage，而不是保证镜像天然安全或最小。此示例的语法检查并不替代应用测试。

`node:24.11.1-alpine3.22` 使用明确版本 tag，但 tag 仍然可变。生产构建应评审基础镜像更新，并可把 `NODE_IMAGE` 替换为批准的 `node@sha256:...` digest；占位 digest 不能直接使用，必须来自已验证的 Registry 内容。

## shell form 与 exec form

Dockerfile 的 shell form 是一段由默认 shell 解释的字符串，例如：

```dockerfile
RUN test -f server.mjs && node --check server.mjs
```

这里的 `&&`、变量替换和重定向由 stage 中的 shell 处理。exec form 使用 JSON 数组直接给出可执行文件和参数：

```dockerfile
RUN ["node", "--check", "server.mjs"]
ENTRYPOINT ["node"]
CMD ["server.mjs"]
```

exec form 不经过 shell 展开参数，所以 `RUN ["echo", "$HOME"]` 会把 `$HOME` 当作普通字符串。确实需要 shell 行为时应显式执行 shell，例如 `RUN ["sh", "-c", "echo \"$HOME\""]`。对 `ENTRYPOINT` 和 `CMD`，exec form 也避免额外 shell 占据 PID 1，更容易让停止信号直接到达应用；如果必须用 shell form，应理解 `exec` 与信号转发的责任。

## `ARG` 与 `ENV` 的生命周期

`ARG` 声明构建变量，可由 `--build-arg` 提供。它只在声明后的有效作用域内供构建求值，不自动成为最终容器环境。全局 `ARG` 在 `FROM` 前可用于选择基础镜像；若 stage 内还要读取它，需要在相应 stage 再声明。

`ENV` 写入当前 stage 的镜像配置，并被后续指令与默认容器环境继承。运行时 `docker run --env` 可以覆盖它，但镜像 inspect 仍能看到构建时写入的默认值。两者都不适合秘密：构建参数可能出现在 provenance、history 或缓存元数据中，环境变量会进入镜像配置。

秘密不能通过 ARG、ENV 或 COPY 固化进镜像。需要在某条 `RUN` 中临时认证时，应使用 BuildKit [secret mount](https://docs.docker.com/build/building/secrets/)，并保证命令不会把秘密复制、打印或派生到普通 layer；具体缓存边界见 [BuildKit 缓存](/docker-oci/build/buildkit-cache)。

## `ENTRYPOINT` 与 `CMD` 的组合

ENTRYPOINT 定义可执行入口，CMD 提供默认参数。下表讨论推荐的 exec form；`docker run IMAGE ...` 中镜像名之后的内容是运行输入，不是 Docker CLI 自己的选项：

| Image config | `docker run` input | Final behavior |
| --- | --- | --- |
| ENTRYPOINT only | arguments | arguments append to ENTRYPOINT |
| CMD only | arguments | arguments replace CMD |
| ENTRYPOINT + CMD | no arguments | ENTRYPOINT runs with CMD defaults |
| ENTRYPOINT + CMD | arguments | ENTRYPOINT runs with replacement arguments |
| either | `--entrypoint` | executable entry is replaced explicitly |

因此示例默认执行 `node server.mjs`；`docker run demo-api:dev --version` 会执行 `node --version`，不会在 `server.mjs` 后追加 `--version`。`--entrypoint` 是创建容器时的显式覆盖：例如 `docker run --entrypoint node demo-api:dev --version`。Docker 对 `ENTRYPOINT`/`CMD` 的替换规则是产品行为，不是 OCI 对 Docker CLI 语法的要求；OCI image config 提供相近的 `Entrypoint` 与 `Cmd` 字段表示。

## 用户、目录与所有权

`WORKDIR /app` 同时影响后续 `RUN`、`COPY`、`ENTRYPOINT`/`CMD` 的相对路径以及容器默认工作目录。明确写出绝对路径可避免继承基础镜像意外默认值。

`USER node` 设置后续 `RUN` 的执行身份，并写入镜像的默认运行用户；容器创建后，`CMD`/`ENTRYPOINT` 启动的进程默认采用这个身份。它不改变 `COPY` 的默认 ownership：没有 `--chown` 时，复制文件仍默认为 root 所有，所以示例显式使用 `--chown=node:node`。非 root 默认值能减小一部分影响面，但不能替代只读文件系统、capability、挂载、seccomp 和主机权限控制；数字 UID/GID 在跨基础镜像时通常比名称更稳定，也需要与实际镜像账户定义一起评审。

## 构建、验证与清理

前置条件是当前目录已经按[源码示例](/docker-oci/guide/source-to-container)创建 `server.mjs` 与 `.dockerignore`，Docker CLI 可连接支持 BuildKit 的 Engine，并且网络能拉取基础镜像。执行：

```bash
docker build --pull --tag demo-api:dev .
docker image inspect demo-api:dev --format 'user={{.Config.User}} workdir={{.Config.WorkingDir}} entrypoint={{json .Config.Entrypoint}} cmd={{json .Config.Cmd}}'
docker run --detach --name demo-api --publish 127.0.0.1:8080:3000 demo-api:dev
curl --fail http://localhost:8080/healthz
```

成功证据是构建返回零状态，inspect 输出包含 `user=node`、`workdir=/app`、`entrypoint=["node"]` 与 `cmd=["server.mjs"]`，容器保持运行且 `/healthz` 返回 `ok`。`--pull` 会检查 `FROM` 引用是否有较新内容，但不会把可变 tag 变成不可变输入。

确认只清理本次示例资源后执行：

```bash
docker rm --force demo-api
docker image rm demo-api:dev
```

如果同名容器或 tag 在实验前已经存在，不要运行清理命令；应先改名隔离本次资源。

## 评审清单

- **上下文边界：** `COPY` 所需文件都在 build context 内，`.dockerignore` 排除了 VCS、依赖缓存、构建输出与本地凭据。
- **输入可复现性：** 基础镜像版本明确；生产环境评审 tag 更新，并能替换为批准 digest。
- **缓存顺序：** 稳定、低频变化的输入在前，源码等高频变化输入靠后；缓存机制详见 [BuildKit 缓存](/docker-oci/build/buildkit-cache)。
- **stage 边界：** 最终 stage 只复制运行期文件，不携带编译器、测试凭据或无关输出。
- **进程语义：** `ENTRYPOINT` 与 `CMD` 的组合、参数覆盖和信号路径已经用真实 `docker run` 输入验证。
- **权限：** `WORKDIR`、`USER`、文件 ownership 与写目录彼此一致，没有依赖 root 默认值。
- **秘密：** Dockerfile、上下文、普通 layer、`ARG`、`ENV`、日志和远端缓存中都没有秘密。
- **运行边界：** `EXPOSE 3000` 只是元数据；实际发布继续使用 `127.0.0.1:8080:3000`，健康检查仍是 `/healthz`。

## 常见误区

- **“Dockerfile 可以读取它旁边任意主机文件。”** builder 只能读取明确提供的 context、named context、mount 或远端输入。
- **“每条指令必然对应一个文件系统层。”** `ENV`、`CMD` 等主要改变镜像配置；history 与 layer 也不是一一对应。
- **“`ARG` 不进入最终环境，所以可以放密码。”** 参数值仍可能泄露到历史、provenance、日志或缓存元数据。
- **“写了 `USER node` 就完成容器加固。”** 它只设置默认进程身份，运行时权限和主机边界仍需单独控制。
- **“固定版本 tag 就固定了字节。”** tag 可以移动；需要不可变输入时使用经过审批和验证的 digest。

更完整的语法与版本差异以 Docker 官方 [Dockerfile reference](https://docs.docker.com/reference/dockerfile/) 为准。下一步阅读 [BuildKit 缓存](/docker-oci/build/buildkit-cache)，理解这里每项输入如何参与复用；需要回看产物结构时进入[镜像模型](/docker-oci/concepts/image-model)。
