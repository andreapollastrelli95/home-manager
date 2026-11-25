// Genera il volantino A5 fronte/retro (HTML + PDF) a partire da volantino.template.html.
//
//   npm run volantino -- https://INDIRIZZO-DELL-APP/ [--verifica]
//       volantino definitivo con QR code reale → volantino.html / volantino.pdf
//   npm run volantino
//       bozza SENZA QR (in attesa dell'indirizzo definitivo) → volantino-bozza.html / volantino-bozza.pdf
//
// --verifica controlla che l'indirizzo risponda e che mostri davvero Home e Car Manager (non una versione vecchia).
// --cartella=DIR scrive i file in un'altra cartella (per prove).
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import QRCode from 'qrcode'

const dir = path.dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const verify = args.includes('--verifica')
const rawUrl = args.find((a) => !a.startsWith('--'))

let url = null
if (rawUrl) {
  try { url = new URL(rawUrl) } catch { console.error(`Indirizzo non valido: ${rawUrl}`); process.exit(1) }
  if (url.protocol !== 'https:') { console.error('L\'indirizzo deve iniziare con https://'); process.exit(1) }
  if (verify) {
    try {
      const r = await fetch(url, { redirect: 'follow' })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      if (!(await r.text()).includes('<title>Home e Car Manager</title>')) throw new Error('la pagina pubblicata non è la versione Home e Car Manager')
      console.log(`Verifica: ${url.href} risponde (HTTP ${r.status}).`)
    } catch (e) {
      console.error(`Verifica fallita: ${e.message}. Pubblica prima l'app: non creo il QR.`)
      process.exit(1)
    }
  }
}

// Cornice di casette lungo i bordi (pagina 148 x 210 mm)
function cornice() {
  const colors = ['#1d4ed8', '#f59e0b', '#16a34a', '#dc2626', '#7c3aed', '#0891b2']
  const s = 9, step = 9.6, m = 2
  const houses = []
  let i = 0
  const put = (x, y) => houses.push(`<use href="#casa" x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${s}" height="${s}" style="color:${colors[i++ % colors.length]}"/>`)
  for (let x = m; x <= 148 - m - s + 0.01; x += step) { put(x, m); put(x, 210 - m - s) }
  for (let y = m + step; y <= 210 - m - s - step + 0.01; y += step) { put(m, y); put(148 - m - s, y) }
  return `<svg class="frame" viewBox="0 0 148 210" aria-hidden="true">${houses.join('')}</svg>`
}

let qrHtml, urlHtml, urlRetro, bozza = ''
if (url) {
  const svg = await QRCode.toString(url.href, { type: 'svg', errorCorrectionLevel: 'M', margin: 0, color: { dark: '#0f172a', light: '#ffffff' } })
  qrHtml = `<div class="qr">${svg}</div>`
  urlHtml = `<span class="url">${url.href}</span>`
  urlRetro = `Indirizzo: <strong>${url.href}</strong>`
} else {
  qrHtml = `<div class="qr placeholder">QR code<br>da inserire quando l’app sarà pubblicata</div>`
  urlHtml = `<span class="url placeholder">indirizzo web da inserire</span>`
  urlRetro = `Indirizzo: <strong>da inserire</strong>`
  bozza = `<div class="bozza">BOZZA – non stampare: manca l’indirizzo definitivo</div>`
}

const html = fs.readFileSync(path.join(dir, 'volantino.template.html'), 'utf8')
  .replace(/\{\{CORNICE\}\}/g, cornice())
  .replace('{{BOZZA}}', bozza)
  .replace('{{QR}}', qrHtml)
  .replace('{{URL}}', urlHtml)
  .replace('{{URL_RETRO}}', urlRetro)

const base = url ? 'volantino' : 'volantino-bozza'
const outDir = path.resolve(args.find((a) => a.startsWith('--cartella='))?.slice(11) ?? dir)
const htmlPath = path.join(outDir, `${base}.html`)
const pdfPath = path.join(outDir, `${base}.pdf`)
fs.writeFileSync(htmlPath, html)
console.log(`Creato ${path.relative(process.cwd(), htmlPath)}`)

// PDF con Edge o Chrome (senza intestazioni/piè di pagina)
const candidates = [
  process.env.EDGE_PATH, process.env.CHROME_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean)
const browser = candidates.find((p) => fs.existsSync(p))
if (!browser) {
  console.log('Browser non trovato: apri il file .html e stampa su carta A5 fronte/retro (o imposta EDGE_PATH).')
} else {
  const profile = fs.mkdtempSync(path.join(dir, '.pdf-profile-'))
  const r = spawnSync(browser, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', `--user-data-dir=${profile}`, `--print-to-pdf=${pdfPath}`, pathToFileURL(htmlPath).href], { stdio: 'ignore', timeout: 60000 })
  fs.rmSync(profile, { recursive: true, force: true })
  if (r.error || !fs.existsSync(pdfPath)) console.log('PDF non creato: apri il file .html e stampa su carta A5 fronte/retro.')
  else console.log(`Creato ${path.relative(process.cwd(), pdfPath)}`)
}
if (!url) console.log('\nQuesta è una BOZZA senza QR code. Quando l\'app è pubblicata: npm run volantino -- https://INDIRIZZO/ --verifica')
