import { describe, it, expect } from 'vitest'
import { scriptPrincipal } from './version'

describe('versión publicada', () => {
  it('saca el script principal del index.html que genera Vite', () => {
    const html = '<head><script type="module" crossorigin src="./assets/index-CHFw_Mne.js"></script><link rel="modulepreload" href="./assets/vendor-Ab12.js"></head>'
    expect(scriptPrincipal(html)).toBe('index-CHFw_Mne.js')
  })
  it('con el atributo type al final también', () => {
    expect(scriptPrincipal('<script src="/clauderoutine/finanzas/assets/index-x9.js" type="module"></script>')).toBe('index-x9.js')
  })
  it('sin script de producción (modo desarrollo) no dice nada', () => {
    expect(scriptPrincipal('<script type="module" src="/src/main.tsx"></script>')).toBeUndefined()
  })
})
