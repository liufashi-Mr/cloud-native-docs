# K8s 概念手册

Kubernetes 以“期望状态”为核心：你声明系统应当达到的状态，控制器持续观察实际状态，并通过调谐让两者重新一致。

## 从工作负载到运行实例

`Deployment` 描述应用的期望状态并管理 `ReplicaSet`，`ReplicaSet` 再维持所需数量的 `Pod`。`Service` 为一组不断变化的 Pod 提供稳定的访问入口。

应用配置通常由 `ConfigMap` 提供，敏感数据由 `Secret` 提供；需要持久化数据时，Pod 通过 `PVC` 申请存储。
