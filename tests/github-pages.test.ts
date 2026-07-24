import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

interface WorkflowStep {
  id?: string
  uses?: string
  with?: Record<string, boolean | string>
  run?: string
}

interface WorkflowJob {
  environment?: {
    name: string
    url: string
  }
  needs?: string
  permissions?: Record<string, string>
  'runs-on': string
  steps: WorkflowStep[]
}

interface PagesWorkflow {
  name: string
  on: {
    push: { branches: string[] }
    workflow_dispatch: null
  }
  permissions: Record<string, string>
  concurrency: {
    group: string
    'cancel-in-progress': boolean
  }
  jobs: Record<string, WorkflowJob>
}

const root = process.cwd()
const nodeVersionPath = resolve(root, '.nvmrc')
const workflowPath = resolve(root, '.github/workflows/deploy-pages.yml')

async function readWorkflow() {
  return parse(await readFile(workflowPath, 'utf8')) as PagesWorkflow
}

function resolvedBase(buildScript: string, repository: string) {
  const result = spawnSync(
    'bash',
    [
      '-c',
      `npm() { node -e 'process.stdout.write(process.env.BASE_PATH || "")'; }\n${buildScript}`,
    ],
    {
      encoding: 'utf8',
      env: { ...process.env, GITHUB_REPOSITORY: repository },
    },
  )

  expect(result.status).toBe(0)
  expect(result.stderr).toBe('')
  return result.stdout.trim()
}

describe('GitHub Pages deployment', () => {
  it('builds and deploys the documentation with the GitHub Pages actions', async () => {
    expect(existsSync(workflowPath)).toBe(true)

    const workflow = await readWorkflow()

    expect(workflow.name).toBe('Deploy documentation to GitHub Pages')
    expect(workflow.on).toEqual({
      push: { branches: ['main'] },
      workflow_dispatch: null,
    })
    expect(workflow.permissions).toEqual({})
    expect(workflow.concurrency).toEqual({
      group: 'pages',
      'cancel-in-progress': false,
    })

    const build = workflow.jobs.build
    expect(build['runs-on']).toBe('ubuntu-latest')
    expect(build.permissions).toEqual({ contents: 'read' })
    expect(build.steps.filter(({ uses }) => uses).map(({ uses }) => uses)).toEqual([
      'actions/checkout@v7',
      'actions/setup-node@v7',
      'actions/upload-pages-artifact@v5',
    ])
    expect(
      build.steps.find(({ uses }) => uses === 'actions/setup-node@v7')?.with,
    ).toEqual({ 'node-version-file': '.nvmrc', cache: 'npm' })
    expect(build.steps.filter(({ run }) => run).map(({ run }) => run)).toEqual(
      expect.arrayContaining(['npm ci', 'npm test', 'npm run typecheck']),
    )
    expect(
      build.steps.find(({ uses }) => uses === 'actions/upload-pages-artifact@v5')
        ?.with,
    ).toEqual({ path: 'docs/.vitepress/dist' })

    const deploy = workflow.jobs.deploy
    expect(deploy.needs).toBe('build')
    expect(deploy['runs-on']).toBe('ubuntu-latest')
    expect(deploy.permissions).toEqual({
      pages: 'write',
      'id-token': 'write',
    })
    expect(deploy.environment).toEqual({
      name: 'github-pages',
      url: '${{ steps.deployment.outputs.page_url }}',
    })
    expect(deploy.steps.map(({ uses }) => uses)).toEqual([
      'actions/configure-pages@v6',
      'actions/deploy-pages@v5',
    ])
    expect(
      deploy.steps.find(({ uses }) => uses === 'actions/deploy-pages@v5')?.id,
    ).toBe('deployment')
  })

  it('pins local and CI builds to Node 24', async () => {
    expect(existsSync(nodeVersionPath)).toBe(true)

    expect(await readFile(nodeVersionPath, 'utf8')).toBe('24\n')
  })

  it('uses the manually preconfigured GitHub Pages site', async () => {
    const workflow = await readWorkflow()
    const configurePages = workflow.jobs.deploy.steps.find(
      ({ uses }) => uses === 'actions/configure-pages@v6',
    )
    const source = await readFile(workflowPath, 'utf8')

    expect(configurePages).toBeDefined()
    expect(configurePages?.with).toBeUndefined()
    expect(source).not.toContain('PAGES_ENABLEMENT_TOKEN')
    expect(source).not.toContain('secrets.')
  })

  it.each([
    ['project Pages', 'liufashi-Mr/k8s-doc', '/k8s-doc/'],
    ['user or organization Pages', 'ExampleOrg/EXAMPLEORG.GITHUB.IO', '/'],
  ])('resolves the %s base from the repository name', async (_, repository, expected) => {
    const workflow = await readWorkflow()
    const buildScript = workflow.jobs.build.steps.find(({ run }) =>
      run?.includes('npm run build'),
    )?.run

    expect(buildScript).toBeDefined()
    expect(resolvedBase(buildScript ?? '', repository)).toBe(expected)
  })

  it('lets VitePress resolve the brand link from the effective site base', async () => {
    const config = await readFile(
      resolve(root, 'docs/.vitepress/config.mts'),
      'utf8',
    )

    expect(config).toContain("const siteBase = process.env.BASE_PATH || '/'")
    expect(config).toContain('base: siteBase')
    expect(config).not.toContain('logoLink:')
    expect(config).toContain('href: `${siteBase}logo.png`')
    expect(config).toContain('transformHead({ siteData, head })')
    expect(config).toContain("favicon[1].href = `${siteData.base}logo.png`")
    expect(config).toContain('`${siteData.base}logo.png`')
    expect(config).not.toContain("href: '/logo.png'")
  })
})
