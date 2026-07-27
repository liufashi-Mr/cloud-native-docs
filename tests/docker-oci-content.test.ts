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
  'docs/docker-oci/index.md': {
    fences: ['mermaid', 'bash'],
    phrases: [
      'Docker CLI 向 Docker Engine 发出请求',
      'BuildKit 读取构建上下文并生成镜像内容',
      'containerd 管理容器生命周期并调用 OCI runtime',
      '镜像、manifest 和 container 都不会主动执行这些动作',
    ],
    terms: ['Docker Engine', 'BuildKit', 'containerd', 'runc', 'Registry', 'OCI', 'digest'],
  },
  'docs/docker-oci/guide/source-to-container.md': {
    fences: ['js', 'dockerfile', 'bash'],
    phrases: [
      "const port = Number(process.env.PORT ?? 3000)",
      "request.url === '/healthz'",
      'docker build --pull --tag demo-api:dev .',
      'docker run --detach --name demo-api --publish 127.0.0.1:8080:3000 demo-api:dev',
      'docker rm --force demo-api',
    ],
    terms: ['build context', '.dockerignore', 'image ID', 'container ID', 'localhost:8080'],
  },
  'docs/docker-oci/concepts/docker-architecture.md': {
    fences: ['mermaid', 'bash'],
    phrases: [
      'Docker CLI 是客户端，不直接创建 Linux 进程',
      'Docker Engine 把构建工作委托给 BuildKit',
      'Docker Engine 通过 containerd 管理容器生命周期',
      'runc 按 OCI Runtime Specification 创建容器进程后退出',
    ],
    terms: [
      'Docker context',
      'dockerd',
      'BuildKit',
      'containerd',
      'shim',
      'runc',
      'Distribution API',
    ],
  },
  'docs/docker-oci/concepts/image-model.md': {
    fences: ['mermaid', 'bash', 'json'],
    phrases: [
      'tag 是可变引用，digest 是内容寻址标识',
      'manifest 引用 config 和 layer descriptors',
      'OCI index 按 platform 引用一个或多个 manifest',
      '压缩 layer digest 与解压后的 DiffID 不是同一个值',
    ],
    terms: [
      'descriptor',
      'mediaType',
      'digest',
      'size',
      'manifest',
      'index',
      'config',
      'layer',
      'DiffID',
    ],
  },
  'docs/docker-oci/concepts/container-model.md': {
    fences: ['mermaid', 'bash'],
    phrases: [
      '容器首先是受隔离和约束的主机进程',
      '镜像层保持只读，容器增加自己的可写层',
      '删除容器会删除它的可写层，但不会自动删除命名 Volume',
      'namespace 改变进程能看到什么，cgroup 约束或统计资源',
    ],
    terms: [
      'namespaces',
      'cgroups',
      'mount namespace',
      'PID namespace',
      'writable layer',
      'copy-on-write',
    ],
  },
}

function readRequiredPage(file: string): string {
  const absoluteFile = resolve(root, file)
  expect(existsSync(absoluteFile), `${file} must exist`).toBe(true)
  return existsSync(absoluteFile) ? readFileSync(absoluteFile, 'utf8') : ''
}

describe('Docker / OCI content contracts', () => {
  it.each(Object.entries(pageContracts))('%s teaches its required model', (file, contract) => {
    const source = readRequiredPage(file)

    for (const term of contract.terms) {
      expect(source, `${file} is missing ${term}`).toContain(term)
    }
    for (const phrase of contract.phrases) {
      expect(source, `${file} is missing ${phrase}`).toContain(phrase)
    }

    const languages = markdownFences(source, file).map((fence) => fence.language)
    for (const language of contract.fences) {
      expect(languages, `${file} is missing a ${language} fence`).toContain(language)
    }
    expect(source).toMatch(/(?:误区|注意|不要|并不|不能|边界)/)
    expect(source).toMatch(/\]\(\/docker-oci\//)
  })
})
