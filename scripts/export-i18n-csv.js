// Генерирует CSV для проверки/редактирования переводов
// Запуск: node scripts/export-i18n-csv.js > i18n-review.csv

const fs   = require('fs')
const path = require('path')

const LOCALES_DIR = path.join(__dirname, '../frontend/src/locales')
const NAMESPACES  = ['auth','chat','common','dish','errors','fridge','groups','home','plan','profile']

function flatten(obj, prefix = '') {
  const rows = []
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      rows.push(...flatten(v, key))
    } else {
      rows.push([key, Array.isArray(v) ? JSON.stringify(v) : String(v)])
    }
  }
  return rows
}

function esc(s) {
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

const lines = ['namespace,key,ru,en']

for (const ns of NAMESPACES) {
  const ruPath = path.join(LOCALES_DIR, 'ru', `${ns}.json`)
  const enPath = path.join(LOCALES_DIR, 'en', `${ns}.json`)

  const ru = JSON.parse(fs.readFileSync(ruPath, 'utf8'))
  const en = fs.existsSync(enPath) ? JSON.parse(fs.readFileSync(enPath, 'utf8')) : {}

  const enFlat = new Map(flatten(en))

  for (const [key, ruVal] of flatten(ru)) {
    const enVal = enFlat.get(key) || ''
    lines.push([ns, key, ruVal, enVal].map(esc).join(','))
  }
}

process.stdout.write(lines.join('\n') + '\n')
