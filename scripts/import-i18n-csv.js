// Импортирует переводы из CSV обратно в en/*.json
// Запуск: node scripts/import-i18n-csv.js i18n-review.csv

const fs   = require('fs')
const path = require('path')

const csvPath  = process.argv[2]
if (!csvPath) { console.error('Usage: node import-i18n-csv.js <file.csv>'); process.exit(1) }

const LOCALES_DIR = path.join(__dirname, '../frontend/src/locales/en')

function parseCSV(text) {
  const rows = []
  let cur = '', inQuote = false, fields = []

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuote) {
      if (ch === '"' && text[i+1] === '"') { cur += '"'; i++ }
      else if (ch === '"') inQuote = false
      else cur += ch
    } else {
      if (ch === '"') { inQuote = true }
      else if (ch === ',') { fields.push(cur); cur = '' }
      else if (ch === '\n') { fields.push(cur); rows.push(fields); fields = []; cur = '' }
      else if (ch === '\r') { /* skip */ }
      else cur += ch
    }
  }
  if (cur || fields.length) { fields.push(cur); rows.push(fields) }
  return rows
}

function setPath(obj, keyPath, value) {
  const parts = keyPath.split('.')
  let cur = obj
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {}
    cur = cur[parts[i]]
  }
  const last = parts[parts.length - 1]
  // restore arrays
  if (value.startsWith('[') && value.endsWith(']')) {
    try { cur[last] = JSON.parse(value); return } catch {}
  }
  cur[last] = value
}

const rows = parseCSV(fs.readFileSync(csvPath, 'utf8'))
const header = rows[0] // namespace,key,ru,en

const byNs = {}
for (let i = 1; i < rows.length; i++) {
  const [ns, key, , en] = rows[i]
  if (!ns || !key) continue
  if (!byNs[ns]) byNs[ns] = {}
  setPath(byNs[ns], key, en)
}

for (const [ns, data] of Object.entries(byNs)) {
  const filePath = path.join(LOCALES_DIR, `${ns}.json`)
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8')
  console.log(`✅ ${ns}.json`)
}
console.log('Done.')
