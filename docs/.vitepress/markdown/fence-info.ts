export function fenceLanguage(info: string): string {
  return info.trim().split(/\s+/, 1)[0] ?? ''
}
