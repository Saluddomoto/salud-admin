export const JIZOKUKA_STEPS = ['basic-info', 'hearing', 'expenses', 'review', 'export'] as const
export type JizokukaStep = (typeof JIZOKUKA_STEPS)[number]

export function stepPath(caseId: string, step: JizokukaStep): string {
  return `/jizokuka-pilot/cases/${caseId}/${step}`
}

export function adjacentSteps(step: JizokukaStep): { prev: JizokukaStep | null; next: JizokukaStep | null } {
  const i = JIZOKUKA_STEPS.indexOf(step)
  return {
    prev: i > 0 ? JIZOKUKA_STEPS[i - 1] ?? null : null,
    next: i < JIZOKUKA_STEPS.length - 1 ? JIZOKUKA_STEPS[i + 1] ?? null : null,
  }
}
