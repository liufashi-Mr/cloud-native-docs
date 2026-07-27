import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

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

function createSyntheticOciLayout(layout: string): { binaryLayer: string } {
  mkdirSync(resolve(layout, 'blobs', 'sha256'), { recursive: true })
  writeFileSync(resolve(layout, 'oci-layout'), JSON.stringify({ imageLayoutVersion: '1.0.0' }))

  const binaryLayerBytes = Buffer.from([0x1f, 0x8b, 0x08, 0x00, 0xde, 0xad, 0xbe, 0xef])
  const binaryLayer = writeOciBlob(
    layout,
    'application/vnd.oci.image.layer.v1.tar+gzip',
    binaryLayerBytes,
  )

  const runnableDescriptors = ['amd64', 'arm64'].map((architecture) => {
    const config = writeOciBlob(
      layout,
      'application/vnd.oci.image.config.v1+json',
      JSON.stringify({ architecture, os: 'linux', rootfs: { diff_ids: [], type: 'layers' } }),
    )
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

  writeFileSync(resolve(layout, 'index.json'), JSON.stringify({
    manifests: [...runnableDescriptors, attestationDescriptor],
    mediaType: 'application/vnd.oci.image.index.v1+json',
    schemaVersion: 2,
  }))

  return {
    binaryLayer: resolve(layout, 'blobs', 'sha256', binaryLayer.digest.slice('sha256:'.length)),
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
    const commands = bashCommands(source, file).join('\n')

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

    expectStepsInOrder(commands, [
      'docker run --detach --name demo-api-lifecycle',
      'docker container inspect demo-api-lifecycle',
      'docker logs demo-api-lifecycle',
      'curl --fail http://127.0.0.1:8080/healthz',
      'docker stop demo-api-lifecycle',
      "--format 'status={{.State.Status}} exit={{.State.ExitCode}} oom={{.State.OOMKilled}} error={{json .State.Error}}'",
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

  it('keeps storage backup and bind propagation boundaries explicit', () => {
    const file = 'docs/docker-oci/runtime/storage.md'
    const source = readRequiredPage(file)
    const commands = bashCommands(source, file).join('\n')

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

    expectStepsInOrder(commands, [
      'docker container inspect demo-api-storage',
      'docker stop demo-api-storage',
      'alpine:3.22 tar -C /source -cf /backup/api-data.tar .',
      'docker volume create demo-api-data-restored',
      'alpine:3.22 tar -C /restore -xf /backup/api-data.tar',
      "readFileSync('/app/data/state.txt')",
      'docker rm demo-api-storage',
      'docker volume rm demo-api-data demo-api-data-restored',
      'rm demo-api-volume-backup/api-data.tar',
      'rmdir demo-api-volume-backup',
      'docker volume ls --filter name=demo-api-data',
    ], 'offline backup, restore, evidence, and cleanup')
  })

  it('models Compose as two requests and separates environment precedence', () => {
    const file = 'docs/docker-oci/runtime/compose.md'
    const source = readRequiredPage(file)
    const diagram = fenceContents(source, file, 'mermaid').join('\n')
    const commands = bashCommands(source, file)
      .map((command) => command.replace(/\s+/g, ' '))

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
