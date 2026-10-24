/**
 * Bounded rendering of schema validation issues.
 *
 * A failing parse reports one issue per invalid element, so the issue count
 * is set by the input rather than by the schema. The rendered text goes back
 * to the model as a tool error or a structured-output repair prompt, or into a
 * thrown error, so it is capped both by issue count and by line length.
 */

/** Maximum number of issues rendered before the rest are summarized. */
export const MAX_REPORTED_VALIDATION_ISSUES = 20

/** Maximum characters per rendered issue line. */
export const MAX_VALIDATION_ISSUE_LINE_CHARS = 500

/** The fields read from a validation issue. */
export interface ValidationIssue {
  readonly path: readonly PropertyKey[]
  readonly message: string
}

export interface FormatValidationIssuesOptions {
  /** Bullet character that starts each line. */
  readonly bullet: string
  /** Label used in place of an empty path. */
  readonly rootLabel: string
}

/**
 * Render at most {@link MAX_REPORTED_VALIDATION_ISSUES} issues as
 * `  <bullet> <path>: <message>` lines, each cut to
 * {@link MAX_VALIDATION_ISSUE_LINE_CHARS}, followed by one line counting the
 * issues left out.
 */
export function formatValidationIssues(
  issues: readonly ValidationIssue[],
  options: FormatValidationIssuesOptions,
): string {
  const lines = issues.slice(0, MAX_REPORTED_VALIDATION_ISSUES).map((issue) => {
    const path = issue.path.map(String).join('.') || options.rootLabel
    const line = `  ${options.bullet} ${path}: ${issue.message}`
    return line.length > MAX_VALIDATION_ISSUE_LINE_CHARS
      ? `${line.slice(0, MAX_VALIDATION_ISSUE_LINE_CHARS)}... [truncated]`
      : line
  })
  const omitted = issues.length - MAX_REPORTED_VALIDATION_ISSUES
  if (omitted > 0) {
    lines.push(`  ${options.bullet} ... ${omitted} more issue${omitted === 1 ? '' : 's'} not shown`)
  }
  return lines.join('\n')
}
