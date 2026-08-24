import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('Office restart/replay QA harness guardrails', () => {
  it('requires explicit isolated-cluster acknowledgement and finally cleanup', async () => {
    const source = await readFile(new URL('./qaOfficeRestartReplay.ts', import.meta.url), 'utf8')
    expect(source).toContain("const REQUIRED_ACK = 'ephemeral-local-postgres'")
    expect(source).toContain("process.env.NODE_ENV === 'production'")
    expect(source).toContain('await cluster.cleanup()')
    expect(source).toContain("startsWith(resolve(TEMP_PREFIX))")
    expect(source).not.toMatch(/OFFICE_INGEST_KEYS_JSON|https:\/\//)
  })

  it('keeps credentials out of argv and exercises the real Sentinel client', async () => {
    const source = await readFile(new URL('./qaOfficeRestartReplay.ts', import.meta.url), 'utf8')
    expect(source).toContain("PGPASSWORD: password")
    expect(source).toContain("'--pwfile', passwordFile")
    expect(source).not.toMatch(/--password|console\.(?:log|error).*password/)
    expect(source).toContain("'eclipse-hopson-sentinel', 'office', 'eclipse-chat-office-ingest-client.mjs'")
    expect(source).toContain("records[0].upstreamBody !== records[1].upstreamBody")
    expect(source).toContain("records.at(-1)?.upstreamStatus !== 409")
  })
})
