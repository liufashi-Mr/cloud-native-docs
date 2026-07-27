# 从源码到第一个容器

这条路径把一个不依赖第三方包的 Node.js HTTP 应用构建成 `demo-api:dev` 镜像，再创建容器、访问端口并清理资源。所有文件都放在同一个新建的 `demo-api` 目录中。

## 前置条件

你需要 Docker CLI、可连接的 Docker Engine，以及能够拉取 Docker Hub 基础镜像的网络。`curl` 用于验证 HTTP 路径。本页的可复制路径要求当前 Docker context 指向本机 Docker Engine：`127.0.0.1:8080` 绑定在 daemon 所在主机，如果 context 指向远程 Engine，在 CLI 所在主机访问 `localhost:8080` 不会到达该容器。此时应切换到本地 context，或在获得授权的远程主机上执行验证；不要为了省略这一步而把端口改为对所有网卡暴露。先从[总览的最短验证路径](/docker-oci/#一个最短验证路径)确认 Client、Server 和 context，再创建一个空目录：

```bash
mkdir demo-api
cd demo-api
```

后续命令均在这个目录中执行。如果 `docker version` 没有 Server 部分，不要继续构建；这表示 CLI 尚未连到 Engine。

## 创建示例应用

创建 `server.mjs`：

```js
import { createServer } from 'node:http'

const port = Number(process.env.PORT ?? 3000)

const server = createServer((request, response) => {
  if (request.url === '/healthz') {
    response.writeHead(200, { 'content-type': 'text/plain' })
    response.end('ok\n')
    return
  }

  response.writeHead(200, { 'content-type': 'application/json' })
  response.end(JSON.stringify({ service: 'demo-api', pid: process.pid }) + '\n')
})

server.listen(port, '0.0.0.0', () => {
  console.log(`demo-api listening on ${port}`)
})
```

`/healthz` 返回简单的 `ok`，其他路径返回带当前 PID 的 JSON。应用监听 `0.0.0.0:3000`，因此从容器网络接口进入的请求可以到达它；只监听容器内的 `127.0.0.1` 会让端口发布后仍然无法访问。

## 定义构建上下文

创建 `Dockerfile`：

```dockerfile
# syntax=docker/dockerfile:1
FROM node:24.11.1-alpine3.22
WORKDIR /app
COPY --chown=node:node server.mjs .
USER node
EXPOSE 3000
ENTRYPOINT ["node", "server.mjs"]
```

`FROM` 的明确版本 tag 便于审查更新，但 tag 仍然可变。生产构建应审批基础镜像更新，并可以把已验证的 digest 写入 `FROM`，以锁定不变输入。`USER node` 让应用不以 root 身份运行，但这只是一层防护，并不能代替主机、socket 和运行时策略。

`EXPOSE 3000` 只在镜像配置中记录端口元数据，并不会发布主机端口。真正的主机到容器端口映射由后面 `docker run --publish` 创建。

创建 `.dockerignore`：

```text
.git
node_modules
npm-debug.log
```

`docker build ... .` 末尾的 `.` 是 build context（构建上下文）的根目录。Dockerfile 中的 `COPY` 只能从这个上下文取文件；`.dockerignore` 在上下文传给 builder 前排除无关或敏感路径，减少传输、缓存失效和意外复制的风险。

## 构建并检查镜像

```bash
docker build --pull --tag demo-api:dev .
docker image ls demo-api
docker image inspect demo-api:dev --format 'image ID={{.Id}}'
docker image inspect demo-api:dev --format '{{json .Config}}'
```

`--pull` 要求 builder 检查 `FROM` 引用的新内容，不等于使可变 tag 自动变成不变输入。构建成功时，命令返回零状态，`docker image ls` 显示 `demo-api` 的 `dev` tag，第三条命令输出以 `sha256:` 开头的 image ID。最后一条可以观察 `WorkingDir`、`User`、`ExposedPorts` 和 `Entrypoint` 等镜像配置。

## 创建并访问容器

```bash
docker run --detach --name demo-api --publish 127.0.0.1:8080:3000 demo-api:dev
docker container ls --filter name=demo-api
docker logs demo-api
curl http://localhost:8080/
curl http://localhost:8080/healthz
```

`--detach` 让容器在后台运行，`--name` 给运行时对象一个便于操作的名字，`--publish 127.0.0.1:8080:3000` 仅把主机回环地址的 `8080` 转发到容器端口 `3000`，不向外部网卡广泛暴露。

成功的可观察结果是：列表中的容器状态为 `Up`，日志包含 `demo-api listening on 3000`，`localhost:8080` 的根路径返回类似 `{"service":"demo-api","pid":1}` 的 JSON，`/healthz` 返回 `ok`。PID 取决于实际进程，不应把示例数字写进验证脚本。

## 观察镜像与容器的区别

```bash
docker image inspect demo-api:dev --format 'image ID={{.Id}}'
docker container inspect demo-api --format 'container ID={{.Id}} image={{.Image}} status={{.State.Status}}'
docker container diff demo-api
```

image ID 标识本地镜像对象，container ID 标识根据该镜像创建的运行时对象，两者不应相同。容器 inspect 输出中的 `image=` 指向它创建时使用的镜像 ID；`docker container diff` 显示容器可写层相对于镜像的变化。这些变化属于容器，不会回写原镜像。

## 停止和清理

正常路径先请求容器停止，再删除容器和此次生成的镜像：

```bash
docker stop demo-api
docker rm demo-api
docker image rm demo-api:dev
```

`docker stop` 成功时输出容器名，删除后 `docker container ls --all --filter name=demo-api` 不再列出它。如果容器无法正常停止，或你需要一条命令结束并删除它，用下面的强制路径代替前两条命令：

```bash
docker rm --force demo-api
docker image rm demo-api:dev
```

强制删除会跳过完整的正常停止观察过程，不要在需要调查退出行为时把它当成默认第一步。本页没有创建 Volume 或自定义网络，因此不需要额外清理这些资源。

## 失败检查点

- **构建在 `FROM` 失败：** 先检查 Registry 网络、DNS、代理和拉取限制；这尚不是应用源码错误。
- **`COPY` 报文件不存在：** 确认当前目录有 `server.mjs`，构建命令末尾是 `.`，且 `.dockerignore` 没有排除所需文件。
- **容器启动后立即退出：** 用 `docker container ls --all --filter name=demo-api`、`docker logs demo-api` 和 `docker container inspect demo-api --format '&#123;&#123;json .State&#125;&#125;'` 查看退出码与错误。
- **端口已被占用：** `docker run` 会在发布阶段报错，但可能已留下名为 `demo-api` 的已创建容器。先用 `docker container ls --all --filter name=^/demo-api$` 确认状态。如果仍使用主机端口 `8080`，停止占用者后执行 `docker start demo-api`；如果要改用其他主机端口，先用 `docker rm demo-api` 删除这个失败容器，再用新的 `--publish` 参数重新创建，并同步更改 `curl` URL。
- **`curl` 连接被拒绝：** 按顺序检查容器是否 `Up`、日志是否显示监听 `3000`、应用是否监听 `0.0.0.0`，以及 inspect 的 `HostConfig.PortBindings`。
- **能访问根路径但健康检查错误：** 核对 URL 是 `/healthz`，并直接查看 `curl --verbose http://localhost:8080/healthz` 的状态码和响应体。

## 下一步

你现在有了一条可重复的源码→build context→镜像→容器→HTTP 响应路径。回到 [Docker / OCI 总览](/docker-oci/)选择下一条学习路径；要先理解刚才的调用关系，继续阅读 [Docker 架构](/docker-oci/concepts/docker-architecture)，要改进构建文件则进入 [Dockerfile](/docker-oci/build/dockerfile)。
