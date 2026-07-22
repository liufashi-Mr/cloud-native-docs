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
if ! POD_REFS=$(kubectl -n "$NS" get pods -l "app=$APP" --field-selector=status.phase=Pending -o name); then
  exit 1
fi
if [ -n "$POD_REFS" ]; then
  for POD_REF in $POD_REFS; do
    POD=${POD_REF#pod/}
    kubectl -n "$NS" get "$POD_REF" -o wide
    kubectl -n "$NS" describe "$POD_REF"
    kubectl -n "$NS" get events --field-selector "involvedObject.kind=Pod,involvedObject.name=$POD" --sort-by=.lastTimestamp
    kubectl -n "$NS" get "$POD_REF" -o jsonpath='{.spec.nodeName}{"\n"}{range .status.conditions[*]}{.type}{"="}{.status}{" reason="}{.reason}{"\n"}{end}'
  done
else
  echo "no Pending web Pods found in $NS"
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
if ! POD_REFS=$(kubectl -n "$NS" get pods -l "app=$APP" -o name); then
  exit 1
fi
if [ -n "$POD_REFS" ]; then
  for POD_REF in $POD_REFS; do
    kubectl -n "$NS" describe "$POD_REF"
    kubectl -n "$NS" get "$POD_REF" -o jsonpath='{range .status.initContainerStatuses[*]}init {.name}{" state="}{.state}{"\n"}{end}{range .status.containerStatuses[*]}{.name}{" state="}{.state}{" last="}{.lastState}{" restarts="}{.restartCount}{"\n"}{end}'
    kubectl -n "$NS" logs "$POD_REF" --all-containers=true --tail=200
    kubectl -n "$NS" logs "$POD_REF" --all-containers=true --previous --tail=200
  done
else
  echo "no web Pods found in $NS"
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
if ! POD_REFS=$(kubectl -n "$NS" get pods -l "app=$APP" -o name); then
  exit 1
fi
if [ -n "$POD_REFS" ]; then
  for POD_REF in $POD_REFS; do
    kubectl -n "$NS" get "$POD_REF" -o custom-columns='NAME:.metadata.name,PHASE:.status.phase,READY:.status.conditions[?(@.type=="Ready")].status,DELETING:.metadata.deletionTimestamp,RESTARTS:.status.containerStatuses[*].restartCount'
    kubectl -n "$NS" describe "$POD_REF"
    kubectl -n "$NS" get "$POD_REF" -o jsonpath='{range .status.conditions[*]}{.type}{"="}{.status}{" reason="}{.reason}{" message="}{.message}{"\n"}{end}'
  done
else
  echo "no web Pods found in $NS"
fi
```

在修 probe 之前从应用内部和 Pod 网络分别验证对应 handler。不要把 readiness 指向一个短暂波动就需要重启的深层依赖，也不要用宽松 liveness 隐藏永久死锁。

## 6. EndpointSlice 已填充

**可观察状态：** `kubernetes.io/service-name` label 对应目标 Service，endpoints 中有 Pod 地址、targetRef、zone 与 conditions。empty endpoints 通常说明 selector 没匹配 Pod。`ready=false` 既可能来自 readiness 失败，也可能因为 Pod 已有 `deletionTimestamp`、endpoint 已 `terminating=true`；必须连同 `serving` 和 Pod 删除状态判断，不能一律回到 probe。

**常见原因：** Service selector 与 Pod labels 不一致、Service 无 selector 而又没有手工 EndpointSlice、Pod 正在终止或未 Ready、端口名/targetPort 与 Pod port 不一致。`conditions.ready=null` 表示未知，但兼容语义要求消费者把 null 解释为 ready；`publishNotReadyAddresses` 要求处理该 Service endpoint 的 agent 忽略 ready/not-ready 指示。两者都不能简化成“列表非空就一定健康”。

```bash
NS=${NS:-demo}
SERVICE=${SERVICE:-web}
kubectl -n "$NS" get service "$SERVICE" -o yaml
kubectl -n "$NS" get pods -o custom-columns='NAME:.metadata.name,LABELS:.metadata.labels,READY:.status.conditions[?(@.type=="Ready")].status,DELETING:.metadata.deletionTimestamp'
kubectl -n "$NS" get endpointslice -l "kubernetes.io/service-name=$SERVICE" -o wide
if ! ENDPOINTS=$(kubectl -n "$NS" get endpointslice -l "kubernetes.io/service-name=$SERVICE" -o jsonpath='{range .items[*].endpoints[*]}{.addresses[0]}{" ready="}{.conditions.ready}{" serving="}{.conditions.serving}{" terminating="}{.conditions.terminating}{" target="}{.targetRef.name}{"\n"}{end}'); then
  exit 1
fi
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

下面只检查名为 `http` 的 Service port；若应用使用其他名称，通过 `SERVICE_PORT_NAME` 覆盖。Service port 用于 ClusterIP/DNS 请求，direct endpoint URL 则使用**同一个 EndpointSlice** 中同名的 endpoint port，二者可能分别是 80 和 8080，不能混用。

```bash
NS=${NS:-demo}
SERVICE=${SERVICE:-web}
SERVICE_PORT_NAME=${SERVICE_PORT_NAME:-http}
DEBUG_POD=${DEBUG_POD:-netcheck-$$}
(
  set -e
  cleanup() {
    kubectl -n "$NS" delete pod "$DEBUG_POD" --ignore-not-found --wait=false || true
  }
  trap cleanup EXIT
  kubectl -n "$NS" delete pod "$DEBUG_POD" --ignore-not-found --wait=true
  kubectl -n "$NS" run "$DEBUG_POD" --image=curlimages/curl:8.10.1 --restart=Never --labels=diagnostic=netcheck --command -- sleep 3600
  kubectl -n "$NS" wait --for=condition=Ready pod/"$DEBUG_POD" --timeout=90s
  kubectl -n "$NS" exec "$DEBUG_POD" -- cat /etc/resolv.conf
  kubectl -n "$NS" exec "$DEBUG_POD" -- nslookup "$SERVICE.$NS.svc.cluster.local"
  if ! SERVICE_PORT=$(kubectl -n "$NS" get service "$SERVICE" -o jsonpath="{.spec.ports[?(@.name==\"$SERVICE_PORT_NAME\")].port}"); then
    exit 1
  fi
  if [ -z "$SERVICE_PORT" ]; then
    echo "service $SERVICE has no port named $SERVICE_PORT_NAME" >&2
    exit 1
  fi
  kubectl -n "$NS" exec "$DEBUG_POD" -- curl --fail --show-error --max-time 5 "http://$SERVICE:$SERVICE_PORT/"

  if ! SLICE_REFS=$(kubectl -n "$NS" get endpointslice -l "kubernetes.io/service-name=$SERVICE" -o name); then
    exit 1
  fi
  ENDPOINT_URL=
  for SLICE_REF in $SLICE_REFS; do
    if ! SLICE_HTTP_PORT=$(kubectl -n "$NS" get "$SLICE_REF" -o jsonpath="{.ports[?(@.name==\"$SERVICE_PORT_NAME\")].port}"); then
      exit 1
    fi
    if [ -z "$SLICE_HTTP_PORT" ]; then
      continue
    fi
    if ! SLICE_ENDPOINT_ROWS=$(kubectl -n "$NS" get "$SLICE_REF" -o jsonpath='{range .endpoints[*]}{.addresses[0]}{"|"}{.conditions.ready}{"|"}{.conditions.terminating}{"\n"}{end}'); then
      exit 1
    fi
    while IFS='|' read -r CANDIDATE_IP CANDIDATE_READY CANDIDATE_TERMINATING; do
      if [ -z "$CANDIDATE_IP" ] || [ "$CANDIDATE_TERMINATING" = "true" ]; then
        continue
      fi
      if [ "$CANDIDATE_READY" != "true" ] && [ -n "$CANDIDATE_READY" ]; then
        continue
      fi
      case "$CANDIDATE_IP" in
        *:*) ENDPOINT_HOST="[$CANDIDATE_IP]" ;;
        *) ENDPOINT_HOST=$CANDIDATE_IP ;;
      esac
      ENDPOINT_URL="http://$ENDPOINT_HOST:$SLICE_HTTP_PORT/"
      break
    done <<EOF
$SLICE_ENDPOINT_ROWS
EOF
    if [ -n "$ENDPOINT_URL" ]; then
      break
    fi
  done
  if [ -z "$ENDPOINT_URL" ]; then
    echo "no usable direct endpoint with port $SERVICE_PORT_NAME found for $SERVICE in $NS" >&2
    exit 1
  fi
  echo "checking direct endpoint $ENDPOINT_URL"
  kubectl -n "$NS" exec "$DEBUG_POD" -- curl --fail --show-error --max-time 5 "$ENDPOINT_URL"
  kubectl -n "$NS" get networkpolicy -o wide
  kubectl -n "$NS" describe networkpolicy
)
```

NetworkPolicy 是按方向和所有适用 policy 的允许并集计算的；源 egress 与目标 ingress 都可能需要放行，而且 CNI 必须实现 enforcement。若同一 debug Pod 直连 endpoint 成功而 Service IP 失败，集中检查 Service port 和集群 Service data plane；若直连也失败，回到应用监听地址、readiness 与 policy。

## 8. 入口路由可达

**可观察状态：** 对 Ingress，检查 `status.loadBalancer`、IngressClass、controller events/logs 和 HTTP host/path 行为；Ingress 没有 Gateway API 的标准 Accepted/ResolvedRefs conditions。对 Gateway API，分别检查 Gateway 的 Accepted/Programmed 和 HTTPRoute 的 Accepted 与 ResolvedRefs parent conditions。

**常见原因：** IngressClass/GatewayClass 不存在、controller 未运行、host/path 或 backend port 错、Route 未 Accepted/ResolvedRefs、load balancer/DNS 未就绪、外部防火墙或 NetworkPolicy 阻断入口数据面。API object 存在不代表 proxy 已配置。下面的 curl 只验证 HTTP Host routing，不验证 TLS 或 SNI；TLS 应另用实际证书域名发起 HTTPS 请求。

```bash
NS=${NS:-demo}
INGRESS=${INGRESS:-web}
HOST=${HOST:-web.example.test}
kubectl -n "$NS" get ingress "$INGRESS" -o yaml
kubectl -n "$NS" describe ingress "$INGRESS"
kubectl get ingressclass
if ! ADDRESS=$(kubectl -n "$NS" get ingress "$INGRESS" -o jsonpath='{.status.loadBalancer.ingress[0].ip}'); then
  exit 1
fi
if [ -z "$ADDRESS" ]; then
  if ! ADDRESS=$(kubectl -n "$NS" get ingress "$INGRESS" -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'); then
    exit 1
  fi
fi
if [ -n "$ADDRESS" ]; then
  curl --fail --show-error --max-time 10 -H "Host: $HOST" "http://$ADDRESS/"
else
  echo "ingress $INGRESS in $NS has no load balancer address"
fi
```

```bash
NS=${NS:-demo}
kubectl get gatewayclass
kubectl -n "$NS" get gateway,httproute -o yaml
kubectl -n "$NS" get gateway -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{range .status.conditions[*]}  {.type}{"="}{.status}{" reason="}{.reason}{"\n"}{end}{end}'
kubectl -n "$NS" get httproute -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{range .status.parents[*]}  parent={.parentRef.name}{"\n"}{range .conditions[*]}    {.type}{"="}{.status}{" reason="}{.reason}{"\n"}{end}{end}{end}'
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
| Service 可达，入口为 Ingress | Ingress `status.loadBalancer`、events、controller logs | 改应用镜像 |
| Service 可达，入口为 Gateway API | Gateway/HTTPRoute conditions | 改应用镜像 |

::: warning 保存证据
重建 Pod 会清除部分现场。先保存 `get -o yaml`、`describe`、events、current/previous logs 和相关 controller conditions，再做最小变更并从失败阶段重新验证。
:::

## 继续阅读

前置：[发布与扩缩容](/operations/release-scaling)。下一篇：[概念关系速查](/reference/concept-map)，按对象的 scope、owner、reference 和 lifetime 快速定位责任边界。
