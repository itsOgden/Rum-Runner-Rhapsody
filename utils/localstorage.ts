function namespaced(namespace = '', key: string) {
  return namespace ? `${namespace}.${key}` : key
}

export function setLocalStorage<T>(key: string, value: T, namespace = '') {
  localStorage.setItem(namespaced(namespace, key), JSON.stringify(value))
}

export function getLocalStorage<T>(key: string, defaultValue: T, namespace = ''): T {
  if (typeof (localStorage) === 'undefined')
    return defaultValue
  const value = localStorage.getItem(namespaced(namespace, key))
  return value ? JSON.parse(value) as T : defaultValue
}
