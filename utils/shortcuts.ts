export function AssembleShortcutTitle(key: string, ctrl = false, alt = false, shift = false) {
  // 'CommandOrControl+Shift+Alt+F12'
  key = key.toUpperCase()
  const hasPrefixes = ctrl || alt || shift
  return hasPrefixes ? key : key
}
