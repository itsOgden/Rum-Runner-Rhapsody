// Keys that are safe to bind without modifiers — non-printable, won't disrupt typing.
const SAFE_SOLO_KEYS = new Set([
  'F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12',
  'F13','F14','F15','F16','F17','F18','F19','F20','F21','F22','F23','F24',
  'Up','Down','Left','Right',
  'Home','End','PageUp','PageDown','Insert','Escape',
  'PrintScreen','ScrollLock','Pause',
  'MediaPlayPause','MediaStop','MediaNextTrack','MediaPreviousTrack',
  'VolumeUp','VolumeDown','VolumeMute',
])

// Returns true if combo could block normal typing in other apps.
// Safe = has Ctrl/Alt/Meta, OR is an unambiguous non-printable key.
export function isTypingConflict(combo: string): boolean {
  const parts = combo.split('+')
  const key = parts[parts.length - 1]
  const mods = parts.slice(0, -1)
  if (mods.includes('Ctrl') || mods.includes('Alt') || mods.includes('Meta')) return false
  return !SAFE_SOLO_KEYS.has(key)
}

// Maps KeyboardEvent.code → unshifted base key, so Shift+4 → "4" not "$"
function codeToBaseKey(code: string): string | null {
  if (code.startsWith('Digit')) return code[5]
  if (code.startsWith('Key'))   return code[3].toUpperCase()
  const m: Record<string, string> = {
    Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']',
    Backslash: '\\', Semicolon: ';', Quote: "'", Comma: ',',
    Period: '.', Slash: '/', Backquote: '`',
  }
  return m[code] ?? null
}

export function formatAccelerator(e: KeyboardEvent): string | null {
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return null
  const parts: string[] = []
  if (e.ctrlKey)  parts.push('Ctrl')
  if (e.altKey)   parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  if (e.metaKey)  parts.push('Meta')
  const k = e.key
  if (k === ' ')             parts.push('Space')
  else if (k === 'ArrowUp')    parts.push('Up')
  else if (k === 'ArrowDown')  parts.push('Down')
  else if (k === 'ArrowLeft')  parts.push('Left')
  else if (k === 'ArrowRight') parts.push('Right')
  else if (k === 'Enter')      parts.push('Return')
  else if (k.length === 1)     parts.push(codeToBaseKey(e.code) ?? k.toUpperCase())
  else                         parts.push(k)
  return parts.join('+')
}
