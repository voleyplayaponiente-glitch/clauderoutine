import { useEffect, useState } from 'react'

export interface Route {
  path: string
  params: Record<string, string>
}

function parse(): Route {
  const hash = window.location.hash.replace(/^#/, '') || '/'
  const [path, query] = hash.split('?')
  const params: Record<string, string> = {}
  if (query) {
    new URLSearchParams(query).forEach((v, k) => (params[k] = v))
  }
  return { path: path || '/', params }
}

export function navigate(path: string) {
  window.location.hash = path
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(parse())
  useEffect(() => {
    const handler = () => setRoute(parse())
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])
  return route
}
