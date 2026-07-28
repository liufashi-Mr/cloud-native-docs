# 健康检查与生命周期

一句话：probe 把“进程已启动”“现在能接流量”“已经失去自愈能力”拆成不同信号，lifecycle hook 与终止宽限期则给应用有限的启动后处理和退出窗口。

这些机制由 kubelet 针对 Pod 中的 container 执行。它们能改变 container 重启和 Pod 是否进入 Service endpoint，但不能替代端到端监控，也不能证明下游依赖一定健康。

## 三类 probe 各自回答什么

| 检查 | 职责 | 失败达到阈值后的效果 | 适合检查 |
| --- | --- | --- | --- |
| `startupProbe` | 应用是否完成一次性启动 | kubelet 终止 container，随后按 Pod `restartPolicy` 处理 | 慢启动、需要恢复日志或加载大模型的进程 |
| `readinessProbe` | 此刻是否应该接收流量 | Pod 的容器就绪条件变为 false；readinessProbe 失败不会重启 container | 过载、依赖暂不可用、需要先预热的服务 |
| `livenessProbe` | 进程是否卡死且只能靠重启恢复 | kubelet 终止 container，随后按 `restartPolicy` 处理 | 死锁、事件循环永久停滞等不可恢复状态 |

没有配置 probe 时，kubelet 不会自动知道业务接口是否可用：container 进程在运行通常就会被视为已启动和可就绪；进程退出仍按 `restartPolicy` 处理。`successThreshold` 对 liveness 和 startup 必须为 1；readiness 可以要求连续成功。所有 probe 都应设置符合应用延迟分布的 `timeoutSeconds`、`periodSeconds` 和 `failureThreshold`。

startupProbe 成功前，kubelet 不执行同一 container 的 readinessProbe 和 livenessProbe。startup 成功后它不再运行，后两者才接管。因此慢启动预算约为 `periodSeconds × failureThreshold`，不要再用过大的 liveness 初始延迟掩盖启动问题。

### 如何选检查方式

| handler | 优点 | 风险与边界 | 典型选择 |
| --- | --- | --- | --- |
| HTTP GET | 可表达独立的启动、就绪、存活端点 | handler 应轻量；不要让所有 probe 都依赖同一个脆弱的外部系统 | HTTP 应用首选 |
| TCP socket | 只验证端口可以建立连接 | 端口监听不代表请求能被正确处理 | 无健康 HTTP 接口的 TCP 服务 |
| `exec` | 能检查 container 内部状态 | 创建进程有成本，命令和工具必须在镜像内存在 | 本地文件、进程专用诊断 |
| gRPC | 使用 gRPC health checking protocol | 需要应用实现健康服务并正确声明端口 | 原生 gRPC 服务 |

readiness 应回答“接一个新请求是否合理”，liveness 只回答“是否必须重启”。把短暂的数据库故障写进 liveness 常会制造重启风暴；把只检查 PID 的命令写进 readiness 又可能过早放量。

## 一个完整的 probe 与 preStop 示例

下面使用固定版本的公开 BusyBox 镜像：启动命令先创建 `/www/healthz`，再以前台 `httpd` 监听 8080，所以三类 HTTP probe 都检查一个真实存在的 handler。preStop 先移除该文件、等待 5 秒，再由 kubelet 继续发送 TERM；这个例子不依赖自定义镜像或外部 controller，可以独立进入 Ready。

Deployment 明确写入 `demo` Namespace。独立运行本页示例前，先用下面的幂等命令创建或确认该 Namespace：

```bash
kubectl create namespace demo --dry-run=client -o yaml | kubectl apply -f -
```

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  namespace: demo
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      terminationGracePeriodSeconds: 45
      containers:
        - name: web
          image: busybox:1.36.1
          command:
            - /bin/sh
            - -c
            - |
              mkdir -p /www
              printf 'ok\n' > /www/healthz
              exec httpd -f -p 8080 -h /www
          ports:
            - name: http
              containerPort: 8080
          lifecycle:
            preStop:
              exec:
                command: ["/bin/sh", "-c", "rm -f /www/healthz; sleep 5"]
          startupProbe:
            httpGet:
              path: /healthz
              port: http
            periodSeconds: 5
            timeoutSeconds: 2
            failureThreshold: 30
          readinessProbe:
            httpGet:
              path: /healthz
              port: http
            periodSeconds: 5
            timeoutSeconds: 2
            failureThreshold: 2
            successThreshold: 1
          livenessProbe:
            httpGet:
              path: /healthz
              port: http
            periodSeconds: 10
            timeoutSeconds: 2
            failureThreshold: 3
```

```bash
kubectl -n demo apply -f deployment.yaml
kubectl -n demo rollout status deployment/web
kubectl -n demo get pods -l app=web -o wide
kubectl -n demo describe pod -l app=web
```

若基础设施还要确认负载均衡注册、缓存同步等 Pod 外部状态，可以在 `Pod.spec.readinessGates` 中声明扩展条件，例如 `example.com/cache-synced`。某个有权限的外部 controller 必须随后把同名 Pod status condition 写成 True；条件缺失时 Kubernetes 按 false 处理，因此没有该 controller 就不要声明 gate。Pod 的 Ready condition 要同时满足 ContainersReady 和所有 gates。

## hook 不是 entrypoint 包装器

postStart 与 container entrypoint 并发：runtime 创建 container 后，kubelet 会尽快调用 postStart，但 Kubernetes 不保证它在 ENTRYPOINT 之前执行。hook 完成前 container 不会进入可用状态；hook 失败会导致 container 被终止并按重启策略处理。需要严格先后顺序的初始化应放进 entrypoint 或 init container，而不是依赖 postStart 的竞态。

preStop 只在 kubelet 管理的终止流程中、container 仍在运行且宽限期非零时调用；进程已经退出时不会补调。对于同一 container，preStop 与主进程收到 TERM 信号的先后是：先开始并等待 preStop 完成，再请求 runtime 发送 TERM；但 preStop 消耗的时间已经计入整个 Pod 的 termination grace period。多个普通 containers 的终止顺序没有保证，它们的 hook 和信号处理可以并发或交错，不能用一个 container 的 preStop 推断另一个 container 尚未收到信号。

## 删除 Pod 时实际发生什么

删除请求让 API 对象获得 `deletionTimestamp`，随后触发两条没有全局排序保证的路径：控制面 controller 观察 Pod/Service 变化并更新 EndpointSlice；目标 Node 上的 kubelet 开始本地 termination grace period。控制面 endpoint 更新与节点上的终止处理异步并发，受 watch、调谐和网络传播延迟影响；Kubernetes 不保证 EndpointSlice propagation 先于 preStop 或 TERM，也不保证代理在进程退出前已经完成摘流。

只有 kubelet 对**同一个 container**的本地处理有以下顺序：

1. 若 container 仍在运行、配置了 preStop 且 grace 尚未耗尽，kubelet 先执行 hook。若 hook 在宽限期结束仍未完成，kubelet 会请求一次很短的额外宽限，然后继续终止，不能把它当成可依赖的延长机制。
2. preStop 返回后，runtime 向 PID 1 发送镜像 `STOPSIGNAL` 或默认 TERM；应用应停止接新请求、完成有限清理并退出。普通 containers 之间没有固定顺序；原生 sidecar container 具有单独的反向终止顺序语义。
3. 宽限期耗尽后，仍存活的进程会被强制终止。最终 API Server 删除 Pod 对象。

EndpointSlice 用三个 conditions 描述终止中的后端：`terminating=true` 表示 endpoint 对应的 Pod 正在终止；为兼容只理解旧 `ready` 字段的 load balancer，terminating endpoint 通常写成 `ready=false`；`serving=true` 则表示该 terminating endpoint 当前仍能服务。理解这些字段的 agent 可以用 serving 与 terminating 做 connection draining，但仍必须容忍上述传播竞态。`publishNotReadyAddresses` 是另一项显式例外，消费该 Service endpoint 的 agent 应忽略 ready/not-ready 指示。

SIGTERM 不是“等待到宽限期结束才发送”。让 preStop 只做短暂排空延迟，把真正的优雅退出放在进程的 TERM handler 中，并让两者总时长小于宽限期。节点失联、强制删除或进程自身崩溃也可能绕过完整流程，所以持久数据一致性不能只依赖 hook。

## Pod phase、container state 与条件

`Pod.status.phase` 是粗粒度摘要，常见值为 Pending、Running、Succeeded、Failed 和 Unknown。Pod phase 为 Running 只表示 Pod 已绑定且至少一个 container 正在运行、启动中或重启中，并不等于应用 Ready。

每个 container 的 `state` 才是 Waiting、Running 或 Terminated，并带 reason、exitCode、startedAt/finishedAt 等细节；反复的 Waiting/Terminated 可以发生在 phase 仍为 Running 的 Pod 中。`restartCount` 与 `lastState` 是定位 CrashLoopBackOff 的关键。

Pod conditions 记录 Initialized、PodScheduled、ContainersReady、Ready 以及自定义 readiness gates。只有内置就绪条件和所有 gate 都为 true，Pod 才 Ready。对 selector Service，EndpointSlice controller 通常据此写入 endpoint：`conditions.ready=false` 不应接收常规流量；`conditions.ready=null` 表示未知，但为兼容旧 endpoint，消费者应把 null 解释为 ready。Service 设置 `publishNotReadyAddresses` 时，消费该 Service endpoint 的 agent 应忽略 ready/not-ready 指示，消费者必须理解这一显式例外，而不是把“出现在 EndpointSlice”直接等同于可用。

```bash
if ! POD_REFS=$(kubectl -n demo get pods -l app=web -o name); then
  exit 1
fi
if [ -n "$POD_REFS" ]; then
  for POD_REF in $POD_REFS; do
    kubectl -n demo get "$POD_REF" -o jsonpath='{.metadata.name}{" phase="}{.status.phase}{"\n"}{range .status.containerStatuses[*]}{.name}{" state="}{.state}{" restarts="}{.restartCount}{"\n"}{end}'
    kubectl -n demo get "$POD_REF" -o jsonpath='{range .status.conditions[*]}{.type}{"="}{.status}{" reason="}{.reason}{"\n"}{end}'
  done
else
  echo "no web Pods found in demo namespace"
fi
```

::: warning 常见误区
Ready、Running 与“用户请求成功”是三个层次。probe 只能从 kubelet 所在网络命名空间按配置执行检查；Service、DNS、入口代理、证书和 NetworkPolicy 仍需沿真实请求路径验证。
:::

## 继续阅读

前置：[调度与资源](/kubernetes/concepts/scheduling-resources)。下一篇：[发布与扩缩容](/kubernetes/operations/release-scaling)，把单个 Pod 的健康信号放进副本更新与容量控制循环。容器 PID 1、信号转发和退出行为见 [进程与生命周期](/docker-oci/runtime/process-lifecycle)；底层 signal disposition、process group、wait status 与强制终止边界见 [Linux 信号与退出状态](/linux/concepts/signals-and-exit-status)。
