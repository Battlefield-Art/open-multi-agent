import { describe, it, expect } from 'vitest'
import {
  MAX_REPORTED_VALIDATION_ISSUES,
  MAX_VALIDATION_ISSUE_LINE_CHARS,
  formatValidationIssues,
} from '../src/utils/validation-issues.js'

const options = { bullet: '•', rootLabel: '<root>' }

function issues(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    path: [index, 'name'],
    message: 'Required',
  }))
}

describe('formatValidationIssues', () => {
  it('renders every issue when the count is within the limit', () => {
    const text = formatValidationIssues(issues(2), options)
    expect(text).toBe('  • 0.name: Required\n  • 1.name: Required')
  })

  it('renders the first issues and counts the rest', () => {
    const total = MAX_REPORTED_VALIDATION_ISSUES + 980
    const lines = formatValidationIssues(issues(total), options).split('\n')

    expect(lines).toHaveLength(MAX_REPORTED_VALIDATION_ISSUES + 1)
    expect(lines[0]).toBe('  • 0.name: Required')
    expect(lines[MAX_REPORTED_VALIDATION_ISSUES - 1]).toBe(
      `  • ${MAX_REPORTED_VALIDATION_ISSUES - 1}.name: Required`,
    )
    expect(lines.at(-1)).toBe('  • ... 980 more issues not shown')
  })

  it('uses the singular for one omitted issue', () => {
    const text = formatValidationIssues(issues(MAX_REPORTED_VALIDATION_ISSUES + 1), options)
    expect(text.split('\n').at(-1)).toBe('  • ... 1 more issue not shown')
  })

  it('cuts a long issue line', () => {
    const text = formatValidationIssues(
      [{ path: ['a'], message: 'x'.repeat(MAX_VALIDATION_ISSUE_LINE_CHARS * 4) }],
      options,
    )
    expect(text).toHaveLength(MAX_VALIDATION_ISSUE_LINE_CHARS + '... [truncated]'.length)
    expect(text.endsWith('... [truncated]')).toBe(true)
  })

  it('labels an empty path and renders symbol keys', () => {
    const text = formatValidationIssues(
      [
        { path: [], message: 'Expected object' },
        { path: [Symbol('meta'), 0], message: 'Invalid' },
      ],
      options,
    )
    expect(text).toBe('  • <root>: Expected object\n  • Symbol(meta).0: Invalid')
  })
})
