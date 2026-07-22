import { existsSync, readFileSync } from 'node:fs'
import { dirname, extname, resolve } from 'node:path'
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

describe('content contract', () => {
  it.each(contentFiles)('%s exists', (file) => {
    expect(existsSync(resolve(root, file))).toBe(true)
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
      'Service data plane',
    ]) {
      expect(`${home}\n${flow}`, `content is missing ${phrase}`).toContain(
        phrase,
      )
    }

    expect(flow).toContain(
      'Note over IG,IC: Resource stores configuration; controller watches API Server',
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
      '/concepts/resource-model',
      '/concepts/cluster-nodes',
      '/concepts/workloads',
      '/concepts/networking',
      '/concepts/config-storage',
      '/concepts/security',
      '/concepts/scheduling-resources',
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

  it('keeps configuration and storage arrows consumer-first', () => {
    const home = readFileSync(resolve(root, 'docs/index.md'), 'utf8')

    for (const relation of [
      'P -->|references 引用| CM["ConfigMap"]',
      'P -->|references 引用| SEC["Secret"]',
      'P -->|mounts 挂载| PVC["PersistentVolumeClaim"]',
      '| Pod | references | ConfigMap / Secret |',
      '| Pod | mounts | PVC |',
    ]) {
      expect(home, `home page is missing ${relation}`).toContain(relation)
    }

    expect(home).not.toContain('| PVC | mounts | Pod |')
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
      'PX->>SD: route to Service',
      'SD->>RP: forward to ready Pod',
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
      'SD["Service data plane (kube-proxy / eBPF)"]',
      'E -.->|consumed by 被消费| SD',
      'SD -->|forwards 转发| RP["Ready Pod"]',
      'EndpointSlice 是控制平面 endpoint 元数据，不负责转发请求',
    ]) {
      expect(home, `home page is missing ${relation}`).toContain(relation)
    }

    expect(home).not.toContain('E -->|targets 指向| P')
  })

  it('keeps relative Markdown links valid', () => {
    const markdownLink = /\[[^\]]*\]\(([^)]+)\)/g
    const plannedFutureRoutes = new Set([
      '/concepts/resource-model',
      '/concepts/cluster-nodes',
      '/concepts/workloads',
      '/concepts/networking',
      '/concepts/config-storage',
      '/concepts/security',
      '/concepts/scheduling-resources',
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
        if (/^(?:[a-z]+:|#)/i.test(href)) continue

        if (href.startsWith('/')) {
          const pathname = decodeURIComponent(href.split(/[?#]/, 1)[0])
          const target = resolve(root, 'docs', pathname.slice(1))
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
})
