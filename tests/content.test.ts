import { existsSync, readFileSync } from 'node:fs'
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '..')
const contentFiles = [
  'docs/index.md',
  'docs/guide/deployment-flow.md',
  'docs/concepts/resource-model.md',
  'docs/concepts/cluster-nodes.md',
  'docs/concepts/workloads.md',
  'docs/concepts/networking.md',
  'docs/concepts/config-storage.md',
  'docs/concepts/security.md',
  'docs/concepts/scheduling-resources.md',
  'docs/operations/health-lifecycle.md',
  'docs/operations/release-scaling.md',
  'docs/operations/troubleshooting.md',
  'docs/reference/concept-map.md',
]

const docsRoot = resolve(root, 'docs')
const coreConceptFiles = [
  'docs/concepts/resource-model.md',
  'docs/concepts/cluster-nodes.md',
  'docs/concepts/workloads.md',
  'docs/concepts/networking.md',
  'docs/concepts/config-storage.md',
  'docs/concepts/security.md',
  'docs/concepts/scheduling-resources.md',
]

const coreConceptContracts: Record<string, string[]> = {
  'docs/concepts/resource-model.md': [
    'apiVersion', 'kind', 'metadata', 'spec', 'status', 'UID', 'Namespace',
    'labels', 'selectors', 'annotations', 'OwnerReference', 'Finalizer',
    'deletionTimestamp', 'generation', 'observedGeneration', 'resourceVersion',
  ],
  'docs/concepts/cluster-nodes.md': [
    'API Server', 'etcd', 'Controller Manager', 'Scheduler', 'Node', 'kubelet',
    'kube-proxy', 'CRI', 'CNI', 'CSI', 'failure domain',
  ],
  'docs/concepts/workloads.md': [
    'Pod', 'ReplicaSet', 'Deployment', 'StatefulSet', 'DaemonSet', 'Job',
    'CronJob', 'kubelet', 'container runtime',
  ],
  'docs/concepts/networking.md': [
    'Pod IP', 'CNI', 'Service', 'EndpointSlice', 'CoreDNS', 'Ingress',
    'Gateway API', 'NetworkPolicy', 'selector', 'readiness',
  ],
  'docs/concepts/config-storage.md': [
    'ConfigMap', 'Secret', 'base64', 'Volume', 'PV', 'PVC', 'StorageClass',
    'access mode', 'reclaim policy', 'CSI', 'persistentVolumeClaim',
  ],
  'docs/concepts/security.md': [
    'Subject', 'ServiceAccount', 'Role', 'ClusterRole', 'RoleBinding',
    'ClusterRoleBinding', 'RBAC', 'SecurityContext', 'Pod Security Standards',
    'NetworkPolicy',
  ],
  'docs/concepts/scheduling-resources.md': [
    'requests', 'limits', 'QoS', 'filtering', 'scoring', 'nodeSelector',
    'affinity', 'anti-affinity', 'taints', 'tolerations', 'PriorityClass',
    'preemption', 'topology spread', 'PDB', 'voluntary',
  ],
}

function resolveRootAbsoluteHref(href: string): {
  pathname: string
  target: string
} | null {
  if (!href.startsWith('/') || href.startsWith('//')) return null

  const pathname = decodeURIComponent(href.split(/[?#]/, 1)[0])
  if (pathname.split(/[\\/]+/).includes('..')) {
    throw new Error(`root-absolute Markdown link escapes docs: ${href}`)
  }

  const target = resolve(docsRoot, pathname.slice(1))
  const relativeTarget = relative(docsRoot, target)
  const escapesDocs =
    relativeTarget === '..' ||
    relativeTarget.startsWith(`..${sep}`) ||
    isAbsolute(relativeTarget)

  if (escapesDocs) {
    throw new Error(`root-absolute Markdown link escapes docs: ${href}`)
  }

  return { pathname, target }
}

describe('content contract', () => {
  it.each(contentFiles)('%s exists', (file) => {
    expect(existsSync(resolve(root, file))).toBe(true)
  })

  it.each(coreConceptFiles)('%s teaches its required concepts with a usable example', (file) => {
    const markdown = readFileSync(resolve(root, file), 'utf8')

    for (const term of coreConceptContracts[file]) {
      expect(markdown, `${file} is missing ${term}`).toContain(term)
    }

    expect(markdown).toMatch(/```(?:yaml|bash)\n[\s\S]+?```/)
    expect(markdown).toMatch(/(?:误区|注意|不要|并不|不等于|不能)/)
    expect(markdown).toMatch(/\[[^\]]+\]\([^)]*\)/)
  })

  it('separates Pod networking from CSI node volume operations', () => {
    const chapter = readFileSync(
      resolve(root, 'docs/concepts/cluster-nodes.md'),
      'utf8',
    )

    for (const relation of [
      'KL -->|invokes CRI 调用 CRI| CR["Container runtime"]',
      'CR -->|invokes CNI for Pod networking 调用 CNI 配置 Pod 网络| CNI["CNI plugin"]',
      'KL -->|requests node-stage and node-publish 请求节点暂存与发布卷| CSI["CSI node plugin"]',
    ]) {
      expect(chapter, `cluster and nodes chapter is missing ${relation}`).toContain(
        relation,
      )
    }

    expect(chapter).not.toContain('invokes CNI and CSI')
    expect(chapter).not.toContain('CNI and CSI node plugins')
  })

  it('describes API persistence and storage actors without making resources active', () => {
    const resourceModel = readFileSync(
      resolve(root, 'docs/concepts/resource-model.md'),
      'utf8',
    )
    const storage = readFileSync(
      resolve(root, 'docs/concepts/config-storage.md'),
      'utf8',
    )

    expect(resourceModel).toContain('通过 API Server 访问和持久化')
    expect(resourceModel).toContain('后端通常是 etcd')
    expect(resourceModel).not.toContain('保存在 API Server 中')

    for (const phrase of [
      '`emptyDir` 与该 Pod UID 在当前 Node 上的生命周期一致',
      'container 崩溃或同一 Pod 的 sandbox 被重新创建',
      'external-provisioner',
      'CSI controller service',
      'volume binder / PV controller',
      'NodeStageVolume',
      'NodePublishVolume',
    ]) {
      expect(storage, `storage chapter is missing ${phrase}`).toContain(phrase)
    }

    for (const relation of [
      'API -->|serves PVC and StorageClass watch events 提供申领与存储类事件| EP["external-provisioner"]',
      'EP -->|calls CSI CreateVolume 调用卷创建接口| CC["CSI controller service or plugin"]',
      'CC -->|creates backend volume 创建后端卷| BS["Storage system volume"]',
      'EP -->|creates PV through API Server 通过 API Server 创建 PV| API',
      'API -->|serves PVC and PV watch events 提供申领与 PV 事件| VB["volume binder or PV controller"]',
      'VB -->|writes binding fields 写入绑定字段| API',
      'KL -->|calls NodeStageVolume and NodePublishVolume 调用节点暂存与发布| CSI["CSI node plugin"]',
      'CSI -->|may stage volume at 可在此暂存卷| ST["kubelet-managed global staging path"]',
      'CSI -->|publishes volume to 把卷发布到| HP["kubelet-managed host-side Pod volume path"]',
      'KL -->|passes host path in CRI container config 通过 CRI 容器配置传递主机路径| CR["CRI container runtime"]',
      'HP -.->|is referenced as mount source 被引用为挂载源| CR',
      'CR -->|bind-mounts path into container 把路径绑定挂载进容器| VM["container volume mount"]',
    ]) {
      expect(storage, `storage diagram is missing ${relation}`).toContain(
        relation,
      )
    }

    expect(storage).not.toContain('随 Pod sandbox 生命周期存在')
    expect(storage).not.toContain('PVC -->|binds')
    expect(storage).not.toContain('PVC -.->|requests')
    expect(storage).not.toContain(
      'CSI -->|stages and publishes resolved volume 暂存并发布解析后的卷| VM',
    )
  })

  it('documents volume source, endpoint readiness, and shell variable caveats', () => {
    const storage = readFileSync(
      resolve(root, 'docs/concepts/config-storage.md'),
      'utf8',
    )
    const networking = readFileSync(
      resolve(root, 'docs/concepts/networking.md'),
      'utf8',
    )
    const clusterNodes = readFileSync(
      resolve(root, 'docs/concepts/cluster-nodes.md'),
      'utf8',
    )
    const scheduling = readFileSync(
      resolve(root, 'docs/concepts/scheduling-resources.md'),
      'utf8',
    )

    for (const phrase of [
      'ConfigMap volume 与 Secret volume 是不同的 volume source',
      '`projected` volume',
      '由 kubelet 最终更新',
    ]) {
      expect(storage, `storage chapter is missing ${phrase}`).toContain(phrase)
    }

    for (const phrase of [
      '`conditions.ready=false`',
      '`conditions.ready=null`',
      '`publishNotReadyAddresses`',
    ]) {
      expect(networking, `networking chapter is missing ${phrase}`).toContain(
        phrase,
      )
    }

    expect(clusterNodes).toContain('NODE_NAME=')
    expect(clusterNodes).toContain('kubectl describe node "$NODE_NAME"')
    expect(clusterNodes).not.toContain('<node-name>')
    expect(scheduling).toContain('PENDING_POD=')
    expect(scheduling).toContain('kubectl -n demo describe pod "$PENDING_POD"')
    expect(scheduling).not.toContain('<pending-pod>')
  })

  it('lists the seven core concept chapters in learning order', () => {
    const config = readFileSync(resolve(root, 'docs/.vitepress/config.mts'), 'utf8')
    const group = config.match(/text: '核心概念',[\s\S]*?items: \[([\s\S]*?)\n\s*\],/)

    expect(group, 'sidebar is missing the core concept group').not.toBeNull()
    const links = Array.from(
      group?.[1].matchAll(/link: '([^']+)'/g) ?? [],
      (match) => match[1],
    )
    expect(links).toEqual([
      '/concepts/resource-model',
      '/concepts/cluster-nodes',
      '/concepts/workloads',
      '/concepts/networking',
      '/concepts/config-storage',
      '/concepts/security',
      '/concepts/scheduling-resources',
    ])
  })

  it('defines the fluid responsive theme contracts', () => {
    const styles = readFileSync(
      resolve(root, 'docs/.vitepress/theme/styles.css'),
      'utf8',
    )

    for (const contract of [
      '--k8s-accent',
      'clamp(',
      '@media (max-width: 1099px)',
      '@media (max-width: 767px)',
      'prefers-reduced-motion',
      'overflow-x: auto',
    ]) {
      expect(styles, `styles.css is missing ${contract}`).toContain(contract)
    }
  })

  it('introduces the core workload relationships on the home page', () => {
    const home = readFileSync(resolve(root, 'docs/index.md'), 'utf8')

    for (const term of [
      'Deployment',
      'ReplicaSet',
      'Pod',
      'Service',
      'ConfigMap',
      'Secret',
      'PVC',
    ]) {
      expect(home).toContain(term)
    }
  })

  it('distinguishes object envelopes from resource-specific state', () => {
    const home = readFileSync(resolve(root, 'docs/index.md'), 'utf8')

    for (const phrase of [
      'apiVersion、kind 和 metadata 是顶层对象的必需信封字段。',
      'spec 和 status 取决于资源类型；ConfigMap 和 Secret 没有 spec/status。',
      '用户声明 spec，通常不写 status。',
      '`Pod.status.phase`、`Pod.status.conditions`',
      '`Deployment.status.readyReplicas`',
      '`Pod.spec.nodeName`',
    ]) {
      expect(home, `home page is missing ${phrase}`).toContain(phrase)
    }

    expect(home).not.toContain('status | 控制器写入的实际状态 | 可用副本、条件、分配到的节点')
  })

  it('keeps workload creation, API persistence, and observed status distinct', () => {
    const flow = readFileSync(
      resolve(root, 'docs/guide/deployment-flow.md'),
      'utf8',
    )

    for (const phrase of [
      'API Server 持久化完整的 API 对象（包括 metadata、spec 和 status）',
      'workload controller 创建 Pod API 对象；kubelet 和容器运行时创建容器',
      '`spec.replicas` 表示期望副本数，`status.replicas` 表示观察到的副本数',
      'EndpointSlice controller 的输入是 Service 和 Pod 事件',
    ]) {
      expect(flow, `deployment flow is missing ${phrase}`).toContain(phrase)
    }

    expect(flow).not.toContain('每个组件更新自己的 `status`')
    expect(flow).not.toContain('participant P as Pod')

    const home = readFileSync(resolve(root, 'docs/index.md'), 'utf8')
    expect(home).toContain(
      'RC -->|creates 创建| P["Pod API object"]',
    )
    expect(home).toContain('CR -->|creates 创建| C["Container"]')
    expect(home).not.toContain('Pod API object"] -->|creates')
    expect(home).not.toContain('ReplicaSet API object"] -->|creates')
    expect(home).not.toContain('容器由 Pod 的工作负载对象创建')
  })

  it('separates ingress resources from their managed traffic dataplane', () => {
    const home = readFileSync(resolve(root, 'docs/index.md'), 'utf8')
    const flow = readFileSync(
      resolve(root, 'docs/guide/deployment-flow.md'),
      'utf8',
    )

    for (const phrase of [
      'Ingress / Gateway resource',
      'managed proxy / gateway data plane',
      'Ingress / Gateway 是配置资源；controller 观察它们并配置代理或网关数据面',
      'optional Service data plane',
      '实现可以经由 ClusterIP / kube-proxy / eBPF，也可以直接消费 Service / EndpointSlice 元数据并代理到 endpoint',
    ]) {
      expect(`${home}\n${flow}`, `content is missing ${phrase}`).toContain(
        phrase,
      )
    }

    expect(flow).toContain(
      'Note over IG,IC: Resource stores configuration and controller watches API Server',
    )
    expect(flow).not.toContain('A-->>IG:')
  })

  it('keeps the runnable example self-contained and selects all replica logs', () => {
    const home = readFileSync(resolve(root, 'docs/index.md'), 'utf8')
    const flow = readFileSync(
      resolve(root, 'docs/guide/deployment-flow.md'),
      'utf8',
    )

    expect(home).toContain('kind: Namespace')
    expect(home).toContain('name: demo')
    expect(flow).toContain(
      'kubectl logs deployment/web --all-pods=true --all-containers=true --prefix=true',
    )
    expect(flow).toContain('该命令会读取 Deployment 选择的所有 Pod')
  })

  it('uses an exact allowlist for the planned future routes', () => {
    const config = readFileSync(resolve(root, 'docs/.vitepress/config.mts'), 'utf8')
    const plannedRoutes = [
      '/operations/health-lifecycle',
      '/operations/release-scaling',
      '/operations/troubleshooting',
      '/reference/concept-map',
    ]

    const allowlist = config.match(
      /const plannedFutureRoutes = \[([\s\S]*?)\]\n/,
    )
    expect(allowlist, 'config is missing plannedFutureRoutes').not.toBeNull()

    const configuredRoutes = Array.from(
      allowlist?.[1].matchAll(/'([^']+)'/g) ?? [],
      (match) => match[1],
    )

    expect(configuredRoutes).toEqual(plannedRoutes)
    expect(config).toContain('ignoreDeadLinks: plannedFutureRoutes')
    expect(config).not.toContain('ignoreDeadLinks: [/^\\/(?:concepts|operations|reference)\\//]')
  })

  it('distinguishes claim references from container volume mounts', () => {
    const home = readFileSync(resolve(root, 'docs/index.md'), 'utf8')

    for (const relation of [
      'P -->|references 引用| CM["ConfigMap"]',
      'P -->|references 引用| SEC["Secret"]',
      'PS["Pod spec"] -->|references 引用| PVC["PersistentVolumeClaim"]',
      'C["Container"] -->|mounts 挂载| V["Volume resolved from claim"]',
      '| Pod | references | ConfigMap / Secret |',
      '| Pod spec | references | PVC |',
      '| Container | mounts | volume resolved from claim |',
    ]) {
      expect(home, `home page is missing ${relation}`).toContain(relation)
    }

    expect(home).not.toContain('| PVC | mounts | Pod |')
    expect(home).not.toContain('| Pod | mounts | PVC |')
  })

  it('mediates control-plane actions through the API Server', () => {
    const flow = readFileSync(
      resolve(root, 'docs/guide/deployment-flow.md'),
      'utf8',
    )

    for (const interaction of [
      'A-->>DC: Deployment watch event',
      'DC->>A: create or update ReplicaSet',
      'A-->>RC: ReplicaSet watch event',
      'RC->>A: create Pod',
      'A-->>S: unscheduled Pod watch event',
      'S->>A: bind Pod to Node',
      'A-->>KL: assigned Pod watch event',
      'EP->>A: update EndpointSlice endpoint conditions',
      'PX->>SD: forward via ClusterIP / Service data plane',
      'SD->>RP: forward to ready endpoint',
      'PX->>RP: proxy directly using Service / EndpointSlice metadata',
    ]) {
      expect(flow, `deployment flow is missing ${interaction}`).toContain(
        interaction,
      )
    }

    for (const directCall of [
      'DC->>RC:',
      'RC->>P:',
      'S->>N:',
      'EP->>N:',
    ]) {
      expect(flow).not.toContain(directCall)
    }
  })

  it('describes control-loop watches and updates in their real direction', () => {
    const home = readFileSync(resolve(root, 'docs/index.md'), 'utf8')

    for (const interaction of [
      'A -.->|is watched by 被观察| CO["Controller (reconciles desired state)"]',
      'A -.->|is watched by 被观察| SC["Scheduler (assigns Pods)"]',
      'A -.->|is watched by 被观察| KL["kubelet (reconciles assigned Pods)"]',
      'CO -->|updates objects 更新对象| A',
      'SC -->|writes Pod binding 写入 Pod 绑定| A',
      'KL -->|reports Pod status 汇报 Pod 状态| A',
    ]) {
      expect(home, `home page is missing ${interaction}`).toContain(
        interaction,
      )
    }
  })

  it('keeps EndpointSlice metadata separate from request forwarding', () => {
    const home = readFileSync(resolve(root, 'docs/index.md'), 'utf8')

    for (const relation of [
      'SD["optional Service data plane (ClusterIP / kube-proxy / eBPF)"]',
      'PX -->|or proxies directly 或直接代理| RP["Ready endpoint"]',
      'SD -->|forwards 转发| RP',
      'EndpointSlice 是控制平面 endpoint 元数据，不负责转发请求',
    ]) {
      expect(home, `home page is missing ${relation}`).toContain(relation)
    }

    expect(home).not.toContain('E -->|targets 指向| P')
  })

  it('keeps relative Markdown links valid', () => {
    const markdownLink = /\[[^\]]*\]\(([^)]+)\)/g
    const plannedFutureRoutes = new Set([
      '/operations/health-lifecycle',
      '/operations/release-scaling',
      '/operations/troubleshooting',
      '/reference/concept-map',
    ])

    for (const file of contentFiles) {
      const absoluteFile = resolve(root, file)
      if (!existsSync(absoluteFile)) continue

      const markdown = readFileSync(absoluteFile, 'utf8')
      for (const match of markdown.matchAll(markdownLink)) {
        const href = match[1].trim().replace(/^<|>$/g, '')
        if (/^(?:[a-z]+:|#)/i.test(href) || href.startsWith('//')) continue

        if (href.startsWith('/')) {
          const resolvedHref = resolveRootAbsoluteHref(href)
          expect(resolvedHref).not.toBeNull()
          const { pathname, target } = resolvedHref!
          const candidates = extname(target)
            ? [target]
            : [target, `${target}.md`, resolve(target, 'index.md')]

          expect(
            candidates.some((candidate) => existsSync(candidate)) ||
              plannedFutureRoutes.has(pathname),
            `${file} contains a broken root-absolute link: ${href}`,
          ).toBe(true)
          continue
        }

        const pathname = decodeURIComponent(href.split(/[?#]/, 1)[0])
        const target = resolve(dirname(absoluteFile), pathname)
        const candidates = extname(target)
          ? [target]
          : [target, `${target}.md`, resolve(target, 'index.md')]

        expect(
          candidates.some((candidate) => existsSync(candidate)),
          `${file} contains a broken relative link: ${href}`,
        ).toBe(true)
      }
    }
  })

  it('contains root-absolute links within docs and ignores protocol-relative URLs', () => {
    expect(resolveRootAbsoluteHref('//cdn.example.com/asset.css')).toBeNull()
    expect(resolveRootAbsoluteHref('/concepts/workloads')?.target).toBe(
      resolve(docsRoot, 'concepts/workloads'),
    )
    expect(() => resolveRootAbsoluteHref('/../package.json')).toThrow(
      'escapes docs',
    )
    expect(() => resolveRootAbsoluteHref('/%2e%2e/package.json')).toThrow(
      'escapes docs',
    )
    expect(() => resolveRootAbsoluteHref('/%2e%2e%5cpackage.json')).toThrow(
      'escapes docs',
    )
  })
})
