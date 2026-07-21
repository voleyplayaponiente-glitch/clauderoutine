import type { ApiGestor } from './index'

declare global {
  interface Window {
    api: ApiGestor
  }
}

export {}
