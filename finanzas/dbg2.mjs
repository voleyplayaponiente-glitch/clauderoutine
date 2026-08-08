import { chromium } from 'playwright-core'
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const p = await (await nav.newContext({viewport:{width:1400,height:1100}})).newPage()
await p.goto('http://localhost:4184/#/informes'); await p.waitForTimeout(2500)
const t = await p.locator('body').innerText()
console.log(t.slice(0, 1200))
