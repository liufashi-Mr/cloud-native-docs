import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { markdownFences } from './support/markdown'

const root = resolve(import.meta.dirname, '..')
const linuxPages = [
  'docs/linux/index.md',
  'docs/linux/guide/shell-practical-basics.md',
  'docs/linux/guide/run-demo-api.md',
  'docs/linux/concepts/processes-and-procfs.md',
  'docs/linux/concepts/users-groups-permissions.md',
  'docs/linux/concepts/filesystems-and-mounts.md',
  'docs/linux/concepts/signals-and-exit-status.md',
  'docs/linux/runtime/systemd-services.md',
  'docs/linux/runtime/logs-and-journal.md',
  'docs/linux/concepts/namespaces.md',
  'docs/linux/concepts/cgroups-and-resources.md',
  'docs/linux/runtime/sockets-and-name-resolution.md',
  'docs/linux/runtime/resource-pressure.md',
]

describe('Linux runnable examples', () => {
  it.each(linuxPages)('keeps Bash fences syntactically valid in %s', (file) => {
    const source = readFileSync(resolve(root, file), 'utf8')
    for (const fence of markdownFences(source, file).filter(
      ({ language }) => language === 'bash',
    )) {
      const result = spawnSync('bash', ['-n'], {
        encoding: 'utf8',
        input: fence.content,
      })
      expect(result.status, `${fence.location}: ${result.stderr}`).toBe(0)
    }
  })

  it('keeps the host demo identity aligned with Docker / OCI', () => {
    const source = readFileSync(
      resolve(root, 'docs/linux/guide/run-demo-api.md'),
      'utf8',
    )
    expect(source).toContain('demo-api')
    expect(source).toContain('3000')
    expect(source).toContain('/healthz')
    expect(source).toContain("request.url === '/healthz'")
  })

  it('defines one consistent demo-api systemd service', () => {
    const file = 'docs/linux/runtime/systemd-services.md'
    const source = readFileSync(resolve(root, file), 'utf8')
    const unit = markdownFences(source, file).find(
      (fence) =>
        fence.info === 'ini title="/etc/systemd/system/demo-api.service"',
    )?.content

    expect(unit).toBeDefined()
    expect(unit).toContain('[Unit]')
    expect(unit).toContain('[Service]')
    expect(unit).toContain('[Install]')
    expect(unit).toContain('User=demo-api')
    expect(unit).toContain('WorkingDirectory=/opt/demo-api')
    expect(unit).toContain(
      'ExecStart=/opt/demo-api/node/bin/node /opt/demo-api/server.mjs',
    )
    expect(unit).toContain('Restart=on-failure')
    expect(unit).toContain('TimeoutStopSec=15s')
  })
})
