import { describe, expect, it } from 'vitest'

import {
  COORDINATOR_PLAN_MAX_TASKS,
  COORDINATOR_ROLE_SUMMARY_MAX_CHARS,
  COORDINATOR_TASK_MAX_REQUIREMENTS,
  buildCoordinatorOutputFormatSection,
  buildCoordinatorRosterManifest,
  buildCoordinatorRosterSection,
  buildCoordinatorTaskSpecsSchema,
  parseTaskSpecs,
} from '../src/orchestrator/coordinator.js'
import { buildRoutingContext } from '../src/orchestrator/execution-router.js'
import type { AgentConfig } from '../src/types.js'

describe('coordinator roster manifest', () => {
  it('uses explicit descriptions before bounded first-line prompt summaries', () => {
    const agents: AgentConfig[] = [
      {
        name: 'described',
        model: 'test-model',
        description: 'Explicit role description.',
        systemPrompt: 'SECRET_FULL_PROMPT_SHOULD_NOT_WIN\nmore secret text',
        capabilities: ['research'],
        tools: ['file_read'],
        costTier: 'low',
      },
      {
        name: 'fallback',
        model: 'test-model',
        systemPrompt: `${'首行角色'.repeat(80)}\nSECOND_SECRET_LINE`,
      },
    ]

    const manifest = buildCoordinatorRosterManifest(agents)

    expect(manifest[0]).toEqual({
      name: 'described',
      model: 'test-model',
      roleSummary: 'Explicit role description.',
      capabilities: ['research'],
      tools: ['file_read'],
      costTier: 'low',
    })
    expect(manifest[1]?.roleSummary?.length).toBeLessThanOrEqual(
      COORDINATOR_ROLE_SUMMARY_MAX_CHARS,
    )
    expect(JSON.stringify(manifest)).not.toContain('SECOND_SECRET_LINE')
    expect(JSON.stringify(manifest)).not.toContain('SECRET_FULL_PROMPT_SHOULD_NOT_WIN')
  })

  it('allowlists fields and keeps size independent of full system-prompt length', () => {
    const base: AgentConfig = {
      name: 'worker',
      model: 'test-model',
      systemPrompt: 'Role summary\nshort body',
      apiKey: 'sk-secret-value',
      credentials: { token: 'credential-secret-value' },
    }
    const shortSection = buildCoordinatorRosterSection([base])
    const longSection = buildCoordinatorRosterSection([{
      ...base,
      systemPrompt: `Role summary\n${'private body '.repeat(100_000)}`,
    }])

    expect(longSection.length).toBe(shortSection.length)
    expect(longSection).not.toContain('private body')
    expect(longSection).not.toContain('sk-secret-value')
    expect(longSection).not.toContain('credential-secret-value')
    expect(longSection).not.toContain('"apiKey"')
    expect(longSection).not.toContain('"credentials"')

    const tenAgentSection = buildCoordinatorRosterSection(
      Array.from({ length: 10 }, (_, index) => ({
        ...base,
        name: `worker-${index}`,
        systemPrompt: `Role summary\n${'private body '.repeat(100_000)}`,
      })),
    )
    expect(tenAgentSection.length).toBeLessThan(10 * 500)
  })

  it('keeps role summaries out of execution-router context', () => {
    const context = buildRoutingContext('Goal', [{
      name: 'worker',
      model: 'test-model',
      description: 'Explicit coordinator-only role summary.',
      capabilities: ['research'],
      costTier: 'low',
    }], 'fallback-model', {})

    expect(context.roster).toEqual([{
      name: 'worker',
      model: 'test-model',
      capabilities: ['research'],
      costTier: 'low',
    }])
    expect(JSON.stringify(context)).not.toContain('roleSummary')
    expect(JSON.stringify(context)).not.toContain('coordinator-only')
  })

  it('parses optional task requirements from coordinator JSON', () => {
    const specs = parseTaskSpecs(`\`\`\`json
      [{
        "title": "Patch",
        "description": "Patch the parser",
        "assignee": "editor",
        "requires": {
          "requiredTools": ["file_edit"],
          "requiredCapabilities": ["typescript"],
          "requiredBackend": "llm",
          "requiredProvider": "anthropic"
        }
      }]
    \`\`\``)

    expect(specs?.[0]?.requires).toEqual({
      requiredTools: ['file_edit'],
      requiredCapabilities: ['typescript'],
      requiredBackend: 'llm',
      requiredProvider: 'anthropic',
    })
  })

  it('guides assignee selection through manifest capability tags', () => {
    const section = buildCoordinatorOutputFormatSection()

    expect(section).toContain(
      'Prefer an agent whose manifest `capabilities` best match the task',
    )
    expect(section).toContain(
      'use `roleSummary` and `tools` only as secondary assignment signals',
    )
  })
})

describe('coordinator plan schema bounds', () => {
  const agents: AgentConfig[] = [{ name: 'worker', model: 'test-model' }]
  const schema = buildCoordinatorTaskSpecsSchema(agents, true)
  const plan = (count: number) =>
    Array.from({ length: count }, (_, index) => ({
      title: `Task ${index}`,
      description: `Do part ${index}`,
      assignee: 'worker',
    }))

  it('accepts a plan at the task limit', () => {
    expect(schema.safeParse(plan(COORDINATOR_PLAN_MAX_TASKS)).success).toBe(true)
  })

  it('rejects a plan above the task limit with a single size issue', () => {
    const result = schema.safeParse(plan(COORDINATOR_PLAN_MAX_TASKS + 1))
    expect(result.success).toBe(false)
    expect(result.error?.issues.some((issue) => issue.code === 'too_big' && issue.path.length === 0)).toBe(true)
  })

  it('rejects oversized dependsOn and requirement lists', () => {
    const [first, second] = plan(2)
    const tooManyDeps = schema.safeParse([
      first,
      { ...second, dependsOn: Array.from({ length: COORDINATOR_PLAN_MAX_TASKS + 1 }, () => 'Task 0') },
    ])
    const tooManyTools = schema.safeParse([
      {
        ...first,
        requires: {
          requiredTools: Array.from({ length: COORDINATOR_TASK_MAX_REQUIREMENTS + 1 }, (_, i) => `tool_${i}`),
        },
      },
    ])
    const tooManyCapabilities = schema.safeParse([
      {
        ...first,
        requires: {
          requiredCapabilities: Array.from({ length: COORDINATOR_TASK_MAX_REQUIREMENTS + 1 }, (_, i) => `cap_${i}`),
        },
      },
    ])

    expect(tooManyDeps.error?.issues.map((issue) => [issue.code, issue.path.join('.')])).toContainEqual(['too_big', '1.dependsOn'])
    expect(tooManyTools.error?.issues.map((issue) => [issue.code, issue.path.join('.')])).toContainEqual(['too_big', '0.requires.requiredTools'])
    expect(tooManyCapabilities.error?.issues.map((issue) => [issue.code, issue.path.join('.')])).toContainEqual(['too_big', '0.requires.requiredCapabilities'])
  })
})
