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
