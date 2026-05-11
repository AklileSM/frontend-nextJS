export function flagsFromObservationBooleans(
  safetyIssue: boolean,
  qualityIssue: boolean,
  delayed: boolean,
): string[] {
  const f: string[] = [];
  if (safetyIssue) f.push('safety');
  if (qualityIssue) f.push('quality');
  if (delayed) f.push('delayed');
  return f;
}
