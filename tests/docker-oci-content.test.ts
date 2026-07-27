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

function compactWhitespace(source: string): string {
  return source.replace(/\s+/g, ' ').trim()
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
    const dockerfiles = fenceContents(source, file, 'dockerfile').map(compactWhitespace)
    const commands = fenceContents(source, file, 'bash').map(compactWhitespace)

    expect(
      dockerfiles.some((fence) =>
        /RUN --mount=type=bind,[^\n]* --mount=type=cache,/.test(fence),
      ),
      'one RUN must combine the documented bind and cache mounts',
    ).toBe(true)
    expect(
      dockerfiles.some((fence) =>
        /RUN --mount=type=secret,id=build_token,required=true/.test(fence),
      ),
      'the secret example must use a required secret mount',
    ).toBe(true)

    const remoteCache = commands.find((command) =>
      command.includes('--cache-from type=registry'),
    )
    expect(remoteCache).toBeDefined()
    expect(remoteCache).toMatch(
      /docker buildx build .*--platform linux\/amd64 .*--cache-from type=registry,[^ ]+ .*--cache-to type=registry,[^ ]+,mode=max .*--push \./,
    )
  })

  it('separates single-platform load from two-platform push', () => {
    const file = 'docs/docker-oci/build/multi-platform-builds.md'
    const source = readRequiredPage(file)
    const commands = fenceContents(source, file, 'bash').map(compactWhitespace)

    const localLoad = commands.find((command) => command.includes('--load --tag demo-api:dev'))
    expect(localLoad).toMatch(
      /docker buildx build --platform "\$DEMO_API_PLATFORM" --load --tag demo-api:dev \./,
    )

    const multiPush = commands.find((command) =>
      command.includes('--platform linux/amd64,linux/arm64'),
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
    const commands = fenceContents(source, file, 'bash').map(compactWhitespace)

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

    const archiveInspection = commands.find((command) =>
      command.includes('node --input-type=module'),
    )
    expect(archiveInspection).toBeDefined()
    expect(archiveInspection).toContain('createHash')
    expect(archiveInspection).toContain('descriptor.size')
    expect(archiveInspection).toContain('verifyDescriptor')
    expect(archiveInspection).toContain('walkIndex')
    expect(archiveInspection).toContain('platform?.os')
    expect(archiveInspection).toContain('platform?.architecture')
    expect(archiveInspection).toContain('linux/amd64')
    expect(archiveInspection).toContain('linux/arm64')
  })
})
