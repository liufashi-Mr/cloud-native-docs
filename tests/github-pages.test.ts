import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

interface WorkflowStep {
  id?: string
  uses?: string
  with?: Record<string, string>
  run?: string
}

interface WorkflowJob {
  environment?: {
    name: string
    url: string
  }
  needs?: string
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

describe('GitHub Pages deployment', () => {
  it('builds and deploys the documentation with the GitHub Pages actions', async () => {
    const workflowPath = resolve(root, '.github/workflows/deploy-pages.yml')

    expect(existsSync(workflowPath)).toBe(true)

    const source = await readFile(workflowPath, 'utf8')
    const workflow = parse(source) as PagesWorkflow

    expect(workflow.name).toBe('Deploy documentation to GitHub Pages')
    expect(workflow.on).toEqual({
      push: { branches: ['main'] },
      workflow_dispatch: null,
    })
    expect(workflow.permissions).toEqual({
      contents: 'read',
      pages: 'write',
      'id-token': 'write',
    })
    expect(workflow.concurrency).toEqual({
      group: 'pages',
      'cancel-in-progress': true,
    })

    expect(workflow.jobs.build['runs-on']).toBe('ubuntu-latest')
    expect(workflow.jobs.build.steps).toEqual([
      { uses: 'actions/checkout@v4' },
      {
        uses: 'actions/setup-node@v4',
        with: { 'node-version': '22', cache: 'npm' },
      },
      { run: 'npm ci' },
      { run: 'npm test' },
      { run: 'npm run typecheck' },
      { uses: 'actions/configure-pages@v5' },
      {
        run: 'BASE_PATH="/${GITHUB_REPOSITORY#*/}/"\nnpm run build -- --base="$BASE_PATH"\n',
      },
      {
        uses: 'actions/upload-pages-artifact@v3',
        with: { path: 'docs/.vitepress/dist' },
      },
    ])

    expect(workflow.jobs.deploy).toEqual({
      needs: 'build',
      'runs-on': 'ubuntu-latest',
      environment: {
        name: 'github-pages',
        url: '${{ steps.deployment.outputs.page_url }}',
      },
      steps: [{ id: 'deployment', uses: 'actions/deploy-pages@v4' }],
    })
  })

  it('derives project-page assets from the CLI-provided site base', async () => {
    const config = await readFile(
      resolve(root, 'docs/.vitepress/config.mts'),
      'utf8',
    )

    expect(config).toContain('transformHead({ siteData })')
    expect(config).toContain('`${siteData.base}kubernetes-logo.svg`')
    expect(config).not.toContain("href: '/kubernetes-logo.svg'")
  })
})
