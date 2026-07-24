export type DomainIcon =
  | 'activity'
  | 'boxes'
  | 'git-branch'
  | 'package'
  | 'shield'
  | 'terminal'

export type DomainTone =
  | 'amber'
  | 'blue'
  | 'coral'
  | 'green'
  | 'neutral'
  | 'rose'
  | 'violet'

export type TopicIcon =
  | 'terminal'
  | 'network'
  | 'hard-drive'
  | 'cloud'
  | 'container'
  | 'boxes'
  | 'package-search'
  | 'badge-check'
  | 'ship-wheel'
  | 'package-open'
  | 'layers'
  | 'route'
  | 'workflow'
  | 'git-pull-request-arrow'
  | 'git-merge'
  | 'activity'
  | 'chart-spline'
  | 'logs'
  | 'radio-tower'
  | 'users-round'
  | 'scroll-text'
  | 'key-round'
  | 'database-backup'
  | 'gauge'

export interface DeveloperPath {
  readonly title: string
  readonly steps: readonly string[]
  readonly tone: DomainTone
}

interface TechnologyTopicBase {
  readonly title: string
  readonly icon: TopicIcon
}

type AvailableTechnologyTopic = TechnologyTopicBase & {
  readonly status: 'available'
  readonly href: string
}

type PlannedTechnologyTopic = TechnologyTopicBase & {
  readonly status: 'planned'
  readonly href?: never
}

export type TechnologyTopic = AvailableTechnologyTopic | PlannedTechnologyTopic

export interface TechnologyDomain {
  readonly title: string
  readonly description: string
  readonly icon: DomainIcon
  readonly tone: DomainTone
  readonly topics: readonly TechnologyTopic[]
}

export const developerPaths: readonly DeveloperPath[] = [
  {
    title: '构建与发布应用',
    steps: ['Git', 'CI', 'OCI', 'Registry', 'Kubernetes', 'Helm', 'GitOps'],
    tone: 'green',
  },
  {
    title: '让请求到达应用',
    steps: ['DNS', 'TLS', 'Gateway', 'Service', 'Pod'],
    tone: 'blue',
  },
  {
    title: '配置与持久化',
    steps: ['Config', 'Secret', 'Volume', 'CSI', 'Backup'],
    tone: 'violet',
  },
  {
    title: '观察与定位故障',
    steps: ['Metrics', 'Logs', 'Traces', 'Alert', 'Linux'],
    tone: 'amber',
  },
  {
    title: '建立安全基线',
    steps: ['Identity', 'RBAC', 'Policy', 'Supply chain'],
    tone: 'rose',
  },
]

export const technologyDomains: readonly TechnologyDomain[] = [
  {
    title: '运行基础',
    description: '理解应用实际运行的环境',
    icon: 'terminal',
    tone: 'coral',
    topics: [
      { title: 'Linux', status: 'planned', icon: 'terminal' },
      { title: '网络与 DNS', status: 'planned', icon: 'network' },
      { title: '存储', status: 'planned', icon: 'hard-drive' },
      { title: '云平台基础', status: 'planned', icon: 'cloud' },
    ],
  },
  {
    title: '容器与制品',
    description: '构建可交付、可验证的制品',
    icon: 'package',
    tone: 'blue',
    topics: [
      { title: 'Docker / OCI', status: 'planned', icon: 'container' },
      { title: 'Containerd', status: 'planned', icon: 'boxes' },
      { title: 'Registry / Harbor', status: 'planned', icon: 'package-search' },
      { title: 'SBOM 与签名', status: 'planned', icon: 'badge-check' },
    ],
  },
  {
    title: '平台与编排',
    description: '声明和运行生产工作负载',
    icon: 'boxes',
    tone: 'violet',
    topics: [
      {
        title: 'Kubernetes',
        status: 'available',
        href: '/kubernetes/',
        icon: 'ship-wheel',
      },
      { title: 'Helm', status: 'planned', icon: 'package-open' },
      { title: 'Kustomize', status: 'planned', icon: 'layers' },
      { title: 'Gateway API', status: 'planned', icon: 'route' },
    ],
  },
  {
    title: '持续交付',
    description: '把变更可靠地送入环境',
    icon: 'git-branch',
    tone: 'green',
    topics: [
      { title: 'CI/CD', status: 'planned', icon: 'workflow' },
      { title: 'GitHub Actions', status: 'planned', icon: 'git-pull-request-arrow' },
      { title: 'Argo CD / GitOps', status: 'planned', icon: 'git-merge' },
    ],
  },
  {
    title: '可观测性',
    description: '解释系统正在发生什么',
    icon: 'activity',
    tone: 'amber',
    topics: [
      { title: 'Prometheus', status: 'planned', icon: 'activity' },
      { title: 'Grafana', status: 'planned', icon: 'chart-spline' },
      { title: 'Loki / Logging', status: 'planned', icon: 'logs' },
      { title: 'OpenTelemetry', status: 'planned', icon: 'radio-tower' },
    ],
  },
  {
    title: '安全与韧性',
    description: '降低运行风险并保证可恢复',
    icon: 'shield',
    tone: 'rose',
    topics: [
      { title: 'Identity / RBAC', status: 'planned', icon: 'users-round' },
      { title: 'Policy', status: 'planned', icon: 'scroll-text' },
      { title: 'Secret 管理', status: 'planned', icon: 'key-round' },
      { title: '备份与灾备', status: 'planned', icon: 'database-backup' },
      { title: '成本与弹性', status: 'planned', icon: 'gauge' },
    ],
  },
]
