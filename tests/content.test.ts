import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path'
import MarkdownIt from 'markdown-it'
import { describe, expect, it } from 'vitest'
import { parseAllDocuments } from 'yaml'

import { dockerOciRouteManifest } from './support/docker-oci-routes'
import { markdownFences } from './support/markdown'

const root = resolve(import.meta.dirname, '..')
const markdownParser = new MarkdownIt()
const contentFiles = [
  'docs/kubernetes/index.md',
  'docs/kubernetes/guide/deployment-flow.md',
  'docs/kubernetes/concepts/resource-model.md',
  'docs/kubernetes/concepts/cluster-nodes.md',
  'docs/kubernetes/concepts/workloads.md',
  'docs/kubernetes/concepts/networking.md',
  'docs/kubernetes/concepts/config-storage.md',
  'docs/kubernetes/concepts/security.md',
  'docs/kubernetes/concepts/scheduling-resources.md',
  'docs/kubernetes/operations/health-lifecycle.md',
  'docs/kubernetes/operations/release-scaling.md',
  'docs/kubernetes/operations/troubleshooting.md',
  'docs/kubernetes/reference/concept-map.md',
]
const dockerOciContentFiles = dockerOciRouteManifest.map(
  (route) => `docs/docker-oci/${route}.md`,
)

const docsRoot = resolve(root, 'docs')
const coreConceptFiles = [
  'docs/kubernetes/concepts/resource-model.md',
  'docs/kubernetes/concepts/cluster-nodes.md',
  'docs/kubernetes/concepts/workloads.md',
  'docs/kubernetes/concepts/networking.md',
  'docs/kubernetes/concepts/config-storage.md',
  'docs/kubernetes/concepts/security.md',
  'docs/kubernetes/concepts/scheduling-resources.md',
]

const coreConceptContracts: Record<string, string[]> = {
  'docs/kubernetes/concepts/resource-model.md': [
    'apiVersion', 'kind', 'metadata', 'spec', 'status', 'UID', 'Namespace',
    'labels', 'selectors', 'annotations', 'OwnerReference', 'Finalizer',
    'deletionTimestamp', 'generation', 'observedGeneration', 'resourceVersion',
  ],
  'docs/kubernetes/concepts/cluster-nodes.md': [
    'API Server', 'etcd', 'Controller Manager', 'Scheduler', 'Node', 'kubelet',
    'kube-proxy', 'CRI', 'CNI', 'CSI', 'failure domain',
  ],
  'docs/kubernetes/concepts/workloads.md': [
    'Pod', 'ReplicaSet', 'Deployment', 'StatefulSet', 'DaemonSet', 'Job',
    'CronJob', 'kubelet', 'container runtime',
  ],
  'docs/kubernetes/concepts/networking.md': [
    'Pod IP', 'CNI', 'Service', 'EndpointSlice', 'CoreDNS', 'Ingress',
    'Gateway API', 'NetworkPolicy', 'selector', 'readiness',
  ],
  'docs/kubernetes/concepts/config-storage.md': [
    'ConfigMap', 'Secret', 'base64', 'Volume', 'PV', 'PVC', 'StorageClass',
    'access mode', 'reclaim policy', 'CSI', 'persistentVolumeClaim',
  ],
  'docs/kubernetes/concepts/security.md': [
    'Subject', 'ServiceAccount', 'Role', 'ClusterRole', 'RoleBinding',
    'ClusterRoleBinding', 'RBAC', 'SecurityContext', 'Pod Security Standards',
    'NetworkPolicy',
  ],
  'docs/kubernetes/concepts/scheduling-resources.md': [
    'requests', 'limits', 'QoS', 'filtering', 'scoring', 'nodeSelector',
    'affinity', 'anti-affinity', 'taints', 'tolerations', 'PriorityClass',
    'preemption', 'topology spread', 'PDB', 'voluntary',
  ],
}

function readRequiredContent(file: string): string | null {
  const absoluteFile = resolve(root, file)
  if (!existsSync(absoluteFile)) {
    expect(existsSync(absoluteFile), `${file} must exist`).toBe(true)
    return null
  }

  return readFileSync(absoluteFile, 'utf8')
}

interface MermaidEdge {
  from: string
  label: string
  to: string
}

function mermaidEdges(source: string): MermaidEdge[] {
  const edgePattern = /^\s*([A-Za-z][\w]*)(?:\[[^\]]*\])?\s+(?:-->|-\.->)\|([^|]+)\|\s+([A-Za-z][\w]*)/gm
  return Array.from(source.matchAll(edgePattern), (match) => ({
    from: match[1],
    label: match[2].trim(),
    to: match[3],
  }))
}

function levelTwoHeadings(source: string): string[] {
  const tokens = markdownParser.parse(source, {})
  return tokens.flatMap((token, index) =>
    token.type === 'heading_open' && token.tag === 'h2'
      ? [tokens[index + 1]?.content ?? '']
      : [],
  )
}

function markdownTables(source: string): string[][][] {
  const tables: string[][][] = []
  let table: string[][] | null = null
  let row: string[] | null = null
  let inCell = false

  for (const token of markdownParser.parse(source, {})) {
    if (token.type === 'table_open') table = []
    else if (token.type === 'tr_open') row = []
    else if (token.type === 'th_open' || token.type === 'td_open') inCell = true
    else if (token.type === 'inline' && inCell) row?.push(token.content)
    else if (token.type === 'th_close' || token.type === 'td_close') inCell = false
    else if (token.type === 'tr_close' && table !== null && row !== null) {
      table.push(row)
      row = null
    } else if (token.type === 'table_close' && table !== null) {
      tables.push(table)
      table = null
    }
  }

  return tables
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
      resolve(root, 'docs/kubernetes/concepts/cluster-nodes.md'),
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
      resolve(root, 'docs/kubernetes/concepts/resource-model.md'),
      'utf8',
    )
    const storage = readFileSync(
      resolve(root, 'docs/kubernetes/concepts/config-storage.md'),
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
      'KL -->|calls NodePublishVolume for Pod target 调用 NodePublishVolume 发布到 Pod 路径| CSI["CSI node plugin"]',
      'KL -->|may call NodeStageVolume when capability is advertised 驱动声明能力时可调用 NodeStageVolume| CSI',
      'CSI -->|may stage when STAGE_UNSTAGE_VOLUME is supported 支持该能力时可暂存| ST["kubelet-managed global staging path"]',
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
      resolve(root, 'docs/kubernetes/concepts/config-storage.md'),
      'utf8',
    )
    const networking = readFileSync(
      resolve(root, 'docs/kubernetes/concepts/networking.md'),
      'utf8',
    )
    const clusterNodes = readFileSync(
      resolve(root, 'docs/kubernetes/concepts/cluster-nodes.md'),
      'utf8',
    )
    const scheduling = readFileSync(
      resolve(root, 'docs/kubernetes/concepts/scheduling-resources.md'),
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
    expect(scheduling).toContain('if [ -n "$PENDING_POD" ]; then')
    expect(scheduling).toContain('kubectl -n demo describe pod "$PENDING_POD"')
    expect(scheduling).toContain('else')
    expect(scheduling).not.toContain('<pending-pod>')

    const pendingPodFence = markdownFences(
      scheduling,
      'docs/kubernetes/concepts/scheduling-resources.md',
    ).find(
      (fence) =>
        fence.language === 'bash' && fence.content.includes('PENDING_POD='),
    )
    expect(pendingPodFence).toBeDefined()
    const syntaxCheck = spawnSync('bash', ['-n'], {
      input: pendingPodFence?.content,
      encoding: 'utf8',
    })
    expect(syntaxCheck.stderr).toBe('')
    expect(syntaxCheck.status).toBe(0)
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
      '/kubernetes/concepts/resource-model',
      '/kubernetes/concepts/cluster-nodes',
      '/kubernetes/concepts/workloads',
      '/kubernetes/concepts/networking',
      '/kubernetes/concepts/config-storage',
      '/kubernetes/concepts/security',
      '/kubernetes/concepts/scheduling-resources',
    ])
  })

  it('teaches probe responsibilities and lifecycle termination boundaries', () => {
    const chapter = readRequiredContent('docs/kubernetes/operations/health-lifecycle.md')
    if (chapter === null) return

    for (const term of [
      'startupProbe',
      'readinessProbe',
      'livenessProbe',
      'postStart',
      'preStop',
      'SIGTERM',
      'terminationGracePeriodSeconds',
      'readinessGates',
      'Pod phase',
      'container state',
    ]) {
      expect(chapter, `health lifecycle chapter is missing ${term}`).toContain(term)
    }

    expect(chapter).toMatch(/\|\s*检查\s*\|[^\n]*(?:用途|职责)[^\n]*\|/)
    expect(chapter).toContain('readinessProbe 失败不会重启 container')
    expect(chapter).toContain('startupProbe 成功前')
    expect(chapter).toContain('preStop 与主进程收到 TERM 信号的先后')
    expect(chapter).toContain('postStart 与 container entrypoint 并发')
    expect(chapter).toContain('conditions.ready=null')
    expect(chapter).toContain('publishNotReadyAddresses')

    const yaml = markdownFences(
      chapter,
      'docs/kubernetes/operations/health-lifecycle.md',
    ).find((fence) => fence.language === 'yaml')?.content
    expect(yaml).toContain('startupProbe:')
    expect(yaml).toContain('readinessProbe:')
    expect(yaml).toContain('livenessProbe:')
    expect(yaml).toContain('lifecycle:')
    expect(yaml).toContain('terminationGracePeriodSeconds:')
  })

  it('treats endpoint withdrawal and node termination as concurrent processes', () => {
    const chapter = readRequiredContent('docs/kubernetes/operations/health-lifecycle.md')
    if (chapter === null) return

    for (const phrase of [
      '控制面 endpoint 更新与节点上的终止处理异步并发',
      '不保证 EndpointSlice propagation 先于 preStop 或 TERM',
      '`terminating=true`',
      '`ready=false`',
      '`serving=true`',
      'draining',
    ]) {
      expect(chapter, `health lifecycle chapter is missing ${phrase}`).toContain(phrase)
    }
  })

  it('uses a fixed public image with self-contained probe behavior', () => {
    const chapter = readRequiredContent('docs/kubernetes/operations/health-lifecycle.md')
    if (chapter === null) return

    const yaml = markdownFences(
      chapter,
      'docs/kubernetes/operations/health-lifecycle.md',
    ).find((fence) => fence.language === 'yaml')?.content ?? ''

    expect(yaml).toContain('image: busybox:1.36.1')
    expect(yaml).toContain('httpd -f -p 8080')
    expect(yaml.match(/path: \/healthz/g)).toHaveLength(3)
    expect(yaml).not.toContain('example/web')
  })

  it('prepares the demo Namespace before the standalone probe Deployment', () => {
    const chapter = readRequiredContent('docs/kubernetes/operations/health-lifecycle.md')
    if (chapter === null) return

    const namespaceCommand =
      'kubectl create namespace demo --dry-run=client -o yaml | kubectl apply -f -'
    const deploymentManifest = 'apiVersion: apps/v1\nkind: Deployment'

    expect(chapter).toContain(namespaceCommand)
    expect(chapter.indexOf(namespaceCommand)).toBeLessThan(
      chapter.indexOf(deploymentManifest),
    )
  })

  it('parses the probe manifest and locks each probe handler to the running container', () => {
    const chapter = readRequiredContent('docs/kubernetes/operations/health-lifecycle.md')
    if (chapter === null) return

    const yaml = markdownFences(
      chapter,
      'docs/kubernetes/operations/health-lifecycle.md',
    ).find((fence) => fence.language === 'yaml')?.content
    expect(yaml).toBeDefined()
    const documents = parseAllDocuments(yaml ?? '', {
      prettyErrors: true,
      uniqueKeys: true,
    })
    expect(documents).toHaveLength(1)
    expect(documents[0].errors).toEqual([])

    const manifest = documents[0].toJS() as {
      spec: { template: { spec: { containers: Array<Record<string, unknown>> } } }
    }
    const container = manifest.spec.template.spec.containers[0]
    expect(container.image).toBe('busybox:1.36.1')
    expect(container.command).toEqual([
      '/bin/sh',
      '-c',
      expect.stringContaining('httpd -f -p 8080'),
    ])
    for (const probeName of ['startupProbe', 'readinessProbe', 'livenessProbe']) {
      const probe = container[probeName] as { httpGet: { path: string; port: string } }
      expect(probe.httpGet).toEqual({ path: '/healthz', port: 'http' })
    }
    expect(container.lifecycle).toEqual({
      preStop: {
        exec: {
          command: ['/bin/sh', '-c', 'rm -f /www/healthz; sleep 5'],
        },
      },
    })
  })

  it('connects rollout and autoscaling controllers without overstating PDB', () => {
    const chapter = readRequiredContent('docs/kubernetes/operations/release-scaling.md')
    if (chapter === null) return

    for (const term of [
      'RollingUpdate',
      'maxUnavailable',
      'maxSurge',
      'rollout status',
      'rollout history',
      'rollout undo',
      'HorizontalPodAutoscaler',
      'VerticalPodAutoscaler',
      'Cluster Autoscaler',
      'PodDisruptionBudget',
      'scale subresource',
    ]) {
      expect(chapter, `release scaling chapter is missing ${term}`).toContain(term)
    }

    for (const relation of [
      'Metrics API',
      'HPA controller',
      'workload replicas',
      'workload controller',
      'Pod API objects',
    ]) {
      expect(chapter, `release scaling flow is missing ${relation}`).toContain(relation)
    }

    expect(chapter).toContain('CPU 或 memory utilization')
    expect(chapter).toContain('同一资源维度')
    expect(chapter).toContain('PDB 不会阻止')
    expect(chapter).toContain('PDB 不直接控制 Deployment rollout')
  })

  it('accounts for terminating Pods outside the rolling update replica budget', () => {
    const chapter = readRequiredContent('docs/kubernetes/operations/release-scaling.md')
    if (chapter === null) return

    expect(chapter).toContain('非 terminating Pods')
    expect(chapter).toContain('terminating Pods 不计入 available replicas')
    expect(chapter).toContain('实际 Pod 总数可能暂时超过')
    expect(chapter).not.toContain('过程中最多 5 个 Pod')
  })

  it('directs metrics through HPA and workload controllers before Pods', () => {
    const chapter = readRequiredContent('docs/kubernetes/operations/release-scaling.md')
    if (chapter === null) return

    const diagram = markdownFences(
      chapter,
      'docs/kubernetes/operations/release-scaling.md',
    ).find(
      (fence) =>
        fence.language === 'mermaid' && fence.content.includes('HPA controller'),
    )
    expect(diagram).toBeDefined()
    const edges = mermaidEdges(diagram?.content ?? '')
    const hasEdge = (from: string, to: string) =>
      edges.some((edge) => edge.from === from && edge.to === to)

    expect(hasEdge('MA', 'HC'), 'Metrics API must feed the HPA controller').toBe(true)
    expect(hasEdge('HC', 'WR'), 'HPA must write workload replicas').toBe(true)
    expect(hasEdge('WR', 'WC'), 'workload replicas must feed its controller').toBe(true)
    expect(hasEdge('WC', 'P'), 'workload controller must manage Pods').toBe(true)
    expect(hasEdge('HC', 'P'), 'HPA must not directly manage Pods').toBe(false)
  })

  it('provides the ordered observable troubleshooting path and copyable commands', () => {
    const chapter = readRequiredContent('docs/kubernetes/operations/troubleshooting.md')
    if (chapter === null) return

    const orderedStages = [
      '资源被 API 接受',
      'Pod 已创建',
      'Pod 已调度',
      '镜像与 container 已启动',
      'Pod 已就绪',
      'EndpointSlice 已填充',
      'Service 可达',
      '入口路由可达',
    ]
    expect(levelTwoHeadings(chapter).slice(0, orderedStages.length)).toEqual(
      orderedStages.map((stage, index) => `${index + 1}. ${stage}`),
    )

    for (const symptom of [
      'Pending',
      'ImagePullBackOff',
      'CrashLoopBackOff',
      'failed probe',
      'empty endpoints',
      'DNS',
      'NetworkPolicy',
    ]) {
      expect(chapter, `troubleshooting chapter is missing ${symptom}`).toContain(symptom)
    }

    const commands = markdownFences(
      chapter,
      'docs/kubernetes/operations/troubleshooting.md',
    ).filter((fence) => fence.language === 'bash')
    expect(commands.length).toBeGreaterThanOrEqual(8)
    expect(commands.map((fence) => fence.content).join('\n')).not.toMatch(/<[^\n>]+>/)
    for (const fence of commands) {
      const syntaxCheck = spawnSync('bash', ['-n'], {
        input: fence.content,
        encoding: 'utf8',
      })
      expect(syntaxCheck.stderr, fence.location).toBe('')
      expect(syntaxCheck.status, fence.location).toBe(0)
    }

    const commandSource = commands.map((fence) => fence.content).join('\n')
    expect(commandSource).not.toContain('.items[0]')
    expect(commandSource).not.toContain('2>/dev/null')
    expect(commandSource).not.toMatch(/--show-labels[^\n]*-o custom-columns/)
    expect(commandSource).not.toContain('ENDPOINT_PORTS=')
    expect(commandSource).not.toContain('for CANDIDATE_PORT in $ENDPOINT_PORTS')
    expect(commandSource).not.toContain('"http://$SERVICE:80/"')
    expect(commandSource).toContain('SERVICE_PORT_NAME=${SERVICE_PORT_NAME:-http}')
    expect(commandSource).toContain('SERVICE_PORT=')
    expect(commandSource).toContain('SLICE_REFS=')
    expect(commandSource).toContain('for SLICE_REF in $SLICE_REFS')
    expect(commandSource).toContain('SLICE_HTTP_PORT=')
    expect(commandSource).toContain('ENDPOINT_URL=')
    const directCheck = commands.find((fence) =>
      fence.content.includes('for SLICE_REF in $SLICE_REFS'),
    )?.content ?? ''
    const sliceLoop = directCheck.match(
      /for SLICE_REF in \$SLICE_REFS; do[\s\S]*?^  done\n/m,
    )?.[0]
    expect(sliceLoop, 'direct check must keep port and address in one slice loop').toContain(
      'SLICE_HTTP_PORT=',
    )
    expect(sliceLoop).toContain('ENDPOINT_URL=')
    expect(commandSource).toContain('direct endpoint')
    expect(commandSource).toContain('trap cleanup EXIT')

    for (const detail of [
      'deletionTimestamp',
      'conditions.terminating',
      'conditions.serving',
      'publishNotReadyAddresses',
    ]) {
      expect(chapter, `troubleshooting chapter is missing ${detail}`).toContain(detail)
    }
  })

  it('separates Ingress evidence from Gateway API route conditions', () => {
    const chapter = readRequiredContent('docs/kubernetes/operations/troubleshooting.md')
    if (chapter === null) return

    expect(chapter).toContain('Ingress 没有 Gateway API 的标准 Accepted/ResolvedRefs conditions')
    expect(chapter).toContain('HTTPRoute 的 Accepted 与 ResolvedRefs')
    expect(chapter).toContain('只验证 HTTP Host routing，不验证 TLS 或 SNI')
    expect(chapter).toContain('kubectl -n "$NS" describe ingress "$INGRESS"')
    expect(chapter).toContain('kubectl -n "$NS" get gateway,httproute -o yaml')
    expect(chapter).toContain('| Service 可达，入口为 Ingress | Ingress `status.loadBalancer`、events、controller logs |')
    expect(chapter).toContain('| Service 可达，入口为 Gateway API | Gateway/HTTPRoute conditions |')
    expect(chapter).not.toContain('Ingress/Gateway conditions 与 proxy logs')
  })

  it('maps object scope, ownership, references, lifetime, and primary commands', () => {
    const chapter = readRequiredContent('docs/kubernetes/reference/concept-map.md')
    if (chapter === null) return

    const relationshipTable = markdownTables(chapter).find((table) =>
      table[0]?.join('|') === '对象|作用域|谁创建或管理它|选择或引用什么|生命周期|主要命令',
    )
    expect(relationshipTable, 'concept map is missing its relationship table').toBeDefined()
    const rows = new Map(
      relationshipTable?.slice(1).map((row) => [row[0], row]) ?? [],
    )
    const contracts: Record<string, [string, string, string, string, string]> = {
      Deployment: ['Namespace', 'Deployment controller', 'selector', '级联', 'kubectl rollout'],
      Service: ['Namespace', 'Service controller', 'selector', '独立', 'kubectl get service'],
      EndpointSlice: ['Namespace', 'EndpointSlice controller', 'Service', '调谐', 'kubectl get endpointslice'],
      PersistentVolumeClaim: ['Namespace', 'storage controllers', 'StorageClass', 'reclaim policy', 'kubectl describe pvc'],
      ServiceAccount: ['Namespace', '用户', 'Pod spec', '独立身份', 'kubectl get serviceaccount'],
      HorizontalPodAutoscaler: ['Namespace', 'HPA controller', 'scaleTargetRef', '独立对象', 'kubectl describe hpa'],
      PodDisruptionBudget: ['Namespace', 'Eviction API', 'selector', '独立预算', 'kubectl describe pdb'],
    }

    for (const [objectName, expectedColumns] of Object.entries(contracts)) {
      const row = rows.get(objectName)
      expect(row, `relationship table is missing ${objectName}`).toBeDefined()
      expect(row).toHaveLength(6)
      expectedColumns.forEach((value, index) => {
        expect(row?.[index + 1], `${objectName} column ${index + 2}`).toContain(value)
      })
    }
  })

  it('routes Service metadata through actors before traffic data planes', () => {
    const chapter = readRequiredContent('docs/kubernetes/reference/concept-map.md')
    if (chapter === null) return

    const diagram = markdownFences(
      chapter,
      'docs/kubernetes/reference/concept-map.md',
    ).find((fence) => fence.language === 'mermaid')
    expect(diagram).toBeDefined()
    const edges = mermaidEdges(diagram?.content ?? '')
    const hasEdge = (from: string, to: string, label?: string) =>
      edges.some(
        (edge) =>
          edge.from === from &&
          edge.to === to &&
          (label === undefined || edge.label.includes(label)),
      )

    expect(hasEdge('S', 'SPA', 'is watched by')).toBe(true)
    expect(hasEdge('ES', 'SPA', 'is watched by')).toBe(true)
    expect(hasEdge('SPA', 'SD', 'configures')).toBe(true)
    expect(hasEdge('S', 'IC', 'is watched by')).toBe(true)
    expect(hasEdge('ES', 'IC', 'is watched by')).toBe(true)
    expect(hasEdge('IC', 'PX', 'configures')).toBe(true)
    expect(hasEdge('S', 'PX')).toBe(false)
    expect(hasEdge('ES', 'PX')).toBe(false)
    expect(hasEdge('RC', 'P', 'creates deletes or adopts')).toBe(true)
  })

  it('lists operations and reference chapters after core concepts', () => {
    const config = readFileSync(resolve(root, 'docs/.vitepress/config.mts'), 'utf8')
    const sidebar = config.slice(config.indexOf("'/kubernetes/': ["))
    const operations = sidebar.match(/text: '运行实践',[\s\S]*?items: \[([\s\S]*?)\n\s*\],/)
    const reference = sidebar.match(/text: '速查',[\s\S]*?items: \[([\s\S]*?)\n\s*\],/)

    expect(operations, 'sidebar is missing the operations group').not.toBeNull()
    expect(reference, 'sidebar is missing the reference group').not.toBeNull()
    expect(Array.from(operations?.[1].matchAll(/link: '([^']+)'/g) ?? [], (match) => match[1])).toEqual([
      '/kubernetes/operations/health-lifecycle',
      '/kubernetes/operations/release-scaling',
      '/kubernetes/operations/troubleshooting',
    ])
    expect(Array.from(reference?.[1].matchAll(/link: '([^']+)'/g) ?? [], (match) => match[1])).toEqual([
      '/kubernetes/reference/concept-map',
    ])
    expect(sidebar.indexOf("text: '运行实践'")).toBeGreaterThan(sidebar.indexOf("text: '核心概念'"))
    expect(sidebar.indexOf("text: '速查'")).toBeGreaterThan(sidebar.indexOf("text: '运行实践'"))
  })

  it('defines the fluid responsive theme contracts', () => {
    const styles = readFileSync(
      resolve(root, 'docs/.vitepress/theme/styles.css'),
      'utf8',
    )

    for (const contract of [
      '--cloud-native-accent',
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
    const home = readFileSync(resolve(root, 'docs/kubernetes/index.md'), 'utf8')

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
    const home = readFileSync(resolve(root, 'docs/kubernetes/index.md'), 'utf8')

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
      resolve(root, 'docs/kubernetes/guide/deployment-flow.md'),
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

    const home = readFileSync(resolve(root, 'docs/kubernetes/index.md'), 'utf8')
    expect(home).toContain(
      'RC -->|creates 创建| P["Pod API object"]',
    )
    expect(home).toContain('CR -->|creates 创建| C["Container"]')
    expect(home).not.toContain('Pod API object"] -->|creates')
    expect(home).not.toContain('ReplicaSet API object"] -->|creates')
    expect(home).not.toContain('容器由 Pod 的工作负载对象创建')
  })

  it('separates ingress resources from their managed traffic dataplane', () => {
    const home = readFileSync(resolve(root, 'docs/kubernetes/index.md'), 'utf8')
    const flow = readFileSync(
      resolve(root, 'docs/kubernetes/guide/deployment-flow.md'),
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
    const home = readFileSync(resolve(root, 'docs/kubernetes/index.md'), 'utf8')
    const flow = readFileSync(
      resolve(root, 'docs/kubernetes/guide/deployment-flow.md'),
      'utf8',
    )

    expect(home).toContain('kind: Namespace')
    expect(home).toContain('name: demo')
    expect(flow).toContain(
      'kubectl logs deployment/web --all-pods=true --all-containers=true --prefix=true',
    )
    expect(flow).toContain('该命令会读取 Deployment 选择的所有 Pod')
  })

  it('does not retain a dead-link allowlist after the planned pages land', () => {
    const config = readFileSync(resolve(root, 'docs/.vitepress/config.mts'), 'utf8')

    expect(config).not.toContain('plannedFutureRoutes')
    expect(config).not.toContain('ignoreDeadLinks')
  })

  it('distinguishes claim references from container volume mounts', () => {
    const home = readFileSync(resolve(root, 'docs/kubernetes/index.md'), 'utf8')

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
      resolve(root, 'docs/kubernetes/guide/deployment-flow.md'),
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
    const home = readFileSync(resolve(root, 'docs/kubernetes/index.md'), 'utf8')

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
    const home = readFileSync(resolve(root, 'docs/kubernetes/index.md'), 'utf8')

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
    for (const file of [...contentFiles, ...dockerOciContentFiles]) {
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
            candidates.some((candidate) => existsSync(candidate)),
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
    expect(resolveRootAbsoluteHref('/kubernetes/concepts/workloads')?.target).toBe(
      resolve(docsRoot, 'kubernetes/concepts/workloads'),
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
