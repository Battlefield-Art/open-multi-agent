// Type-level fixture for tests/zod-versions.test.ts. It is compiled, not run:
// both supported Zod majors must infer tool input and output types, and
// zod/mini schemas must be rejected at compile time.
import { z } from 'zod'
import { z as z3 } from 'zod/v3'
import * as zm from 'zod/mini'
import { defineTool, type AgentConfig, type SharedMemoryWriteOptions } from '../../src/index.js'

export const zod4Tool = defineTool({
  name: 'zod4',
  description: 'Zod 4 input.',
  inputSchema: z.object({ path: z.string(), limit: z.number().optional() }),
  outputSchema: z.object({ size: z.number() }),
  execute: async (input) => {
    const path: string = input.path
    const limit: number | undefined = input.limit
    // @ts-expect-error the schema has no such key
    void input.missing
    return { data: { size: path.length + (limit ?? 0) } }
  },
})

export const zod3Tool = defineTool({
  name: 'zod3',
  description: 'Zod 3 input.',
  inputSchema: z3.object({ path: z3.string(), limit: z3.number().optional() }),
  outputSchema: z3.object({ size: z3.number() }),
  execute: async (input) => {
    const path: string = input.path
    const limit: number | undefined = input.limit
    // @ts-expect-error the schema has no such key
    void input.missing
    return { data: { size: path.length + (limit ?? 0) } }
  },
})

export const miniTool = defineTool({
  name: 'mini',
  description: 'zod/mini input.',
  // @ts-expect-error zod/mini schemas are not accepted
  inputSchema: zm.object({ path: zm.string() }),
  execute: async () => ({ data: 'ok' }),
})

export const agents: AgentConfig[] = [
  { name: 'zod4', model: 'test-model', outputSchema: z.object({ answer: z.string() }) },
  { name: 'zod3', model: 'test-model', outputSchema: z3.object({ answer: z3.string() }) },
]

export const writeOptions: SharedMemoryWriteOptions[] = [
  { schema: z.object({ total: z.number() }) },
  { schema: z3.object({ total: z3.number() }) },
]
