export function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function waitSeconds(seconds: number) {
  return wait(seconds * 1000)
}

export function waitOneFrame() {
  return wait(0)
}
