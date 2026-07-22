# 系统化排障

一句话：从 API 接受资源开始，沿 controller、scheduler、kubelet、EndpointSlice、Service 到入口逐层证明；不要在尚未创建 Pod 时先猜 DNS，也不要在 endpoint 为空时先重启入口代理。

下面固定使用 `demo` Namespace、`web` Deployment/Service/Ingress 和 `app=web` label。可以通过环境变量覆盖，但每段命令都对可能为空的 Pod、地址或 endpoint 做保护。

```mermaid
flowchart LR
  A["1 资源被 API 接受"] --> B["2 Pod 已创建"]
  B --> C["3 Pod 已调度"]
  C --> D["4 镜像与 container 已启动"]
  D --> E["5 Pod 已就绪"]
  E --> F["6 EndpointSlice 已填充"]
  F --> G["7 Service 可达"]
  G --> H["8 入口路由可达"]
```

## 1. 资源被 API 接受

**可观察状态：** server-side dry-run 成功，随后 `get` 能读回对象；metadata.generation 随 spec 修改，status.observedGeneration 由 controller 追上。

**常见原因：** YAML/API version 错误、字段类型或准入策略拒绝、Namespace 不存在、RBAC 无权限、quota 超限。若 apply 根本失败，后续没有可诊断的 Pod。

```bash
NS=${NS:-demo}
APP=${APP:-web}
kubectl -n "$NS" apply --dry-run=server -f deployment.yaml
kubectl -n "$NS" get deployment "$APP" -o yaml
kubectl -n "$NS" auth can-i patch deployments.apps
kubectl -n "$NS" get resourcequota,limitrange
kubectl -n "$NS" get events --field-selector "involvedObject.kind=Deployment,involvedObject.name=$APP" --sort-by=.lastTimestamp
```

先读 API 返回的 `message`、`reason` 和 field path。`kubectl apply` 本地成功不证明 admission 会接受，server-side dry-run 才经过服务端默认值、校验和准入链。

## 2. Pod 已创建

**可观察状态：** Deployment 的 observedGeneration、ReplicaSet 数量以及 Pod ownerReferences 连成一条链；`status.replicas` 开始接近期望值。

**常见原因：** Deployment paused、selector/template 不匹配、ReplicaFailure、quota 或 admission 拒绝 ReplicaSet/Pod、旧 ReplicaSet 仍受发布预算约束。此时先查 controller conditions 和 events，而不是 kubelet logs。

```bash
NS=${NS:-demo}
APP=${APP:-web}
kubectl -n "$NS" rollout status deployment/"$APP" --timeout=60s
kubectl -n "$NS" get deployment "$APP" -o wide
kubectl -n "$NS" describe deployment "$APP"
kubectl -n "$NS" get replicaset,pod -l "app=$APP" --show-labels
kubectl -n "$NS" get pods -l "app=$APP" -o custom-columns='NAME:.metadata.name,OWNER:.metadata.ownerReferences[0].name,PHASE:.status.phase'
```

若 Deployment 存在而没有 ReplicaSet，问题在 Deployment controller 之前或之中；有 ReplicaSet 而没有 Pod，则重点读 ReplicaSet events、quota 和 Pod admission。

## 3. Pod 已调度

**可观察状态：** `PodScheduled=True` 且 `spec.nodeName` 非空。Pending 只是 phase，必须看 conditions 和 scheduler events 才知道是尚未调度还是已经绑定但仍在拉镜像。

**常见原因：** requests 大于可用 allocatable、nodeSelector/affinity 不匹配、taint 无 toleration、拓扑分布或 PVC zone 冲突、unbound immediate PVC、优先级与抢占仍无法形成可行 Node。

```bash
NS=${NS:-demo}
APP=${APP:-web}
POD=$(kubectl -n "$NS" get pods -l "app=$APP" --field-selector=status.phase=Pending -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
if [ -n "$POD" ]; then
  kubectl -n "$NS" get pod "$POD" -o wide
  kubectl -n "$NS" describe pod "$POD"
  kubectl -n "$NS" get events --field-selector "involvedObject.kind=Pod,involvedObject.name=$POD" --sort-by=.lastTimestamp
  kubectl -n "$NS" get pod "$POD" -o jsonpath='{.spec.nodeName}{"\n"}{range .status.conditions[*]}{.type}{"="}{.status}{" reason="}{.reason}{"\n"}{end}'
else
  echo "no Pending web Pod found in $NS"
fi
kubectl get nodes -o custom-columns='NAME:.metadata.name,TAINTS:.spec.taints,ALLOCATABLE_CPU:.status.allocatable.cpu,ALLOCATABLE_MEMORY:.status.allocatable.memory'
```

`FailedScheduling` event 中列出的原因是 scheduler 当时的快照；改过资源或约束后要查看最新 event 时间，不要只引用旧消息。

## 4. 镜像与 container 已启动

**可观察状态：** init container 已完成，container state 从 Waiting 进入 Running；`startedAt`、`restartCount`、`lastState.terminated` 和 events 能区分拉取、启动与退出问题。

**常见原因：** ImagePullBackOff/ErrImagePull 常来自镜像名、tag、registry 网络或 imagePullSecret；CreateContainerConfigError 常来自缺失 ConfigMap/Secret；CrashLoopBackOff 表示反复启动失败后的退避，常见为错误参数、权限、依赖或 OOM。failed probe 也可能让 kubelet 终止并重启 container。

```bash
NS=${NS:-demo}
APP=${APP:-web}
POD=$(kubectl -n "$NS" get pods -l "app=$APP" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
if [ -n "$POD" ]; then
  kubectl -n "$NS" describe pod "$POD"
  kubectl -n "$NS" get pod "$POD" -o jsonpath='{range .status.initContainerStatuses[*]}init {.name}{" state="}{.state}{"\n"}{end}{range .status.containerStatuses[*]}{.name}{" state="}{.state}{" last="}{.lastState}{" restarts="}{.restartCount}{"\n"}{end}'
  kubectl -n "$NS" logs "$POD" --all-containers=true --tail=200
  kubectl -n "$NS" logs "$POD" --all-containers=true --previous --tail=200
else
  echo "no web Pod found in $NS"
fi
kubectl -n "$NS" get secret
```

CrashLoopBackOff 不是根因，而是等待下一次重启的状态；优先找上一轮 exitCode、reason、signal、OOMKilled 与 `--previous` logs。ImagePullBackOff 则应先修镜像或凭据，重建 Pod 不会修复错误引用。

## 5. Pod 已就绪

**可观察状态：** container Running 之后，ContainersReady、Ready 和所有 readiness gates 都为 True。readinessProbe 失败不会重启 container；liveness/startup failed probe 达到阈值才进入终止与重启语义。

**常见原因：** probe path/port/scheme 错、timeout 太短、应用尚未预热、依赖故障、custom readiness gate 没有 controller 写 True、postStart 卡住。Pod phase 为 Running 不能代替 Ready condition。

```bash
NS=${NS:-demo}
APP=${APP:-web}
POD=$(kubectl -n "$NS" get pods -l "app=$APP" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
if [ -n "$POD" ]; then
  kubectl -n "$NS" get pod "$POD" -o custom-columns='NAME:.metadata.name,PHASE:.status.phase,READY:.status.conditions[?(@.type=="Ready")].status,RESTARTS:.status.containerStatuses[*].restartCount'
  kubectl -n "$NS" describe pod "$POD"
  kubectl -n "$NS" get pod "$POD" -o jsonpath='{range .status.conditions[*]}{.type}{"="}{.status}{" reason="}{.reason}{" message="}{.message}{"\n"}{end}'
else
  echo "no web Pod found in $NS"
fi
```

在修 probe 之前从应用内部和 Pod 网络分别验证对应 handler。不要把 readiness 指向一个短暂波动就需要重启的深层依赖，也不要用宽松 liveness 隐藏永久死锁。

## 6. EndpointSlice 已填充

**可观察状态：** `kubernetes.io/service-name` label 对应目标 Service，endpoints 中有 Pod 地址、targetRef、zone 与 conditions。empty endpoints 通常说明 selector 没匹配 Pod；有地址但 `ready=false` 则回到上一步。

**常见原因：** Service selector 与 Pod labels 不一致、Service 无 selector 而又没有手工 EndpointSlice、Pod 正在终止或未 Ready、端口名/targetPort 与 Pod port 不一致。`conditions.ready=null` 表示未知，但兼容语义要求消费者把 null 解释为 ready；`publishNotReadyAddresses` 要求处理该 Service endpoint 的 agent 忽略 ready/not-ready 指示。两者都不能简化成“列表非空就一定健康”。

```bash
NS=${NS:-demo}
SERVICE=${SERVICE:-web}
kubectl -n "$NS" get service "$SERVICE" -o yaml
kubectl -n "$NS" get pods --show-labels
kubectl -n "$NS" get endpointslice -l "kubernetes.io/service-name=$SERVICE" -o wide
ENDPOINTS=$(kubectl -n "$NS" get endpointslice -l "kubernetes.io/service-name=$SERVICE" -o jsonpath='{range .items[*].endpoints[*]}{.addresses[0]}{" ready="}{.conditions.ready}{" terminating="}{.conditions.terminating}{" target="}{.targetRef.name}{"\n"}{end}' 2>/dev/null)
if [ -n "$ENDPOINTS" ]; then
  printf '%s\n' "$ENDPOINTS"
else
  echo "no EndpointSlice endpoints found for $SERVICE in $NS"
fi
```

selectorless Service 是例外：controller 不会凭空发现外部后端，需要显式管理 EndpointSlice。对于 selector Service，不要长期手工修改 controller 管理的 slice，它会被重新调谐。

## 7. Service 可达

**可观察状态：** 从同 Namespace 的临时 Pod 能解析 Service DNS，并能访问 Service port；再用 endpoint IP 对比可区分 Service data plane 与应用本身。

**常见原因：** DNS 配置或 CoreDNS 故障、Service port/targetPort 错、EndpointSlice 无 usable endpoint、kube-proxy/eBPF/CNI 数据面异常、NetworkPolicy 拒绝源 Pod 或目标 Pod。DNS 成功只证明名称解析，不证明 TCP/HTTP 可达。

```bash
NS=${NS:-demo}
SERVICE=${SERVICE:-web}
DEBUG_POD=${DEBUG_POD:-netcheck}
if ! kubectl -n "$NS" get pod "$DEBUG_POD" >/dev/null 2>&1; then
  kubectl -n "$NS" run "$DEBUG_POD" --image=curlimages/curl:8.10.1 --restart=Never --command -- sleep 3600
fi
kubectl -n "$NS" wait --for=condition=Ready pod/"$DEBUG_POD" --timeout=90s
kubectl -n "$NS" exec "$DEBUG_POD" -- cat /etc/resolv.conf
kubectl -n "$NS" exec "$DEBUG_POD" -- nslookup "$SERVICE.$NS.svc.cluster.local"
kubectl -n "$NS" exec "$DEBUG_POD" -- curl --fail --show-error --max-time 5 "http://$SERVICE:80/"
kubectl -n "$NS" get networkpolicy -o wide
kubectl -n "$NS" describe networkpolicy
```

NetworkPolicy 是按方向和所有适用 policy 的允许并集计算的；源 egress 与目标 ingress 都可能需要放行，而且 CNI 必须实现 enforcement。若同一 debug Pod 直连 endpoint 成功而 Service IP 失败，集中检查 Service port 和集群 Service data plane；若直连也失败，回到应用监听地址、readiness 与 policy。

## 8. 入口路由可达

**可观察状态：** Ingress 或 Gateway/HTTPRoute 已被对应 controller 接受，status 有地址和 conditions，managed proxy / gateway data plane 实际加载了 host/path/backend 配置；外部请求带正确 Host/SNI 能到达 Service。

**常见原因：** IngressClass/GatewayClass 不存在、controller 未运行、host/path 或 backend port 错、Route 未 Accepted/ResolvedRefs、load balancer/DNS/TLS 未就绪、外部防火墙或 NetworkPolicy 阻断入口数据面。API object 存在不代表 proxy 已配置。

```bash
NS=${NS:-demo}
INGRESS=${INGRESS:-web}
HOST=${HOST:-web.example.test}
kubectl -n "$NS" get ingress "$INGRESS" -o yaml
kubectl get ingressclass
kubectl get gatewayclass
kubectl -n "$NS" get gateway,httproute
ADDRESS=$(kubectl -n "$NS" get ingress "$INGRESS" -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null)
if [ -z "$ADDRESS" ]; then
  ADDRESS=$(kubectl -n "$NS" get ingress "$INGRESS" -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null)
fi
if [ -n "$ADDRESS" ]; then
  curl --fail --show-error --max-time 10 -H "Host: $HOST" "http://$ADDRESS/"
else
  echo "ingress $INGRESS in $NS has no load balancer address"
fi
```

Ingress/Gateway resource、controller 和 proxy/data plane 是三层：resource 保存配置，controller 观察 API 并配置实现，data plane 才转发请求。实现可能通过 ClusterIP，也可能直接消费 Service/EndpointSlice metadata；不要假定固定经过 kube-proxy。

## 快速决策

| 最后一个已证明阶段 | 下一处证据 | 不要先做 |
| --- | --- | --- |
| API 已接受 | Deployment/ReplicaSet conditions 与 events | 重启 Node |
| Pod 已创建 | PodScheduled 与 scheduler events | 改 probe |
| Pod 已调度 | container states、events、previous logs | 查 Ingress DNS |
| container 已启动 | Ready conditions 与 probe events | 扩 Node |
| Pod 已就绪 | Service selector 与 EndpointSlice conditions | 重启入口 controller |
| EndpointSlice 有 usable endpoint | Pod 内 DNS、Service port、NetworkPolicy | 改公网 DNS |
| Service 可达 | Ingress/Gateway conditions 与 proxy logs | 改应用镜像 |

::: warning 保存证据
重建 Pod 会清除部分现场。先保存 `get -o yaml`、`describe`、events、current/previous logs 和相关 controller conditions，再做最小变更并从失败阶段重新验证。
:::

## 继续阅读

前置：[发布与扩缩容](/operations/release-scaling)。下一篇：[概念关系速查](/reference/concept-map)，按对象的 scope、owner、reference 和 lifetime 快速定位责任边界。
