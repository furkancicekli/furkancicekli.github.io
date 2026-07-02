/**
 * Client-side mirror of the worker's formatSerial (src/worker/lib/serial.ts) —
 * that module isn't importable from the browser bundle. Groups a 16-digit
 * serial number into 4-digit chunks separated by spaces for display.
 */
export function formatSerial(serial: string): string {
  const normalized = serial.replace(/[\s-]/g, '')
  const groups = normalized.match(/.{1,4}/g) ?? []
  return groups.join(' ')
}
