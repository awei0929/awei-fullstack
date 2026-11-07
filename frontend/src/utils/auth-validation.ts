export function hasValidPasswordLength(password: string): boolean {
  // Count Unicode code points, including variation selectors, on both clients and server.
  const length = Array.from(password).length
  return length >= 8 && length <= 64
}
