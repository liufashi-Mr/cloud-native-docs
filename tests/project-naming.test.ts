import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('cloud-native project identity', () => {
  it('uses the cloud-native package name', async () => {
    const root = process.cwd()
    const packageJson = JSON.parse(
      await readFile(resolve(root, 'package.json'), 'utf8'),
    ) as { name?: string }
    const packageLock = JSON.parse(
      await readFile(resolve(root, 'package-lock.json'), 'utf8'),
    ) as { name?: string; packages: Record<string, { name?: string }> }

    expect(packageJson.name).toBe('cloud-native')
    expect(packageLock.name).toBe('cloud-native')
    expect(packageLock.packages['']?.name).toBe('cloud-native')
  })
})
