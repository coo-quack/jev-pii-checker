/**
 * Mask sensitive values by showing first 2 chars + … + last 1 char.
 */
export function maskValue(value: string): string {
  if (value.length <= 3) {
    return "…";
  }
  const first = value.substring(0, 2);
  const last = value.substring(value.length - 1);
  return `${first}…${last}`;
}
