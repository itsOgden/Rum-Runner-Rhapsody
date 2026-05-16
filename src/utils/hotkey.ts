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
