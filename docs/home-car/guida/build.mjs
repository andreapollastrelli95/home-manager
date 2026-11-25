// Crea guida.pdf (A4) da guida.html con Edge o Chrome:  npm run guida
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const dir = path.dirname(fileURLToPath(import.meta.url))
const html = path.join(dir, 'guida.html')
const pdf = path.join(dir, 'guida.pdf')
const browser = [
  process.env.EDGE_PATH, process.env.CHROME_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean).find((p) => fs.existsSync(p))
if (!browser) { console.log('Browser non trovato: apri guida.html e stampa in PDF (imposta EDGE_PATH).'); process.exit(1) }
const profile = fs.mkdtempSync(path.join(dir, '.pdf-profile-'))
spawnSync(browser, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', `--user-data-dir=${profile}`, `--print-to-pdf=${pdf}`, pathToFileURL(html).href], { stdio: 'ignore', timeout: 60000 })
fs.rmSync(profile, { recursive: true, force: true })
console.log(fs.existsSync(pdf) ? `Creato ${path.relative(process.cwd(), pdf)}` : 'PDF non creato.')
