import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseAllDocuments } from 'yaml'

import { markdownFences } from './support/markdown'

interface PageContract {
  fences: string[]
  phrases: string[]
  terms: string[]
}

interface OciDescriptor {
  annotations?: Record<string, string>
  digest: string
  mediaType: string
  platform?: {
    architecture: string
    os: string
  }
  size: number
}

interface SyntheticOciLayout {
  binaryLayer: string
  config: string
  index: string
  ociLayout: string
}

interface KubernetesWorkflowResult {
  calls: string[]
  curlCalls: string[]
  remainingRunDirectories: string[]
  status: number | null
  stderr: string
  stdout: string
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
  'docs/docker-oci/guide/container-to-kubernetes.md': {
    fences: ['yaml', 'dockerfile', 'mermaid', 'bash'],
    phrases: [
      'PodSpec 的 command 覆盖镜像 Entrypoint',
      'PodSpec 的 args 覆盖镜像 Cmd',
      'EXPOSE 不会自动创建 Service 或 containerPort',
      'Dockerfile HEALTHCHECK 不会自动转换为 Kubernetes probe',
      'Dockerfile VOLUME 不会自动创建 Kubernetes Volume',
    ],
    terms: [
      'image config',
      'Entrypoint',
      'Cmd',
      'PodSpec',
      'command',
      'args',
      'CRI',
      'kubelet',
      'containerd',
      'securityContext',
    ],
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
  'docs/docker-oci/build/dockerfile.md': {
    fences: ['dockerfile', 'bash'],
    phrases: [
      '构建只能读取 build context 中的文件',
      'exec form 不经过 shell 展开参数',
      'ENTRYPOINT 定义可执行入口，CMD 提供默认参数',
      '秘密不能通过 ARG、ENV 或 COPY 固化进镜像',
    ],
    terms: [
      'FROM',
      'WORKDIR',
      'COPY',
      'RUN',
      'USER',
      'ARG',
      'ENV',
      'ENTRYPOINT',
      'CMD',
      'multi-stage',
    ],
  },
  'docs/docker-oci/build/buildkit-cache.md': {
    fences: ['dockerfile', 'bash', 'mermaid'],
    phrases: [
      '缓存键不仅由 Dockerfile 指令文本决定',
      'secret mount 的内容不会进入镜像层',
      'cache mount 的目录内容不会成为当前层的文件系统输出',
      '`--no-cache` 不等于重新拉取基础镜像',
    ],
    terms: [
      'cache key',
      'bind mount',
      'cache mount',
      'secret mount',
      '--no-cache',
      '--pull',
      'cache-to',
      'cache-from',
    ],
  },
  'docs/docker-oci/build/multi-platform-builds.md': {
    fences: ['dockerfile', 'bash', 'mermaid'],
    phrases: [
      '一个多平台 tag 通常指向 OCI index',
      'QEMU 模拟、原生多节点和交叉编译是三种不同策略',
      '`--load` 通常只能把单平台结果载入本地 image store',
      '目标平台必须与最终二进制和基础镜像同时匹配',
    ],
    terms: [
      'BUILDPLATFORM',
      'TARGETPLATFORM',
      '--platform',
      'QEMU',
      'cross-compilation',
      'OCI index',
      '--push',
    ],
  },
  'docs/docker-oci/runtime/process-lifecycle.md': {
    fences: ['mermaid', 'bash'],
    phrases: [
      '容器的主进程退出，容器就进入 stopped 状态',
      'shell form 可能让 shell 成为 PID 1',
      'docker stop 先发送停止信号，超时后再强制终止',
      'HEALTHCHECK 结果不会阻止主进程退出，也不会自动修复应用',
    ],
    terms: ['PID 1', 'SIGTERM', 'SIGKILL', 'STOPSIGNAL', 'exit code', 'HEALTHCHECK', 'restart policy', 'memory'],
  },
  'docs/docker-oci/runtime/networking.md': {
    fences: ['mermaid', 'bash'],
    phrases: [
      '发布端口是在主机地址和容器端口之间建立转发',
      'EXPOSE 不会发布主机端口',
      '同一 user-defined bridge 中的容器可以按名称解析',
      '容器中的 127.0.0.1 指向容器自己的网络命名空间',
    ],
    terms: ['bridge', 'user-defined bridge', 'port publishing', '127.0.0.1:8080:3000', 'DNS', 'host', 'none'],
  },
  'docs/docker-oci/runtime/storage.md': {
    fences: ['mermaid', 'bash'],
    phrases: [
      '容器可写层随容器删除',
      'named volume 的生命周期独立于单个容器',
      'bind mount 直接暴露主机路径',
      'tmpfs 数据只保存在主机内存中',
    ],
    terms: ['writable layer', 'named volume', 'bind mount', 'tmpfs', 'UID', 'GID', 'copy-up', 'volume-nocopy'],
  },
  'docs/docker-oci/runtime/compose.md': {
    fences: ['yaml', 'bash', 'mermaid'],
    phrases: [
      'Compose service 是容器配置模板，不是正在运行的容器',
      'depends_on 的启动顺序不等于应用已经可用',
      'service_healthy 依赖被依赖服务的 healthcheck',
      'docker compose down --volumes 会额外删除声明的命名 Volume',
    ],
    terms: ['project', 'services', 'default network', 'healthcheck', 'depends_on', 'environment', 'volumes', 'docker compose config'],
  },
  'docs/docker-oci/oci/specifications.md': {
    fences: ['mermaid', 'json', 'bash'],
    phrases: [
      'Image Specification 定义镜像内容对象和 descriptor 关系',
      'Image Layout 定义这些内容如何放在本地目录中',
      'Distribution Specification 定义客户端如何通过 Registry API 传输内容',
      'Runtime Specification 定义 runtime 接收 bundle 后如何创建容器',
    ],
    terms: [
      'OCI Image Specification',
      'Image Layout',
      'Distribution Specification',
      'Runtime Specification',
      'descriptor',
      'content store',
      'bundle',
      'config.json',
    ],
  },
  'docs/docker-oci/operations/security.md': {
    fences: ['bash', 'dockerfile', 'mermaid'],
    phrases: [
      '能够访问 Docker daemon socket 的主体通常可以取得主机级高权限',
      '镜像中的 USER 与 rootless Docker 解决的是不同边界',
      '只读根文件系统仍需要显式提供可写目录',
      '构建 secret、运行时 secret 和镜像签名不是同一种控制',
    ],
    terms: ['Docker socket', 'rootless', 'USER', 'capabilities', 'seccomp', 'no-new-privileges', 'read-only', 'secret mount', 'digest'],
  },
  'docs/docker-oci/operations/troubleshooting.md': {
    fences: ['mermaid', 'bash'],
    phrases: [
      '先判断失败发生在 build、pull、create、start 还是运行阶段',
      '容器是 running 不代表应用已经 ready',
      '网络问题先区分监听地址、容器网络、端口发布和外部防火墙',
      '删除容器不能解决 Volume 中已有的数据或权限问题',
    ],
    terms: ['docker events', 'docker inspect', 'docker logs', 'docker top', 'docker stats', 'docker system df', 'OOMKilled', 'exit code'],
  },
  'docs/docker-oci/reference/command-map.md': {
    fences: ['bash'],
    phrases: [
      '| 目标 | 首要证据 | 命令 |',
      '命令速查不能替代对应概念页的边界说明',
      '清理命令执行前先检查目标和数据生命周期',
    ],
    terms: ['docker version', 'docker info', 'docker image inspect', 'docker container inspect', 'docker network inspect', 'docker volume inspect', 'docker buildx du', 'docker system df'],
  },
}

function readRequiredPage(file: string): string {
  const absoluteFile = resolve(root, file)
  expect(existsSync(absoluteFile), `${file} must exist`).toBe(true)
  return existsSync(absoluteFile) ? readFileSync(absoluteFile, 'utf8') : ''
}

function fenceContents(source: string, file: string, language: string): string[] {
  return markdownFences(source, file)
    .filter((fence) => fence.language === language)
    .map((fence) => fence.content)
}

function continuedLines(source: string): string[] {
  return source
    .replace(/\\\r?\n\s*/g, ' ')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

function shellCommands(source: string): string[] {
  return continuedLines(source)
}

function bashCommands(source: string, file: string): string[] {
  return fenceContents(source, file, 'bash').flatMap(shellCommands)
}

function normalizedShellCommands(commands: string[]): string[] {
  return commands.map((command) => command.replace(/\s+/g, ' ').trim())
}

function normalizedBashCommands(source: string, file: string): string[] {
  return normalizedShellCommands(bashCommands(source, file))
}

function yamlDocuments(source: string, file: string): unknown[] {
  const yaml = fenceContents(source, file, 'yaml').join('\n---\n')
  const documents = parseAllDocuments(yaml)
  for (const document of documents) {
    expect(document.errors, `${file} contains invalid YAML`).toEqual([])
  }
  return documents.map((document) => document.toJS())
}

function dockerfileInstructions(source: string): string[] {
  return continuedLines(source).filter((line) => !line.startsWith('#'))
}

function hasBindAndCacheMount(instruction: string): boolean {
  return /^RUN(?:\s|$)/.test(instruction)
    && instruction.includes('--mount=type=bind,')
    && instruction.includes('--mount=type=cache,')
}

function nodeHeredoc(source: string, file: string): string {
  const fence = fenceContents(source, file, 'bash')
    .find((content) => content.includes("node --input-type=module <<'NODE'"))
  expect(fence, `${file} must contain an executable Node heredoc`).toBeDefined()
  const match = fence?.match(/node --input-type=module <<'NODE'\n([\s\S]*?)\nNODE/)
  expect(match, `${file} has a malformed Node heredoc`).not.toBeNull()
  return match?.[1] ?? ''
}

function writeOciBlob(
  layout: string,
  mediaType: string,
  content: string | Buffer,
): OciDescriptor {
  const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content)
  const encoded = createHash('sha256').update(bytes).digest('hex')
  writeFileSync(resolve(layout, 'blobs', 'sha256', encoded), bytes)
  return {
    digest: `sha256:${encoded}`,
    mediaType,
    size: bytes.length,
  }
}

function createSyntheticOciLayout(layout: string): SyntheticOciLayout {
  mkdirSync(resolve(layout, 'blobs', 'sha256'), { recursive: true })
  const ociLayout = resolve(layout, 'oci-layout')
  writeFileSync(ociLayout, JSON.stringify({ imageLayoutVersion: '1.0.0' }))

  const binaryLayerBytes = Buffer.from([0x1f, 0x8b, 0x08, 0x00, 0xde, 0xad, 0xbe, 0xef])
  const binaryLayer = writeOciBlob(
    layout,
    'application/vnd.oci.image.layer.v1.tar+gzip',
    binaryLayerBytes,
  )

  let firstConfig = ''
  const runnableDescriptors = ['amd64', 'arm64'].map((architecture) => {
    const config = writeOciBlob(
      layout,
      'application/vnd.oci.image.config.v1+json',
      JSON.stringify({ architecture, os: 'linux', rootfs: { diff_ids: [], type: 'layers' } }),
    )
    if (!firstConfig) {
      firstConfig = resolve(layout, 'blobs', 'sha256', config.digest.slice('sha256:'.length))
    }
    const manifest = writeOciBlob(
      layout,
      'application/vnd.oci.image.manifest.v1+json',
      JSON.stringify({
        config,
        layers: [binaryLayer],
        mediaType: 'application/vnd.oci.image.manifest.v1+json',
        schemaVersion: 2,
      }),
    )
    return {
      ...manifest,
      platform: { architecture, os: 'linux' },
    }
  })

  const attestationConfig = writeOciBlob(
    layout,
    'application/vnd.oci.image.config.v1+json',
    JSON.stringify({ architecture: 'unknown', os: 'unknown' }),
  )
  const attestationLayer = writeOciBlob(
    layout,
    'application/vnd.in-toto+json',
    JSON.stringify({ predicateType: 'urn:example:test' }),
  )
  const attestationManifest = writeOciBlob(
    layout,
    'application/vnd.oci.image.manifest.v1+json',
    JSON.stringify({
      config: attestationConfig,
      layers: [attestationLayer],
      mediaType: 'application/vnd.oci.image.manifest.v1+json',
      schemaVersion: 2,
    }),
  )
  const attestationDescriptor: OciDescriptor = {
    ...attestationManifest,
    annotations: { 'vnd.docker.reference.type': 'attestation-manifest' },
    platform: { architecture: 'unknown', os: 'unknown' },
  }

  const index = resolve(layout, 'index.json')
  writeFileSync(index, JSON.stringify({
    manifests: [...runnableDescriptors, attestationDescriptor],
    mediaType: 'application/vnd.oci.image.index.v1+json',
    schemaVersion: 2,
  }))

  return {
    binaryLayer: resolve(layout, 'blobs', 'sha256', binaryLayer.digest.slice('sha256:'.length)),
    config: firstConfig,
    index,
    ociLayout,
  }
}

function wrapSyntheticLayoutInIndex(
  layout: string,
  fixture: SyntheticOciLayout,
  references = 1,
): void {
  const nestedIndex = writeOciBlob(
    layout,
    'application/vnd.oci.image.index.v1+json',
    readFileSync(fixture.index),
  )
  writeFileSync(fixture.index, JSON.stringify({
    manifests: Array.from({ length: references }, () => nestedIndex),
    mediaType: 'application/vnd.oci.image.index.v1+json',
    schemaVersion: 2,
  }))
}

function replaceFirstSyntheticConfig(
  layout: string,
  fixture: SyntheticOciLayout,
  mediaType: string,
  content: string | Buffer,
): string {
  const index = JSON.parse(readFileSync(fixture.index, 'utf8'))
  const descriptor = index.manifests.find(
    (candidate: OciDescriptor) =>
      candidate.mediaType === 'application/vnd.oci.image.manifest.v1+json',
  ) as OciDescriptor
  const [, manifestEncoded] = descriptor.digest.split(':', 2)
  const manifest = JSON.parse(
    readFileSync(resolve(layout, 'blobs', 'sha256', manifestEncoded), 'utf8'),
  )
  const config = writeOciBlob(layout, mediaType, content)
  manifest.config = config
  const replacement = writeOciBlob(
    layout,
    'application/vnd.oci.image.manifest.v1+json',
    JSON.stringify(manifest),
  )
  Object.assign(descriptor, replacement)
  writeFileSync(fixture.index, JSON.stringify(index))
  return resolve(layout, 'blobs', 'sha256', config.digest.slice('sha256:'.length))
}

function appendUnknownSyntheticDescriptor(
  layout: string,
  fixture: SyntheticOciLayout,
): string {
  const index = JSON.parse(readFileSync(fixture.index, 'utf8'))
  const descriptor = writeOciBlob(
    layout,
    'application/vnd.example.binary',
    Buffer.from([0x00, 0xff, 0x7f, 0x42]),
  )
  index.manifests.push(descriptor)
  writeFileSync(fixture.index, JSON.stringify(index))
  return resolve(layout, 'blobs', 'sha256', descriptor.digest.slice('sha256:'.length))
}

function replaceFirstSyntheticManifestMediaType(
  layout: string,
  fixture: SyntheticOciLayout,
  mediaType: string,
): void {
  const index = JSON.parse(readFileSync(fixture.index, 'utf8'))
  const descriptor = index.manifests.find(
    (candidate: OciDescriptor) =>
      candidate.mediaType === 'application/vnd.oci.image.manifest.v1+json',
  ) as OciDescriptor
  const [, manifestEncoded] = descriptor.digest.split(':', 2)
  const manifest = JSON.parse(
    readFileSync(resolve(layout, 'blobs', 'sha256', manifestEncoded), 'utf8'),
  )
  manifest.mediaType = mediaType
  const replacement = writeOciBlob(
    layout,
    'application/vnd.oci.image.manifest.v1+json',
    JSON.stringify(manifest),
  )
  Object.assign(descriptor, replacement)
  writeFileSync(fixture.index, JSON.stringify(index))
}

function kubernetesWorkflow(source: string, file: string): string {
  const workflow = fenceContents(source, file, 'bash')
    .find((content) => content.includes('kubectl apply'))
  expect(workflow, `${file} must contain an executable kubectl workflow`).toBeDefined()
  return workflow ?? ''
}

function writeExecutable(file: string, lines: string[]): void {
  writeFileSync(file, `${lines.join('\n')}\n`)
  chmodSync(file, 0o755)
}

function runKubernetesWorkflow(
  workflow: string,
  manifest: string,
  options: {
    createExit?: number
    deleteExit?: number
    portForwardExit?: number
  } = {},
): KubernetesWorkflowResult {
  const temporaryRoot = mkdtempSync(resolve(tmpdir(), 'docker-oci-kubectl-workflow-'))
  const bin = resolve(temporaryRoot, 'bin')
  const callsFile = resolve(temporaryRoot, 'kubectl-calls.txt')
  const curlCallsFile = resolve(temporaryRoot, 'curl-calls.txt')
  mkdirSync(bin)
  writeFileSync(resolve(temporaryRoot, 'demo-api-pod.template.yaml'), manifest)
  writeExecutable(resolve(bin, 'kubectl'), [
    '#!/usr/bin/env bash',
    'set -u',
    'printf \'%s\\n\' "$*" >> "$KUBECTL_CALLS"',
    'if [[ "${1:-}" == "create" && "${2:-}" == "namespace" ]]; then',
    '  exit "${STUB_CREATE_EXIT:-0}"',
    'fi',
    'if [[ " $* " == *" port-forward "* ]]; then',
    '  if [[ "${STUB_PORT_FORWARD_EXIT:-0}" -ne 0 ]]; then',
    '    echo "stub port-forward failure" >&2',
    '    exit "$STUB_PORT_FORWARD_EXIT"',
    '  fi',
    '  echo "Forwarding from 127.0.0.1:18080 -> 80"',
    '  trap \'exit 0\' TERM INT',
    '  while :; do sleep 1; done',
    'fi',
    'if [[ "${1:-}" == "delete" ]]; then',
    '  exit "${STUB_DELETE_EXIT:-0}"',
    'fi',
    'exit 0',
  ])
  writeExecutable(resolve(bin, 'curl'), [
    '#!/usr/bin/env bash',
    'set -u',
    'printf \'%s\\n\' "$*" >> "$CURL_CALLS"',
    'output=""',
    'while [[ "$#" -gt 0 ]]; do',
    '  if [[ "$1" == "--output" ]]; then',
    '    output="$2"',
    '    shift 2',
    '  else',
    '    shift',
    '  fi',
    'done',
    '[[ -n "$output" ]] && printf \'ok\\n\' > "$output"',
    'exit 0',
  ])

  try {
    const result = spawnSync('/bin/bash', [], {
      cwd: temporaryRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        CURL_CALLS: curlCallsFile,
        DEMO_API_IMAGE: `registry.example.com/team/demo-api@sha256:${'a'.repeat(64)}`,
        KUBECTL_CALLS: callsFile,
        PATH: `${bin}:${process.env.PATH ?? ''}`,
        STUB_CREATE_EXIT: String(options.createExit ?? 0),
        STUB_DELETE_EXIT: String(options.deleteExit ?? 0),
        STUB_PORT_FORWARD_EXIT: String(options.portForwardExit ?? 0),
        TMPDIR: temporaryRoot,
      },
      input: workflow,
      timeout: 15_000,
    })
    return {
      calls: existsSync(callsFile)
        ? readFileSync(callsFile, 'utf8').trim().split('\n').filter(Boolean)
        : [],
      curlCalls: existsSync(curlCallsFile)
        ? readFileSync(curlCallsFile, 'utf8').trim().split('\n').filter(Boolean)
        : [],
      remainingRunDirectories: readdirSync(temporaryRoot)
        .filter((entry) => entry.startsWith('demo-api-handoff.')),
      status: result.status,
      stderr: result.stderr,
      stdout: result.stdout,
    }
  } finally {
    rmSync(temporaryRoot, { force: true, recursive: true })
  }
}

function markdownTable(source: string, header: string): string[] {
  const lines = source.split('\n')
  const start = lines.indexOf(header)
  expect(start, `missing table header: ${header}`).toBeGreaterThanOrEqual(0)
  const table: string[] = []
  for (let index = start; index < lines.length && lines[index].startsWith('|'); index += 1) {
    table.push(lines[index])
  }
  return table
}

function expectStepsInOrder(source: string, steps: string[], context: string): void {
  let previousPosition = -1
  for (const step of steps) {
    const position = source.indexOf(step)
    expect(position, `${context} is missing or misorders: ${step}`).toBeGreaterThan(
      previousPosition,
    )
    previousPosition = position
  }
}

function expectExactStepsInOrder(lines: string[], steps: string[], context: string): void {
  let previousPosition = -1
  for (const step of steps) {
    const position = lines.indexOf(step, previousPosition + 1)
    expect(position, `${context} is missing or misorders: ${step}`).toBeGreaterThan(
      previousPosition,
    )
    previousPosition = position
  }
}

function mermaidEdgeInitiators(diagram: string): string[] {
  return diagram.split('\n').flatMap((line) => {
    const match = line.match(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*(?:-->>|->>|-->|-\.->|==>)/)
    return match ? [match[1]] : []
  })
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

  it('keeps the hardened runtime example observable and bounded', () => {
    const file = 'docs/docker-oci/operations/security.md'
    const source = readRequiredPage(file)
    const commands = normalizedBashCommands(source, file)

    expectExactStepsInOrder(commands, [
      'docker run --detach --name demo-api-secure --init --read-only --tmpfs /tmp:rw,noexec,nosuid,size=16m --cap-drop ALL --security-opt no-new-privileges=true --memory 128m --cpus 0.50 --publish 127.0.0.1:8080:3000 demo-api:dev',
      "docker container inspect demo-api-secure --format '{{json .HostConfig.ReadonlyRootfs}} {{json .HostConfig.CapDrop}} {{json .HostConfig.SecurityOpt}}'",
      'docker top demo-api-secure -eo pid,user,args',
      'curl --fail --silent --show-error http://127.0.0.1:8080/healthz',
      'docker rm --force demo-api-secure',
    ], 'security create, evidence, request, and cleanup')

    const diagram = fenceContents(source, file, 'mermaid')[0] ?? ''
    expect(diagram).toContain('U["authorized operator or CI runner"] -->')
    expect(diagram).toContain('A["authorization policy"] -->')
    expect(mermaidEdgeInitiators(diagram)).toEqual(['D', 'R', 'D'])
    expect(mermaidEdgeInitiators(diagram)).not.toContain('P')
    expect(mermaidEdgeInitiators(diagram)).not.toContain('H')
  })

  it('keeps troubleshooting evidence organized by failure phase', () => {
    const file = 'docs/docker-oci/operations/troubleshooting.md'
    const source = readRequiredPage(file)

    expectStepsInOrder(source, [
      '## Build 失败',
      '## Pull 与 Registry 失败',
      '## Create 与 start 失败',
      '## 立即退出与信号',
      '## running、health 与 ready',
      '## 网络分层',
      '## 存储与权限',
      '## 资源、OOM 与磁盘',
    ], 'troubleshooting phase evidence')
    for (const evidence of [
      'docker buildx build --progress=plain',
      'docker buildx imagetools inspect',
      'docker container inspect',
      'docker logs --timestamps',
      'docker exec demo-api wget',
      'docker network inspect',
      'docker volume inspect',
      'docker stats --no-stream',
      'docker system df --verbose',
    ]) {
      expect(source).toContain(evidence)
    }
    expect(source).toContain('live DB 的直接 tar 不是 application-consistent backup')
  })

  it('locks the destructive command map scope and recovery consequences', () => {
    const file = 'docs/docker-oci/reference/command-map.md'
    const source = readRequiredPage(file)
    const cleanupSection = source.slice(source.indexOf('## 清理与破坏性操作'))

    expect(markdownTable(cleanupSection, '| 命令 | 删除范围 | 恢复影响 |')).toEqual([
      '| 命令 | 删除范围 | 恢复影响 |',
      '| --- | --- | --- |',
      '| `docker container prune` | 所有 stopped containers | writable layer 与未另存的证据丢失 |',
      '| `docker image prune -a` | 所有未被容器引用的镜像 | 需要重新 pull/build，未推送内容可能丢失 |',
      '| `docker builder prune` | 可回收 build cache | 后续构建变慢；共享 builder 影响更大 |',
      '| `docker volume prune` | 未被容器引用的 local Volume | 持久数据通常不可恢复 |',
      '| `docker system prune` | 多类未使用对象 | 范围宽；默认不等同于清理所有 Volume |',
      '| `docker compose down --volumes` | 当前 Compose project 容器、网络、Compose 创建的命名 Volume 和附着的匿名 Volume；不删除 external Volume | 被删除的 project Volume 数据可能永久丢失 |',
    ])
    expect(normalizedBashCommands(source, file)).toEqual([
      'docker context show',
      'docker version',
      'docker system df --verbose',
    ])
  })

  it('keeps the image-to-Pod mapping table exact and complete', () => {
    const source = readRequiredPage('docs/docker-oci/guide/container-to-kubernetes.md')

    expect(markdownTable(
      source,
      '| Image/Docker source | Kubernetes field or behavior | Boundary |',
    )).toEqual([
      '| Image/Docker source | Kubernetes field or behavior | Boundary |',
      '| --- | --- | --- |',
      '| image reference | `containers[].image` | kubelet asks CRI runtime to resolve and pull |',
      '| image `Entrypoint` | `containers[].command` | Pod field overrides when present |',
      '| image `Cmd` | `containers[].args` | Pod field overrides when present |',
      '| image `Env` | `env` / `envFrom` | Pod values add or override runtime environment |',
      '| image `User` | `securityContext.runAsUser` | policy/runtime validation may override or reject |',
      '| `EXPOSE` | `containerPort` / Service | no automatic conversion |',
      '| `HEALTHCHECK` | startup/liveness/readiness probes | no automatic conversion |',
      '| `VOLUME` | Pod Volume and `volumeMounts` | no automatic storage provisioning |',
    ])
  })

  it('keeps all four Pod command and args combinations explicit', () => {
    const source = readRequiredPage('docs/docker-oci/guide/container-to-kubernetes.md')

    expect(markdownTable(
      source,
      '| PodSpec `command` | PodSpec `args` | final argv source |',
    )).toEqual([
      '| PodSpec `command` | PodSpec `args` | final argv source |',
      '| --- | --- | --- |',
      '| omitted | omitted | image Entrypoint + image Cmd |',
      '| omitted | present | image Entrypoint + PodSpec args |',
      '| present | omitted | PodSpec command only; image Cmd is dropped |',
      '| present | present | PodSpec command + PodSpec args |',
    ])
    expect(source).toContain('args-only retains image Entrypoint')
    expect(source).toContain('command-only drops image Cmd')
  })

  it('parses and locks the documented Pod and Service manifests', () => {
    const file = 'docs/docker-oci/guide/container-to-kubernetes.md'
    const source = readRequiredPage(file)
    const documents = yamlDocuments(source, file) as Array<Record<string, any>>
    const [pod, service] = documents

    expect(documents).toHaveLength(2)
    expect(pod).toMatchObject({
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: {
        labels: { app: 'demo-api' },
        name: 'demo-api',
      },
      spec: {
        containers: [{
          args: ['--mode=http'],
          command: ['node', 'server.mjs'],
          env: [{ name: 'PORT', value: '3000' }],
          image: 'demo-api:dev',
          livenessProbe: {
            httpGet: { path: '/healthz', port: 'http' },
          },
          ports: [{ containerPort: 3000, name: 'http' }],
          readinessProbe: {
            httpGet: { path: '/healthz', port: 'http' },
          },
          resources: {
            limits: { memory: '128Mi' },
            requests: { cpu: '50m', memory: '64Mi' },
          },
          securityContext: {
            allowPrivilegeEscalation: false,
            runAsNonRoot: true,
            runAsUser: 1000,
          },
          startupProbe: {
            httpGet: { path: '/healthz', port: 'http' },
          },
          volumeMounts: [{ mountPath: '/app/data', name: 'data' }],
        }],
        volumes: [{ emptyDir: {}, name: 'data' }],
      },
    })
    expect(service).toEqual({
      apiVersion: 'v1',
      kind: 'Service',
      metadata: { name: 'demo-api' },
      spec: {
        ports: [{ name: 'http', port: 80, targetPort: 'http' }],
        selector: { app: 'demo-api' },
      },
    })
  })

  it('keeps OCI and Kubernetes handoff diagrams actor-driven', () => {
    const specificationFile = 'docs/docker-oci/oci/specifications.md'
    const specificationSource = readRequiredPage(specificationFile)
    const specificationDiagram = fenceContents(
      specificationSource,
      specificationFile,
      'mermaid',
    ).join('\n')
    const handoffFile = 'docs/docker-oci/guide/container-to-kubernetes.md'
    const handoffSource = readRequiredPage(handoffFile)
    const handoffDiagram = fenceContents(handoffSource, handoffFile, 'mermaid').join('\n')

    expectStepsInOrder(specificationDiagram, [
      'B["BuildKit / image builder"] -->|writes descriptors and blobs| CS',
      'RC["Registry client"] -->|pushes and pulls through Distribution API| REG',
      'RC -->|verifies descriptor digest and size| RC',
      'RC -->|stores verified blobs by digest| CS',
      'PREP["container manager"] -->|verifies layout descriptor digest and size| PREP',
      'PREP -->|creates rootfs and runtime bundle| BUNDLE',
      'PREP -->|invokes runtime with bundle| RT',
      'RT -->|creates| PROC',
    ], 'OCI specification handoff')
    expect(new Set(mermaidEdgeInitiators(specificationDiagram))).not.toContain('CS')
    expect(new Set(mermaidEdgeInitiators(specificationDiagram))).not.toContain('BUNDLE')
    expect(specificationSource).toContain(
      'Registry client 或 Image Layout 消费者负责校验每个 descriptor 的 digest 和 size',
    )

    expectStepsInOrder(handoffDiagram, [
      'DEV["Developer / controller"] -->|submits Pod manifest| API',
      'API -->|stores desired state| POD',
      'API -->|makes desired Pod observable| KUBE',
      'KUBE -->|requests image and container lifecycle through CRI| CR',
      'CR -->|prepares rootfs and OCI bundle| BUNDLE',
      'CR -->|invokes runtime with bundle| RT',
      'RT -->|creates| PROC',
    ], 'Kubernetes to OCI handoff')
    expect(new Set(mermaidEdgeInitiators(handoffDiagram))).not.toContain('POD')
    expect(new Set(mermaidEdgeInitiators(handoffDiagram))).not.toContain('BUNDLE')
    expect(handoffSource).toContain('CRI 不是 OCI Runtime Specification 的别名')
    expect(handoffSource).toContain('OCI runtime 只消费准备好的 bundle，不负责 CRI 镜像拉取或 Pod sandbox')
  })

  it('keeps the bounded Kubernetes workflow and cleanup ordered', () => {
    const file = 'docs/docker-oci/guide/container-to-kubernetes.md'
    const source = readRequiredPage(file)
    const commands = normalizedBashCommands(source, file)

    expect(source).toContain('可用的测试集群')
    expect(source).toContain('确认 kubectl context')
    expect(source).toContain('kind load docker-image')
    expect(source).toContain('minikube image load')
    expect(source).toContain('不具备跨集群通用性')
    expect(source).toContain('本次唯一 namespace')
    expect(source).toContain('有权创建和删除 namespace')
    expect(source).not.toContain('当前目录没有 `demo-api-pod.yaml`')
    expect(source).toContain('Forwarding from 127.0.0.1:18080')
    expect(source.match(/kill -0 "\$demo_api_port_forward_pid"/g)).toHaveLength(2)
    expect(source.match(/if require_port_forward_alive; then/g)).toHaveLength(3)
    expectStepsInOrder(source, [
      'set -euo pipefail',
      'demo_api_namespace="demo-api-$(date +%s)-$$"',
      'demo_api_run_dir=$(mktemp -d "${TMPDIR:-/tmp}/demo-api-handoff.XXXXXX")',
      'trap cleanup EXIT',
      'kubectl config current-context',
      'kubectl cluster-info',
      'kubectl create namespace "$demo_api_namespace"',
      'kubectl apply -n "$demo_api_namespace" -f "$demo_api_manifest"',
      'kubectl wait -n "$demo_api_namespace" --for=condition=Ready pod/demo-api --timeout=120s',
      'kubectl port-forward -n "$demo_api_namespace" service/demo-api 18080:80',
      'grep -Fq \'Forwarding from 127.0.0.1:18080\' "$demo_api_port_forward_log"',
      'curl --fail --silent --show-error --output "$demo_api_healthz" http://127.0.0.1:18080/healthz',
      'test "$(cat "$demo_api_healthz")" = "ok"',
    ], 'Kubernetes apply, forwarding evidence, and request')
    for (const cleanupCommand of [
      'kill "$demo_api_port_forward_pid"',
      'wait "$demo_api_port_forward_pid"',
      'kubectl delete -n "$demo_api_namespace" --ignore-not-found -f "$demo_api_manifest" --wait=true --timeout=120s',
      'kubectl delete namespace "$demo_api_namespace" --wait=true --timeout=120s',
      'rm -r "$demo_api_run_dir"',
    ]) {
      expect(commands).toContain(cleanupCommand)
    }
    expect(source).toContain('原始失败码')
    expect(source).toContain('成功路径的 cleanup 失败仍保持非零退出')
  })

  it('executes the Kubernetes workflow with namespace ownership and cleanup', () => {
    const file = 'docs/docker-oci/guide/container-to-kubernetes.md'
    const source = readRequiredPage(file)
    const manifest = fenceContents(source, file, 'yaml').join('\n---\n')
    const result = runKubernetesWorkflow(kubernetesWorkflow(source, file), manifest)

    expect(result.status, result.stderr).toBe(0)
    expect(result.curlCalls).toHaveLength(1)
    expect(result.remainingRunDirectories).toEqual([])
    const create = result.calls.find((call) => call.startsWith('create namespace ')) ?? ''
    const namespace = create.slice('create namespace '.length)
    expect(namespace).toMatch(/^demo-api-[0-9]+-[0-9]+$/)
    expectStepsInOrder(result.calls.join('\n'), [
      `create namespace ${namespace}`,
      `apply -n ${namespace}`,
      `wait -n ${namespace} --for=condition=Ready pod/demo-api`,
      `get -n ${namespace} pod/demo-api -o wide`,
      `get -n ${namespace} service/demo-api`,
      `port-forward -n ${namespace} service/demo-api 18080:80`,
      `delete -n ${namespace}`,
      `delete namespace ${namespace} --wait=true --timeout=120s`,
    ], 'stubbed Kubernetes ownership lifecycle')
  })

  it('propagates an early port-forward exit even when curl would return ok', () => {
    const file = 'docs/docker-oci/guide/container-to-kubernetes.md'
    const source = readRequiredPage(file)
    const manifest = fenceContents(source, file, 'yaml').join('\n---\n')
    const result = runKubernetesWorkflow(
      kubernetesWorkflow(source, file),
      manifest,
      { portForwardExit: 42 },
    )

    expect(result.status).toBe(42)
    expect(result.stderr).toContain('stub port-forward failure')
    expect(result.curlCalls).toEqual([])
    expect(result.remainingRunDirectories).toEqual([])
  })

  it('fails immediately when its unique namespace cannot be created', () => {
    const file = 'docs/docker-oci/guide/container-to-kubernetes.md'
    const source = readRequiredPage(file)
    const manifest = fenceContents(source, file, 'yaml').join('\n---\n')
    const result = runKubernetesWorkflow(
      kubernetesWorkflow(source, file),
      manifest,
      { createExit: 43 },
    )

    expect(result.status).toBe(43)
    expect(result.calls.some((call) => call.startsWith('apply '))).toBe(false)
    expect(result.calls.some((call) => call.startsWith('delete '))).toBe(false)
    expect(result.remainingRunDirectories).toEqual([])
  })

  it('turns successful-workflow namespace cleanup failure into failure', () => {
    const file = 'docs/docker-oci/guide/container-to-kubernetes.md'
    const source = readRequiredPage(file)
    const manifest = fenceContents(source, file, 'yaml').join('\n---\n')
    const result = runKubernetesWorkflow(
      kubernetesWorkflow(source, file),
      manifest,
      { deleteExit: 44 },
    )

    expect(result.status).toBe(44)
    expect(result.calls.filter((call) => call.startsWith('delete '))).toHaveLength(2)
    expect(result.remainingRunDirectories).toEqual([])
  })

  it('preserves failed OCI evidence and cleans only after recursive verification', () => {
    const file = 'docs/docker-oci/oci/specifications.md'
    const source = readRequiredPage(file)
    const commands = normalizedBashCommands(source, file)

    expectExactStepsInOrder(commands, [
      'set -euo pipefail',
      'docker buildx build --platform linux/amd64 --tag demo-api:dev --output type=oci,dest=demo-api.oci.tar .',
      'mkdir demo-api-oci-layout',
      'tar -xf demo-api.oci.tar -C demo-api-oci-layout',
      'test -f demo-api-oci-layout/oci-layout',
      'test -f demo-api-oci-layout/index.json',
      "DEMO_API_OCI_DIR=demo-api-oci-layout node --input-type=module <<'NODE'",
      'NODE',
      'rm -r demo-api-oci-layout',
      'rm demo-api.oci.tar',
    ], 'OCI export, recursive verification, and success cleanup')
    expect(source).toContain('verifier 失败时整个流程保持非零退出')
    expect(source).toContain(
      '手动执行 `rm -r demo-api-oci-layout` 和 `rm demo-api.oci.tar`',
    )
  })

  it('models image retrieval and runtime preparation as actor-driven work', () => {
    const file = 'docs/docker-oci/concepts/image-model.md'
    const source = readRequiredPage(file)
    const diagram = markdownFences(source, file)
      .filter((fence) => fence.language === 'mermaid')
      .map((fence) => fence.content)
      .join('\n')

    expect(source).toContain('OCI runtime 不直接解析 Registry 引用，也不直接拉取或解包镜像 layer')
    expect(source).toContain('准备 snapshot/rootfs 和 runtime bundle 后，容器管理器才调用 OCI runtime')
    expect(diagram).toContain('CLIENT->>REG: request index or manifest')
    expect(diagram).toContain('REG-->>CLIENT: return index or manifest')
    expect(diagram).toContain('CLIENT->>REG: request config and layer blobs')
    expect(diagram).toContain('REG-->>CLIENT: return config and layer blobs')
    expect(diagram).toContain('CLIENT->>CLIENT: verify digest and size')
    expect(diagram).toContain('SNAP->>SNAP: unpack layers and prepare snapshot/rootfs')
    expect(diagram).toContain('CLIENT->>RT: invoke with runtime bundle')

    const selectedManifestFlow = [
      'CLIENT->>CLIENT: select platform manifest descriptor',
      'CLIENT->>REG: request selected manifest by descriptor digest',
      'REG-->>CLIENT: return selected manifest',
      'CLIENT->>CLIENT: verify selected manifest digest and size',
      'CLIENT->>REG: request config and layer blobs',
    ]
    let previousPosition = -1
    for (const step of selectedManifestFlow) {
      const position = diagram.indexOf(step)
      expect(position, `image retrieval is missing or misorders: ${step}`).toBeGreaterThan(
        previousPosition,
      )
      previousPosition = position
    }

    const passiveDataNodeIds = new Set(
      Array.from(diagram.matchAll(/([A-Za-z][A-Za-z0-9_]*)\["([^"]+)"\]/g))
        .filter((match) => /index|manifest|config|layer/i.test(match[2]))
        .map((match) => match[1]),
    )
    for (const id of passiveDataNodeIds) {
      const outgoingEdge = new RegExp(
        `^\\s*${id}(?:\\["[^"]+"\\])?\\s*(?:-->|-\\.->|==>|->>|-->>)`,
        'm',
      )
      expect(diagram, `${id} is passive and must not initiate Mermaid edges`).not.toMatch(
        outgoingEdge,
      )
    }
  })

  it('keeps image and container evidence commands executable and specific', () => {
    const imageModel = readRequiredPage('docs/docker-oci/concepts/image-model.md')
    const containerModel = readRequiredPage('docs/docker-oci/concepts/container-model.md')

    expect(imageModel).toContain(
      "docker image inspect alpine:3.22 --format 'platform={{.Os}}/{{.Architecture}} diffIDs={{json .RootFS.Layers}}'",
    )
    expect(imageModel).toContain(
      'docker buildx imagetools inspect --raw docker.io/library/alpine:3.22',
    )
    expect(containerModel).toContain('docker diff container-model-demo')
    expect(containerModel).toContain('docker stats --no-stream container-model-demo')
    expect(containerModel).toContain('docker image rm alpine:3.22')
  })

  it('distinguishes image history metadata from filesystem layers', () => {
    const imageModel = readRequiredPage('docs/docker-oci/concepts/image-model.md')

    expect(imageModel).toContain('empty_layer: true')
    expect(imageModel).toMatch(/history 条目数量可以多于 manifest 的 layer 数量/)
  })

  it('qualifies Docker API protection and layer digests by deployment details', () => {
    const architecture = readRequiredPage('docs/docker-oci/concepts/docker-architecture.md')
    const imageModel = readRequiredPage('docs/docker-oci/concepts/image-model.md')

    expect(architecture).toMatch(/Unix socket[^。]*文件系统权限/)
    expect(architecture).toMatch(/TCP[^。]*TLS 客户端证书/)
    expect(architecture).toMatch(/authorization[^。]*(?:另行配置|可选)/)
    expect(imageModel).toMatch(
      /未压缩 mediaType[^。]*descriptor[^。]*相同的算法[^。]*与 DiffID 相同/,
    )
  })

  it('keeps the ENTRYPOINT and CMD override matrix exact and complete', () => {
    const source = readRequiredPage('docs/docker-oci/build/dockerfile.md')

    expect(markdownTable(source, '| Image config | `docker run` input | Final behavior |')).toEqual([
      '| Image config | `docker run` input | Final behavior |',
      '| --- | --- | --- |',
      '| ENTRYPOINT only | arguments | arguments append to ENTRYPOINT |',
      '| CMD only | arguments | arguments replace CMD |',
      '| ENTRYPOINT + CMD | no arguments | ENTRYPOINT runs with CMD defaults |',
      '| ENTRYPOINT + CMD | arguments | ENTRYPOINT runs with replacement arguments |',
      '| either | `--entrypoint` | executable entry is replaced explicitly |',
    ])
  })

  it('keeps build mounts and remote cache options in coherent commands', () => {
    const file = 'docs/docker-oci/build/buildkit-cache.md'
    const source = readRequiredPage(file)
    const instructions = fenceContents(source, file, 'dockerfile')
      .flatMap(dockerfileInstructions)
    const commands = bashCommands(source, file)

    expect(
      instructions.some(hasBindAndCacheMount),
      'one RUN must combine the documented bind and cache mounts',
    ).toBe(true)
    expect(
      instructions.some((instruction) =>
        /^RUN --mount=type=secret,id=build_token,required=true/.test(instruction),
      ),
      'the secret example must use a required secret mount',
    ).toBe(true)

    const remoteCache = commands.find((command) =>
      command.startsWith('docker buildx build ')
      && command.includes('--cache-from type=registry')
      && command.includes('--cache-to type=registry')
      && command.includes('--push'),
    )
    expect(remoteCache).toBeDefined()
    expect(remoteCache).toMatch(
      /docker buildx build .*--platform linux\/amd64 .*--cache-from type=registry,[^ ]+ .*--cache-to type=registry,[^ ]+,mode=max .*--push \./,
    )
  })

  it('does not combine mounts from separate Dockerfile RUN instructions', () => {
    const instructions = dockerfileInstructions(
      [
        'RUN --mount=type=bind,source=server.mjs,target=/src/server.mjs,ro true',
        'RUN --mount=type=cache,target=/tmp/demo-api-checks true',
      ].join('\n'),
    )

    expect(instructions).toHaveLength(2)
    expect(instructions.some(hasBindAndCacheMount)).toBe(false)
  })

  it('separates single-platform load from two-platform push', () => {
    const file = 'docs/docker-oci/build/multi-platform-builds.md'
    const source = readRequiredPage(file)
    const commands = bashCommands(source, file)

    const localLoad = commands.find((command) =>
      command.startsWith('docker buildx build ')
      && command.includes('--load')
      && command.includes('--tag demo-api:dev'),
    )
    expect(localLoad).toMatch(
      /docker buildx build --platform "\$DEMO_API_PLATFORM" --load --tag demo-api:dev \./,
    )

    const multiPush = commands.find((command) =>
      command.startsWith('docker buildx build ')
      && command.includes('--platform linux/amd64,linux/arm64')
      && command.includes('--push'),
    )
    expect(multiPush).toMatch(
      /docker buildx build .*--platform linux\/amd64,linux\/arm64 .*--tag registry\.example\.com\/team\/demo-api:dev .*--push \./,
    )
    expect(multiPush).not.toContain('--load')
  })

  it('keeps build data passive and verifies returned content on the consuming side', () => {
    const cacheFile = 'docs/docker-oci/build/buildkit-cache.md'
    const cacheSource = readRequiredPage(cacheFile)
    const cacheDiagram = fenceContents(cacheSource, cacheFile, 'mermaid').join('\n')
    const platformFile = 'docs/docker-oci/build/multi-platform-builds.md'
    const platformSource = readRequiredPage(platformFile)
    const platformDiagram = fenceContents(platformSource, platformFile, 'mermaid').join('\n')

    expect(new Set(mermaidEdgeInitiators(cacheDiagram))).toEqual(
      new Set(['DEV', 'BK', 'CS']),
    )
    expect(cacheDiagram).not.toMatch(/CS-->>BK: return verified/i)
    expectStepsInOrder(cacheDiagram, [
      'CS-->>BK: return cached result candidate and metadata',
      'BK->>BK: verify candidate digest and size',
      'BK->>BK: confirm cache key and result are usable',
      'BK-->>DEV: report CACHED',
    ], 'cache hit validation')

    expect(new Set(mermaidEdgeInitiators(platformDiagram))).toEqual(
      new Set(['CLI', 'REG', 'CM']),
    )
    expect(platformDiagram).not.toMatch(/REG-->>CLI: return verified/i)
    expectStepsInOrder(platformDiagram, [
      'REG-->>CLI: return index or manifest candidate',
      'CLI->>CLI: verify returned digest and size',
      'CLI->>CLI: select runnable platform manifest descriptor',
      'REG-->>CLI: return selected manifest candidate',
      'CLI->>CLI: verify selected manifest descriptor digest and size',
      'REG-->>CLI: return config and layer blob candidates',
      'CLI->>CLI: verify config and layer descriptor digests and sizes',
      'CLI->>CM: provide verified selected image content',
    ], 'multi-platform retrieval validation')
  })

  it('qualifies platform fields, emulation setup, and OCI archive validation', () => {
    const file = 'docs/docker-oci/build/multi-platform-builds.md'
    const source = readRequiredPage(file)

    expect(source).toContain('BUILDPLATFORM 表示执行构建的 builder node 平台')
    expect(source).toContain('stage 的基础镜像与用户空间平台由 `FROM --platform` 决定')
    expect(source).toContain('descriptor 的 `platform` 是可选字段')
    expect(source).toContain('provenance/attestation 辅助 manifest')
    expect(source).toContain('Docker Desktop')
    expect(source).toContain('Docker Engine + buildx')
    expect(source).toContain('upstream BuildKit')
    expect(source).toContain('third-party BuildKit package')
    expect(source).toContain('host binfmt')
    expect(source).toContain('先用 `docker buildx inspect --bootstrap` 检查 builder capability')

  })

  it('keeps lifecycle signals, exit evidence, and restart behavior coherent', () => {
    const file = 'docs/docker-oci/runtime/process-lifecycle.md'
    const source = readRequiredPage(file)
    const diagram = fenceContents(source, file, 'mermaid').join('\n')
    const commands = normalizedBashCommands(source, file)

    expectStepsInOrder(diagram, [
      'DE->>RT: request configured stop signal',
      'RT->>APP: deliver configured stop signal',
      'APP-->>RT: exit with status',
      'RT-->>DE: report exit status',
    ], 'graceful stop actor path')
    expect(diagram).toContain('RT->>APP: deliver SIGKILL after timeout')
    expect(diagram).not.toMatch(/DE->>APP:|APP-->>DE:/)

    expect(source).toMatch(/Node\.js 24[^。]*没有安装 `SIGTERM` handler[^。]*143[^。]*128 \+ 15/)
    expect(source).toMatch(
      /只有应用主动处理 `SIGTERM`[^。]*停止接收新请求[^。]*`server\.close`[^。]*exit code 0/,
    )
    expect(source).toMatch(
      /人工执行 `docker stop`[^。]*忽略 restart policy[^。]*手工 `docker start`/,
    )
    expect(markdownTable(source, '| policy | Docker 行为边界 | 适用判断 |')).toEqual([
      '| policy | Docker 行为边界 | 适用判断 |',
      '| --- | --- | --- |',
      '| `no` | 默认，不自动重启 | 调试或由外部系统管理 |',
      '| `on-failure[:max-retries]` | 仅非零 exit code 时重启，可限制次数；不会因 daemon restart 恢复 | 可由退出码表达瞬时失败的任务 |',
      '| `always` | 退出后重启；人工 stop 后保持停止，直到手工 start 或 daemon restart 时恢复 | 需要持续运行且接受该语义 |',
      '| `unless-stopped` | 类似 `always`，但 daemon restart 后仍保持人工停止 | 希望人工停止跨 daemon restart 保留 |',
    ])
    expect(source).toMatch(/人工 stop[^。]*不会触发[^。]*非零失败重启/)

    expectExactStepsInOrder(commands, [
      "docker run --detach --name demo-api-lifecycle --init --stop-timeout 10 --restart on-failure:3 --memory 128m --cpus 0.50 --health-cmd 'wget -qO- http://127.0.0.1:3000/healthz >/dev/null' --health-interval 5s --health-timeout 2s --health-retries 3 --publish 127.0.0.1:8080:3000 demo-api:dev",
      "docker container inspect demo-api-lifecycle --format 'status={{.State.Status}} pid={{.State.Pid}} health={{.State.Health.Status}} memory={{.HostConfig.Memory}} nano-cpus={{.HostConfig.NanoCpus}}'",
      'docker logs demo-api-lifecycle',
      'curl --fail http://127.0.0.1:8080/healthz',
      'docker stop demo-api-lifecycle',
      "docker container inspect demo-api-lifecycle --format 'status={{.State.Status}} exit={{.State.ExitCode}} oom={{.State.OOMKilled}} error={{json .State.Error}}'",
      'docker rm demo-api-lifecycle',
      'docker container ls --all --filter name=^/demo-api-lifecycle$',
    ], 'lifecycle evidence and cleanup')
  })

  it('limits host-loopback checks to a local Docker context', () => {
    for (const file of [
      'docs/docker-oci/runtime/process-lifecycle.md',
      'docs/docker-oci/runtime/networking.md',
      'docs/docker-oci/runtime/compose.md',
    ]) {
      const source = readRequiredPage(file)
      const prerequisite = source.split('\n').find((line) => line.startsWith('前置条件：')) ?? ''
      expect(prerequisite, `${file} must require a local context`).toMatch(
        /local Docker Engine 或 Docker Desktop context/,
      )
      expect(prerequisite, `${file} must explain remote loopback`).toMatch(
        /remote context[^。]*(?:daemon 主机|可路由的 daemon host 地址)/,
      )
    }
  })

  it('keeps networking evidence and cleanup as complete commands', () => {
    const file = 'docs/docker-oci/runtime/networking.md'
    const source = readRequiredPage(file)
    const commands = normalizedBashCommands(source, file)

    expectExactStepsInOrder(commands, [
      'docker network create demo-api-net',
      'docker run --detach --name demo-api-net --network demo-api-net --publish 127.0.0.1:8080:3000 demo-api:dev',
      "docker run --detach --name demo-api-probe --network demo-api-net --entrypoint sh curlimages/curl:8.11.1 -c 'sleep 300'",
      "docker network inspect demo-api-net --format '{{json .Containers}}'",
      'docker port demo-api-net 3000',
      'curl --fail http://127.0.0.1:8080/healthz',
      'docker exec demo-api-probe curl --fail http://demo-api-net:3000/healthz',
      'docker exec demo-api-probe cat /etc/resolv.conf',
      'docker rm --force demo-api-probe demo-api-net',
      'docker network rm demo-api-net',
      'docker network ls --filter name=^demo-api-net$',
    ], 'network setup, evidence, and cleanup')
  })

  it('keeps storage backup and bind propagation boundaries explicit', () => {
    const file = 'docs/docker-oci/runtime/storage.md'
    const source = readRequiredPage(file)
    const commands = normalizedBashCommands(source, file)

    expect(source).toContain('bind propagation 默认为 `rprivate`')
    expect(source).toContain('传播选项只适用于 bind mount')
    expect(source).toContain(
      '`rshared` 递归地允许 original mount 与 replica 之间双向传播 submount',
    )
    expect(source).toContain(
      '`rslave` 递归地只允许从 original mount 向 replica 单向传播',
    )
    expect(source).toMatch(/Linux host[^。]*mount propagation/)
    expect(source).toMatch(/Docker Desktop[^。]*传播/)
    expect(source).toMatch(/不要[^。]*不必要[^。]*传播权限/)
    expect(source).toContain(
      '直接对 live DB 数据目录运行 tar 不是 application-consistent backup',
    )

    expectExactStepsInOrder(commands, [
      'mkdir demo-api-volume-backup',
      'docker volume create demo-api-data',
      'demo_api_uid=$(docker run --rm --entrypoint id demo-api:dev -u)',
      'demo_api_gid=$(docker run --rm --entrypoint id demo-api:dev -g)',
      'docker run --rm --user 0 --mount type=volume,src=demo-api-data,dst=/data --entrypoint sh demo-api:dev -c "chown $demo_api_uid:$demo_api_gid /data"',
      'docker run --detach --name demo-api-storage --mount type=volume,src=demo-api-data,dst=/app/data demo-api:dev',
      "docker exec demo-api-storage node -e \"require('node:fs').writeFileSync('/app/data/state.txt', 'demo-api:3000 /healthz\\\\n')\"",
      "docker container inspect demo-api-storage --format 'mounts={{json .Mounts}}'",
      "docker exec demo-api-storage sh -c 'id; ls -ln /app/data; cat /app/data/state.txt'",
      'docker stop demo-api-storage',
      'docker run --rm --mount type=volume,src=demo-api-data,dst=/source,readonly --mount "type=bind,src=$(pwd)/demo-api-volume-backup,dst=/backup" alpine:3.22 tar -C /source -cf /backup/api-data.tar .',
      'docker volume create demo-api-data-restored',
      'docker run --rm --mount type=volume,src=demo-api-data-restored,dst=/restore --mount "type=bind,src=$(pwd)/demo-api-volume-backup,dst=/backup,readonly" alpine:3.22 tar -C /restore -xf /backup/api-data.tar',
      'docker run --rm --mount type=volume,src=demo-api-data-restored,dst=/app/data,readonly --entrypoint node demo-api:dev -e "process.stdout.write(require(\'node:fs\').readFileSync(\'/app/data/state.txt\'))"',
      'docker rm demo-api-storage',
      'docker volume rm demo-api-data demo-api-data-restored',
      'rm demo-api-volume-backup/api-data.tar',
      'rmdir demo-api-volume-backup',
      'docker volume ls --filter name=demo-api-data',
    ], 'offline backup, restore, evidence, and cleanup')

    const stopPosition = commands.indexOf('docker stop demo-api-storage')
    const backupPositions = commands
      .map((command, index) => command.includes('tar -C /source -cf') ? index : -1)
      .filter((index) => index >= 0)
    expect(backupPositions).toHaveLength(1)
    expect(backupPositions[0], 'tar backup must occur after docker stop').toBeGreaterThan(
      stopPosition,
    )
  })

  it('rejects incomplete or split lifecycle run commands', () => {
    const expected = [
      'docker run --detach --name demo-api-lifecycle --init --stop-timeout 10 --restart on-failure:3 --memory 128m --cpus 0.50 demo-api:dev',
    ]

    expect(() => expectExactStepsInOrder(normalizedShellCommands([
      'docker run --detach --name demo-api-lifecycle --stop-timeout 10 --restart on-failure:3 --memory 128m --cpus 0.50 demo-api:dev',
    ]), expected, 'missing --init fixture')).toThrow()
    expect(() => expectExactStepsInOrder(normalizedShellCommands([
      'docker run --detach --name demo-api-lifecycle',
      '--init --stop-timeout 10 --restart on-failure:3 --memory 128m --cpus 0.50 demo-api:dev',
    ]), expected, 'split command fixture')).toThrow()
  })

  it('models Compose as two requests and separates environment precedence', () => {
    const file = 'docs/docker-oci/runtime/compose.md'
    const source = readRequiredPage(file)
    const diagram = fenceContents(source, file, 'mermaid').join('\n')
    const commands = normalizedBashCommands(source, file)

    expectStepsInOrder(diagram, [
      'DEV->>CLI: docker compose up --build --wait api',
      'DE->>API: start demo-api on port 3000',
      'CLI-->>DEV: return after api is healthy',
      'DEV->>CLI: docker compose run --rm probe',
      'DE->>PROBE: start one-off curl command',
      'PROBE->>API: GET http://api:3000/healthz',
      'PROBE-->>DE: exit after response',
      'DE-->>CLI: report probe exit',
      'CLI->>DE: remove one-off probe container',
      'CLI-->>DEV: return probe exit code',
    ], 'Compose up and run requests')

    expect(source).toContain(
      'https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/',
    )
    expect(source).toContain(
      'https://docs.docker.com/compose/how-tos/environment-variables/envvars-precedence/',
    )
    expectStepsInOrder(source, [
      '插值来源从高到低是：当前 shell environment',
      '显式 `--env-file` 指定的文件',
      '未指定 `--env-file` 时 project directory 的 `.env`',
      'project directory 由 `--project-directory`、第一个 `-f` 文件所在目录、当前工作目录依次确定',
    ], 'Compose interpolation precedence')
    expectStepsInOrder(source, [
      '`docker compose run -e`',
      '`environment` 或 `env_file` 中由 shell 或环境文件插值的值',
      'Compose 文件中 `environment` 的字面值',
      '`env_file` 的字面值',
      '镜像中的 `ENV`',
    ], 'container environment precedence')
    expectExactStepsInOrder(commands, [
      'docker compose config --environment',
      'docker compose config',
      'docker compose up --build --wait api',
      'docker compose run --rm probe',
      'docker compose ps --all',
      'docker compose logs api',
      'docker compose exec api wget -qO- http://127.0.0.1:3000/healthz',
      'curl --fail http://127.0.0.1:8080/healthz',
      'docker compose down',
      'docker volume ls --filter label=com.docker.compose.project=demo-api --filter label=com.docker.compose.volume=api-data',
      'docker compose down --volumes',
      'docker volume ls --filter label=com.docker.compose.project=demo-api --filter label=com.docker.compose.volume=api-data',
    ], 'Compose evidence and cleanup')
  })

  it('executes the OCI specification verifier recursively without a Docker daemon', () => {
    const file = 'docs/docker-oci/oci/specifications.md'
    const source = readRequiredPage(file)
    const script = nodeHeredoc(source, file)
    const temporaryRoot = mkdtempSync(resolve(tmpdir(), 'docker-oci-spec-layout-'))
    const layout = resolve(temporaryRoot, 'layout')

    try {
      const fixture = createSyntheticOciLayout(layout)
      wrapSyntheticLayoutInIndex(layout, fixture, 2)
      const result = spawnSync(process.execPath, ['--input-type=module'], {
        encoding: 'utf8',
        env: { ...process.env, DEMO_API_OCI_DIR: layout },
        input: script,
      })

      expect(result.status, result.stderr).toBe(0)
      expect(result.stdout).toContain(
        'verified unique OCI blobs: 9; manifests=3 configs=3 layers=2 skipped=0',
      )
      expect(result.stdout).toContain(
        'verified runnable platforms: linux/amd64, linux/arm64',
      )
    } finally {
      rmSync(temporaryRoot, { force: true, recursive: true })
    }
  })

  it('accepts a verified binary config without parsing it as JSON', () => {
    const file = 'docs/docker-oci/oci/specifications.md'
    const script = nodeHeredoc(readRequiredPage(file), file)
    const temporaryRoot = mkdtempSync(resolve(tmpdir(), 'docker-oci-binary-config-'))
    const layout = resolve(temporaryRoot, 'layout')

    try {
      const fixture = createSyntheticOciLayout(layout)
      replaceFirstSyntheticConfig(
        layout,
        fixture,
        'application/vnd.example.binary.config',
        Buffer.from([0x00, 0xff, 0x10, 0x80]),
      )
      const result = spawnSync(process.execPath, ['--input-type=module'], {
        encoding: 'utf8',
        env: { ...process.env, DEMO_API_OCI_DIR: layout },
        input: script,
      })

      expect(result.status, result.stderr).toBe(0)
      expect(result.stdout).toContain(
        'verified unique OCI blobs: 8; manifests=3 configs=3 layers=2 skipped=0',
      )
    } finally {
      rmSync(temporaryRoot, { force: true, recursive: true })
    }
  })

  it('verifies and skips an unknown index descriptor without parsing its bytes', () => {
    const file = 'docs/docker-oci/oci/specifications.md'
    const script = nodeHeredoc(readRequiredPage(file), file)
    const temporaryRoot = mkdtempSync(resolve(tmpdir(), 'docker-oci-unknown-descriptor-'))
    const layout = resolve(temporaryRoot, 'layout')

    try {
      const fixture = createSyntheticOciLayout(layout)
      appendUnknownSyntheticDescriptor(layout, fixture)
      const result = spawnSync(process.execPath, ['--input-type=module'], {
        encoding: 'utf8',
        env: { ...process.env, DEMO_API_OCI_DIR: layout },
        input: script,
      })

      expect(result.status, result.stderr).toBe(0)
      expect(result.stdout).toContain(
        'verified unique OCI blobs: 9; manifests=3 configs=3 layers=2 skipped=1',
      )
      expect(result.stdout).toContain(
        'skipped unsupported descriptor mediaTypes: application/vnd.example.binary',
      )
    } finally {
      rmSync(temporaryRoot, { force: true, recursive: true })
    }
  })

  it.each([
    {
      mutate: (fixture: SyntheticOciLayout) => {
        const index = JSON.parse(readFileSync(fixture.index, 'utf8'))
        delete index.manifests[0].mediaType
        writeFileSync(fixture.index, JSON.stringify(index))
      },
      name: 'a missing descriptor mediaType',
    },
    {
      mutate: (fixture: SyntheticOciLayout) => {
        const index = JSON.parse(readFileSync(fixture.index, 'utf8'))
        index.manifests[0].mediaType = 'not a media type'
        writeFileSync(fixture.index, JSON.stringify(index))
      },
      name: 'an invalid descriptor mediaType',
    },
  ])('rejects $name', ({ mutate }) => {
    const file = 'docs/docker-oci/oci/specifications.md'
    const script = nodeHeredoc(readRequiredPage(file), file)
    const temporaryRoot = mkdtempSync(resolve(tmpdir(), 'docker-oci-invalid-media-type-'))
    const layout = resolve(temporaryRoot, 'layout')

    try {
      const fixture = createSyntheticOciLayout(layout)
      mutate(fixture)
      const result = spawnSync(process.execPath, ['--input-type=module'], {
        encoding: 'utf8',
        env: { ...process.env, DEMO_API_OCI_DIR: layout },
        input: script,
      })

      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain('invalid descriptor mediaType')
    } finally {
      rmSync(temporaryRoot, { force: true, recursive: true })
    }
  })

  it.each([
    {
      mutate: (_layout: string, fixture: SyntheticOciLayout) => {
        const index = JSON.parse(readFileSync(fixture.index, 'utf8'))
        index.mediaType = 'application/vnd.oci.image.manifest.v1+json'
        writeFileSync(fixture.index, JSON.stringify(index))
      },
      name: 'index',
    },
    {
      mutate: (layout: string, fixture: SyntheticOciLayout) => {
        replaceFirstSyntheticManifestMediaType(
          layout,
          fixture,
          'application/vnd.oci.image.index.v1+json',
        )
      },
      name: 'manifest',
    },
  ])('rejects a mismatched embedded $name mediaType', ({ mutate }) => {
    const file = 'docs/docker-oci/oci/specifications.md'
    const script = nodeHeredoc(readRequiredPage(file), file)
    const temporaryRoot = mkdtempSync(resolve(tmpdir(), 'docker-oci-mismatched-media-type-'))
    const layout = resolve(temporaryRoot, 'layout')

    try {
      const fixture = createSyntheticOciLayout(layout)
      mutate(layout, fixture)
      const result = spawnSync(process.execPath, ['--input-type=module'], {
        encoding: 'utf8',
        env: { ...process.env, DEMO_API_OCI_DIR: layout },
        input: script,
      })

      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain('mismatched embedded mediaType')
    } finally {
      rmSync(temporaryRoot, { force: true, recursive: true })
    }
  })

  it('rejects corrupted bytes behind binary config and unknown descriptors', () => {
    const file = 'docs/docker-oci/oci/specifications.md'
    const script = nodeHeredoc(readRequiredPage(file), file)

    for (const fixtureType of ['binary config', 'unknown descriptor'] as const) {
      const temporaryRoot = mkdtempSync(resolve(tmpdir(), 'docker-oci-corrupt-unknown-'))
      const layout = resolve(temporaryRoot, 'layout')
      try {
        const fixture = createSyntheticOciLayout(layout)
        const blob = fixtureType === 'binary config'
          ? replaceFirstSyntheticConfig(
              layout,
              fixture,
              'application/vnd.example.binary.config',
              Buffer.from([0x00, 0xff, 0x10, 0x80]),
            )
          : appendUnknownSyntheticDescriptor(layout, fixture)
        const bytes = readFileSync(blob)
        bytes[0] ^= 0xff
        writeFileSync(blob, bytes)

        const result = spawnSync(process.execPath, ['--input-type=module'], {
          encoding: 'utf8',
          env: { ...process.env, DEMO_API_OCI_DIR: layout },
          input: script,
        })
        expect(result.status, fixtureType).not.toBe(0)
        expect(result.stderr, fixtureType).toContain('digest mismatch')
      } finally {
        rmSync(temporaryRoot, { force: true, recursive: true })
      }
    }
  })

  it('rejects OCI index nesting beyond the documented maximum depth', () => {
    const file = 'docs/docker-oci/oci/specifications.md'
    const script = nodeHeredoc(readRequiredPage(file), file)
    const temporaryRoot = mkdtempSync(resolve(tmpdir(), 'docker-oci-deep-index-'))
    const layout = resolve(temporaryRoot, 'layout')

    try {
      const fixture = createSyntheticOciLayout(layout)
      for (let depth = 0; depth < 34; depth += 1) {
        wrapSyntheticLayoutInIndex(layout, fixture)
      }
      const result = spawnSync(process.execPath, ['--input-type=module'], {
        encoding: 'utf8',
        env: { ...process.env, DEMO_API_OCI_DIR: layout },
        input: script,
      })

      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain('maximum OCI index depth exceeded')
    } finally {
      rmSync(temporaryRoot, { force: true, recursive: true })
    }
  })

  it.each([
    {
      expected: 'missing blob',
      mutate: (fixture: SyntheticOciLayout) => rmSync(fixture.config),
      name: 'a missing config blob',
    },
    {
      expected: 'digest mismatch',
      mutate: (fixture: SyntheticOciLayout) => {
        const bytes = readFileSync(fixture.config)
        bytes[0] ^= 0xff
        writeFileSync(fixture.config, bytes)
      },
      name: 'a corrupted config blob',
    },
    {
      expected: 'digest mismatch',
      mutate: (fixture: SyntheticOciLayout) => {
        const bytes = readFileSync(fixture.binaryLayer)
        bytes[0] ^= 0xff
        writeFileSync(fixture.binaryLayer, bytes)
      },
      name: 'a corrupted binary layer',
    },
    {
      expected: 'size mismatch',
      mutate: (fixture: SyntheticOciLayout) => {
        const index = JSON.parse(readFileSync(fixture.index, 'utf8'))
        index.manifests[0].size += 1
        writeFileSync(fixture.index, JSON.stringify(index))
      },
      name: 'an incorrect descriptor size',
    },
    {
      expected: 'size mismatch',
      mutate: (fixture: SyntheticOciLayout) => {
        const index = JSON.parse(readFileSync(fixture.index, 'utf8'))
        index.manifests.push({
          ...index.manifests[0],
          size: index.manifests[0].size + 1,
        })
        writeFileSync(fixture.index, JSON.stringify(index))
      },
      name: 'one digest reused with an inconsistent descriptor size',
    },
    {
      expected: 'digest mismatch',
      mutate: (fixture: SyntheticOciLayout) => {
        const index = JSON.parse(readFileSync(fixture.index, 'utf8'))
        const descriptor = index.manifests[0]
        const [, encoded] = descriptor.digest.split(':', 2)
        const layout = resolve(fixture.index, '..')
        const bytes = readFileSync(resolve(layout, 'blobs', 'sha256', encoded))
        const incorrectEncoded = '0'.repeat(64)
        writeFileSync(resolve(layout, 'blobs', 'sha256', incorrectEncoded), bytes)
        descriptor.digest = `sha256:${incorrectEncoded}`
        writeFileSync(fixture.index, JSON.stringify(index))
      },
      name: 'an incorrect descriptor digest',
    },
    {
      expected: 'unsupported imageLayoutVersion',
      mutate: (fixture: SyntheticOciLayout) => {
        writeFileSync(fixture.ociLayout, JSON.stringify({ imageLayoutVersion: '2.0.0' }))
      },
      name: 'an unsupported OCI layout version',
    },
  ])('rejects $name in the documented recursive verifier', ({ expected, mutate }) => {
    const file = 'docs/docker-oci/oci/specifications.md'
    const source = readRequiredPage(file)
    const script = nodeHeredoc(source, file)
    const temporaryRoot = mkdtempSync(resolve(tmpdir(), 'docker-oci-spec-invalid-'))
    const layout = resolve(temporaryRoot, 'layout')

    try {
      const fixture = createSyntheticOciLayout(layout)
      mutate(fixture)
      const result = spawnSync(process.execPath, ['--input-type=module'], {
        encoding: 'utf8',
        env: { ...process.env, DEMO_API_OCI_DIR: layout },
        input: script,
      })

      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain(expected)
    } finally {
      rmSync(temporaryRoot, { force: true, recursive: true })
    }
  })

  it('executes the documented OCI validator against binary layers and corrupt content', () => {
    const file = 'docs/docker-oci/build/multi-platform-builds.md'
    const source = readRequiredPage(file)
    const script = nodeHeredoc(source, file)
    const temporaryRoot = mkdtempSync(resolve(tmpdir(), 'docker-oci-layout-'))
    const layout = resolve(temporaryRoot, 'layout')

    try {
      const fixture = createSyntheticOciLayout(layout)
      const valid = spawnSync(process.execPath, ['--input-type=module'], {
        encoding: 'utf8',
        env: { ...process.env, DEMO_API_OCI_DIR: layout },
        input: script,
      })
      expect(valid.status, valid.stderr).toBe(0)
      expect(valid.stdout.trim()).toBe(
        'verified runnable platforms: linux/amd64, linux/arm64',
      )

      const corruptedLayer = readFileSync(fixture.binaryLayer)
      corruptedLayer[0] ^= 0xff
      writeFileSync(fixture.binaryLayer, corruptedLayer)

      const invalid = spawnSync(process.execPath, ['--input-type=module'], {
        encoding: 'utf8',
        env: { ...process.env, DEMO_API_OCI_DIR: layout },
        input: script,
      })
      expect(invalid.status).not.toBe(0)
      expect(invalid.stderr).toContain('digest mismatch')
    } finally {
      rmSync(temporaryRoot, { force: true, recursive: true })
    }
  })
})
