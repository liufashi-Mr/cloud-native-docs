import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { markdownFences } from './support/markdown'

interface PageContract {
  fences: string[]
  phrases: string[]
  terms: string[]
}

const root = resolve(import.meta.dirname, '..')

const pageContracts: Record<string, PageContract> = {
  'docs/linux/index.md': {
    fences: ['mermaid', 'bash'],
    phrases: [
      'Shell 请求 kernel 创建进程',
      'systemd 创建服务进程并监督状态',
      'namespace 改变进程可见的资源视图',
      'cgroup 组织、统计并约束进程资源',
    ],
    terms: [
      'Ubuntu 24.04 LTS',
      'kernel',
      'systemd',
      '/proc',
      'journal',
      'namespace',
      'cgroup v2',
    ],
  },
  'docs/linux/guide/shell-practical-basics.md': {
    fences: ['bash'],
    phrases: [
      '引用决定字符何时保持原义、何时发生展开',
      'pipeline 的默认退出状态通常来自最后一个命令',
      'set -e 不能代替显式错误处理',
      'trap 只清理本脚本创建且已经验证身份的资源',
    ],
    terms: [
      'working directory',
      'PATH',
      'stdout',
      'stderr',
      '$?',
      'pipefail',
      'mktemp',
    ],
  },
  'docs/linux/guide/run-demo-api.md': {
    fences: ['js', 'bash'],
    phrases: [
      'const port = Number(process.env.PORT ?? 3000)',
      "request.url === '/healthz'",
      "server.listen(port, '127.0.0.1'",
      'kill -TERM "$demo_pid"',
    ],
    terms: [
      'Ubuntu 24.04 LTS',
      'SHA256',
      'demo-api',
      '127.0.0.1:3000',
      '/proc',
      'ss -ltnp',
    ],
  },
  'docs/linux/concepts/processes-and-procfs.md': {
    fences: ['mermaid', 'bash'],
    phrases: [
      '进程表是一个时间点的快照，不是完整执行历史',
      '/proc/<pid>/environ 使用 NUL 分隔环境项',
      '文件描述符是进程表项中的整数引用',
      'PID 可以复用，单独保存 PID 不能永久证明进程身份',
    ],
    terms: [
      'PID',
      'PPID',
      'thread',
      'process state',
      '/proc',
      'fd',
      'cmdline',
      'start time',
    ],
  },
  'docs/linux/concepts/users-groups-permissions.md': {
    fences: ['bash'],
    phrases: [
      'kernel 比较数值 UID 和 GID，不比较用户名字符串',
      '目录的 execute 位控制路径遍历',
      'umask 从请求的 mode 中移除权限',
      'capability 把传统 root 权限拆成独立能力',
    ],
    terms: [
      'UID',
      'GID',
      'supplementary groups',
      'umask',
      'ACL',
      'capabilities',
      'demo-api',
    ],
  },
  'docs/linux/concepts/filesystems-and-mounts.md': {
    fences: ['mermaid', 'bash'],
    phrases: [
      'pathname 经过逐级解析后定位文件对象',
      'hard link 引用同一个 inode',
      'mount 把一个文件系统附着到目录树中的挂载点',
      '剩余字节和剩余 inode 是两种不同容量',
    ],
    terms: [
      'pathname',
      'inode',
      'hard link',
      'symbolic link',
      'mount point',
      'findmnt',
      'df -i',
    ],
  },
  'docs/linux/concepts/signals-and-exit-status.md': {
    fences: ['mermaid', 'bash'],
    phrases: [
      'SIGKILL 不能被捕获、阻塞或忽略',
      '退出状态只保留有限范围的信息',
      '向单个 PID 发信号不等于处理整个进程组',
      'graceful shutdown 必须有可验证的等待上界',
    ],
    terms: [
      'SIGTERM',
      'SIGINT',
      'SIGKILL',
      'process group',
      'wait',
      'exit status',
      'trap',
    ],
  },
  'docs/linux/runtime/systemd-services.md': {
    fences: ['ini', 'bash', 'mermaid'],
    phrases: [
      'systemd 读取 unit 配置并创建服务进程',
      'daemon-reload 重新加载 unit 文件，不会自动重启服务',
      'Restart=on-failure 不会修复持续存在的配置错误',
      'drop-in override 比复制完整 vendor unit 更容易审计差异',
    ],
    terms: [
      'demo-api.service',
      'ExecStart',
      'User=demo-api',
      'WorkingDirectory=/opt/demo-api',
      'Restart=on-failure',
      'TimeoutStopSec',
    ],
  },
  'docs/linux/runtime/logs-and-journal.md': {
    fences: ['bash'],
    phrases: [
      'journal entry 把日志内容与 unit、PID、boot 和时间元数据关联',
      'stdout 和 stderr 不是日志级别',
      'journalctl --unit demo-api.service',
      '删除或 vacuum journal 会破坏仍可能需要的排障证据',
    ],
    terms: [
      'systemd-journald',
      '_SYSTEMD_UNIT',
      '_PID',
      '_BOOT_ID',
      'priority',
      'kernel log',
      'retention',
    ],
  },
  'docs/linux/concepts/namespaces.md': {
    fences: ['mermaid', 'bash'],
    phrases: [
      'namespace 改变一组进程看到的资源视图',
      'namespace 不是虚拟机，也不是完整安全边界',
      'user namespace 中的 UID 映射不改变所有外部对象的 ownership',
      'nsenter 会进入目标进程的 namespace，必须先验证目标身份',
    ],
    terms: [
      'mount',
      'PID',
      'network',
      'UTS',
      'IPC',
      'user',
      'cgroup',
      'time',
      '/proc/self/ns',
    ],
  },
  'docs/linux/concepts/cgroups-and-resources.md': {
    fences: ['mermaid', 'bash'],
    phrases: [
      'cgroup 组织进程并提供资源统计和控制接口',
      'cgroup namespace 不等于 cgroup resource limit',
      'memory.high 用于节流压力，memory.max 是硬上限',
      'systemd 是 Ubuntu 主机上 cgroup hierarchy 的主要管理者',
    ],
    terms: [
      'cgroup v2',
      'cgroup.controllers',
      'cpu.stat',
      'memory.current',
      'memory.events',
      'pids.current',
      'PSI',
    ],
  },
  'docs/linux/runtime/sockets-and-name-resolution.md': {
    fences: ['mermaid', 'bash'],
    phrases: [
      '监听 socket、连接、路由和名称解析是四个不同检查点',
      '127.0.0.1 只接受本机 loopback 路径上的连接',
      'getent ahosts 使用系统配置的 Name Service Switch 路径',
      'DNS 返回地址不证明目标端口正在监听',
    ],
    terms: [
      'ss -ltnp',
      'socket',
      'LISTEN',
      'ip route get',
      'getent ahosts',
      '/etc/resolv.conf',
      '127.0.0.1:3000',
    ],
  },
  'docs/linux/runtime/resource-pressure.md': {
    fences: ['bash', 'mermaid'],
    phrases: [
      '高利用率、资源压力和资源上限是不同证据',
      '不能通过填满宿主文件系统来演示磁盘故障',
      'memory.events 中的 oom_kill 计数比单次进程消失更接近限制证据',
      '剩余空间正常时仍可能耗尽 inode',
    ],
    terms: [
      'CPU',
      'memory',
      'I/O',
      'PID',
      'PSI',
      'memory.events',
      'df -h',
      'df -i',
    ],
  },
  'docs/linux/operations/security-boundaries.md': {
    fences: ['ini', 'bash', 'mermaid'],
    phrases: [
      '非 root 服务账户只缩小一个权限边界，不构成完整隔离',
      'NoNewPrivileges 阻止进程通过 execve 获得新的特权',
      'systemd sandboxing directive 必须根据应用实际文件和 socket 需求验证',
      'secret 不应出现在命令行参数、普通环境转储或日志中',
    ],
    terms: [
      'service account',
      'capabilities',
      'NoNewPrivileges',
      'ProtectSystem',
      'PrivateTmp',
      'LoadCredential',
      'AppArmor',
    ],
  },
  'docs/linux/operations/troubleshooting.md': {
    fences: ['bash', 'mermaid'],
    phrases: [
      '先记录症状发生的时间、主机、unit 和请求标识',
      '进程未创建与进程创建后立即退出需要不同证据',
      '权限拒绝必须同时检查进程身份、路径每一级权限和安全模块',
      '不要在保存证据前重启服务、清空日志或删除状态目录',
    ],
    terms: [
      'systemctl show',
      'journalctl',
      'namei -l',
      'ss -ltnp',
      'getent',
      'memory.events',
      'dmesg',
    ],
  },
  'docs/linux/reference/command-evidence-map.md': {
    fences: ['bash'],
    phrases: [
      '命令输出是某个时间点的证据，不是自动成立的根因',
      '先使用最小权限读取证据，再决定是否需要 sudo',
      '每条命令都链接回解释其模型的页面',
      '修改状态的命令不属于只读速查',
    ],
    terms: [
      'ps',
      '/proc',
      'id',
      'stat',
      'findmnt',
      'systemctl',
      'journalctl',
      'ss',
      'ip route get',
      'getent',
      'cgroup',
    ],
  },
}

function readRequiredPage(file: string): string {
  const absoluteFile = resolve(root, file)
  expect(existsSync(absoluteFile), `${file} must exist`).toBe(true)
  return existsSync(absoluteFile) ? readFileSync(absoluteFile, 'utf8') : ''
}

describe('Linux content contracts', () => {
  it.each(Object.entries(pageContracts))(
    '%s teaches its required model',
    (file, contract) => {
      const source = readRequiredPage(file)
      for (const term of contract.terms) {
        expect(source, `${file} missing ${term}`).toContain(term)
      }
      for (const phrase of contract.phrases) {
        expect(source, `${file} missing ${phrase}`).toContain(phrase)
      }
      const languages = markdownFences(source, file).map(
        (fence) => fence.language,
      )
      for (const language of contract.fences) {
        expect(languages).toContain(language)
      }
      expect(source).toMatch(/(?:边界|注意|不要|不能|并不|风险)/)
      expect(source).toMatch(
        /https:\/\/(?:docs\.kernel\.org|man7\.org|www\.freedesktop\.org|documentation\.ubuntu\.com)/,
      )
      expect(source).toMatch(/\]\(\/linux\//)
    },
  )
})
