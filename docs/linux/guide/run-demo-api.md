# 在主机运行 demo-api

本页在 Ubuntu 24.04 LTS 上直接运行与 Docker / OCI 模块相同语义的 HTTP 应用。它只绑定 `127.0.0.1:3000`，不会对外网开放端口。下载版本与 SHA256 必须在执行时根据 Node.js 官方发布清单复核；示例不会用远程脚本修改系统。

## 前置条件

需要 Bash、`curl`、`sha256sum`、`tar`、`ps`、`ss` 和 `readlink`。当前用户应能在 `/tmp` 创建目录，不需要 root：

```bash
set -euo pipefail
for command_name in curl sha256sum tar ps ss readlink; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf 'missing command: %s\n' "$command_name" >&2
    exit 1
  fi
done

. /etc/os-release
test "$ID" = ubuntu
test "$VERSION_ID" = 24.04
```

如果发行版检查失败，不要假定包名、systemd 或目录行为相同。Docker Desktop、WSL 和普通容器也不等价于完整 Ubuntu 主机。

## 创建隔离实验目录

```bash
lab_dir=$(mktemp -d --tmpdir demo-api-host.XXXXXX)
app_dir="$lab_dir/app"
mkdir -m 0750 -- "$app_dir"
printf 'lab_dir=%s\n' "$lab_dir"
```

保存实际输出；后续清理只接受 `/tmp/demo-api-host.*`。

## 获取并校验 Node.js

以下版本与 Docker / OCI 示例的 Node.js 主版本保持一致。Node.js 发布会更新；执行前从 [Node.js downloads](https://nodejs.org/en/download) 和官方 `SHASUMS256.txt` 复核版本仍受支持、文件名与校验来源。不要把示例 checksum 当作永久值。

```bash
node_version='24.11.1'
node_arch='linux-x64'
archive="node-v${node_version}-${node_arch}.tar.xz"
release_base="https://nodejs.org/dist/v${node_version}"

curl --fail --location --proto '=https' --tlsv1.2 \
  --output "$lab_dir/$archive" "$release_base/$archive"
curl --fail --location --proto '=https' --tlsv1.2 \
  --output "$lab_dir/SHASUMS256.txt" "$release_base/SHASUMS256.txt"

(
  cd "$lab_dir"
  grep "  $archive\$" SHASUMS256.txt > SHASUMS256.selected
  test "$(wc -l < SHASUMS256.selected)" -eq 1
  sha256sum --check SHASUMS256.selected
)

mkdir -m 0750 -- "$app_dir/node"
tar --extract --xz --file "$lab_dir/$archive" \
  --directory "$app_dir/node" --strip-components=1
"$app_dir/node/bin/node" --version
```

`sha256sum --check` 的 `OK` 是下载内容匹配官方 SHA256 清单的证据，不证明该版本符合组织的供应链审批策略。

## 创建 demo-api

创建 `$app_dir/server.mjs`：

```js title="server.mjs"
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

server.listen(port, '127.0.0.1', () => {
  console.log(`demo-api listening on ${port}`)
})

function shutdown(signal) {
  console.log(`received ${signal}`)
  server.close((error) => {
    if (error) {
      console.error(error)
      process.exitCode = 1
    }
  })
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
```

用本地 here-document 写入时必须使用带单引号的 delimiter，避免 Shell 展开 JavaScript 中的 `$`：

```bash
cat >"$app_dir/server.mjs" <<'JAVASCRIPT'
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
server.listen(port, '127.0.0.1', () => console.log(`demo-api listening on ${port}`))
function shutdown(signal) {
  console.log(`received ${signal}`)
  server.close((error) => {
    if (error) {
      console.error(error)
      process.exitCode = 1
    }
  })
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
JAVASCRIPT
chmod 0640 -- "$app_dir/server.mjs"
```

## 直接启动并记录 PID

先拒绝复用已被占用的端口，再在后台启动并立即记录 PID：

```bash
if ss -H -ltn 'sport = :3000' | grep -q .; then
  printf 'port 3000 is already listening; stop and identify its owner first\n' >&2
  exit 1
fi

log_file="$lab_dir/demo-api.log"
PORT=3000 "$app_dir/node/bin/node" "$app_dir/server.mjs" \
  >"$log_file" 2>&1 &
demo_pid=$!
printf '%s\n' "$demo_pid" >"$lab_dir/demo-api.pid"

sleep 1
if ! kill -0 "$demo_pid" 2>/dev/null; then
  cat "$log_file" >&2
  exit 1
fi
ps -o pid,ppid,user,lstart,stat,comm -p "$demo_pid"
```

`kill -0` 只检查此刻是否能向该 PID 发信号，不永久证明身份；后续操作还要核对启动时间与可执行文件。

## 验证 HTTP 与监听 socket

```bash
curl --fail --show-error http://127.0.0.1:3000/
curl --fail --show-error http://127.0.0.1:3000/healthz
ss -ltnp 'sport = :3000'
```

成功证据包括 JSON 中 `service` 为 `demo-api`、健康路径返回 `ok`，以及 `ss -ltnp` 显示 `127.0.0.1:3000` 处于 `LISTEN`。无权限时 `ss` 可能隐藏进程名，但 socket 行仍可观察。监听只发生在 loopback，不代表其他主机能访问。

## 观察 procfs 证据

先确认 PID 文件只含十进制数字，再核对可执行文件和启动时间：

```bash
demo_pid=$(cat "$lab_dir/demo-api.pid")
case "$demo_pid" in
  ''|*[!0-9]*) printf 'invalid PID file\n' >&2; exit 1 ;;
esac

test -d "/proc/$demo_pid"
readlink "/proc/$demo_pid/exe"
tr '\0' ' ' <"/proc/$demo_pid/cmdline"
printf '\n'
ps -o pid,lstart,stat,comm -p "$demo_pid"
ls -l "/proc/$demo_pid/fd" | sed -n '1,12p'
```

`/proc` 是 kernel 暴露的运行时视图。命令行和环境可能包含敏感值，不要把完整输出贴入工单或公共日志。

## 发送终止信号并等待

再次验证可执行文件来自本实验目录，才发送 `SIGTERM`：

```bash
demo_exe=$(readlink "/proc/$demo_pid/exe")
test "$demo_exe" = "$app_dir/node/bin/node"

kill -TERM "$demo_pid"

deadline=$((SECONDS + 15))
while kill -0 "$demo_pid" 2>/dev/null; do
  if (( SECONDS >= deadline )); then
    printf 'demo-api did not stop within 15 seconds; inspect before forcing termination\n' >&2
    exit 1
  fi
  sleep 1
done
wait "$demo_pid"
demo_status=$?
printf 'exit_status=%s\n' "$demo_status"
cat "$log_file"
```

正常关闭预期退出状态为 `0`，日志包含 `received SIGTERM`。不要在超时后自动使用 `SIGKILL`；先保存进程、日志和阻塞点证据。

## 精确清理

只在应用进程已结束、路径匹配实验前缀时删除目录：

```bash
if kill -0 "$demo_pid" 2>/dev/null; then
  printf 'refusing cleanup while PID %s is running\n' "$demo_pid" >&2
  exit 1
fi

case "$lab_dir" in
  /tmp/demo-api-host.*)
    test -d "$lab_dir"
    rm -r -- "$lab_dir"
    ;;
  *)
    printf 'refusing unexpected cleanup target: %s\n' "$lab_dir" >&2
    exit 1
    ;;
esac
```

删除实验目录会同时删除下载的 Node.js、源码和日志，不影响系统 Node.js 或其他服务。

## 失败检查点

| 现象 | 证据 | 下一步 |
| --- | --- | --- |
| checksum 不匹配 | `sha256sum` 返回非零 | 删除下载文件，重新核对 HTTPS 来源、版本和官方清单；不要跳过校验 |
| 进程立即退出 | PID 不存在且日志有错误 | 检查 Node 版本、源码语法、端口占用和工作目录 |
| socket 存在但 HTTP 失败 | `ss` 为 LISTEN，`curl` 非 2xx | 保存响应与应用日志，区分传输和应用路径问题 |
| PID 身份不匹配 | `/proc/<pid>/exe` 不在实验目录 | 拒绝发信号；PID 可能已复用，重新定位真实进程 |
| SIGTERM 后不退出 | 15 秒上界到期 | 保存 `ps`、`/proc`、socket 和日志证据，再决定是否升级处置 |

进程接口参考 [proc(5)](https://man7.org/linux/man-pages/man5/proc.5.html) 与 [signal(7)](https://man7.org/linux/man-pages/man7/signal.7.html)，Ubuntu 环境边界参考 [Ubuntu Server documentation](https://documentation.ubuntu.com/server/)。

## 下一步

在[进程与 procfs](/linux/concepts/processes-and-procfs)中解释刚才的 PID、父子关系、状态和文件描述符。之后把同一应用交给 [systemd 服务](/linux/runtime/systemd-services)，避免依赖交互式 Shell 长期监督。
