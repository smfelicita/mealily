// Импортирует nameEn из CSV обратно в БД
// Запуск: DATABASE_URL="..." node scripts/import-ingredients-csv.js ingredients-en.csv
//
// CSV должен содержать колонки: id, nameRu, nameEn
// Пропускает строки с пустым nameEn

const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')

const prisma = new PrismaClient()

function parseCSV(content) {
  const lines = content.trim().split('\n')
  const headers = lines[0].split(',').map(h => h.trim())
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue
    // Простой парсер CSV (учитывает кавычки)
    const values = []
    let current = ''
    let inQuotes = false
    for (let j = 0; j < line.length; j++) {
      const ch = line[j]
      if (ch === '"') {
        if (inQuotes && line[j + 1] === '"') { current += '"'; j++ }
        else inQuotes = !inQuotes
      } else if (ch === ',' && !inQuotes) {
        values.push(current); current = ''
      } else {
        current += ch
      }
    }
    values.push(current)
    const row = {}
    headers.forEach((h, idx) => { row[h] = values[idx]?.trim() || '' })
    rows.push(row)
  }
  return rows
}

async function main() {
  const file = process.argv[2]
  if (!file) {
    console.error('Укажите файл: node scripts/import-ingredients-csv.js ingredients-en.csv')
    process.exit(1)
  }

  const content = fs.readFileSync(path.resolve(file), 'utf-8')
  const rows = parseCSV(content)

  let updated = 0
  let skipped = 0

  for (const row of rows) {
    if (!row.id || !row.nameEn) { skipped++; continue }
    await prisma.ingredient.update({
      where: { id: row.id },
      data: { nameEn: row.nameEn },
    })
    updated++
  }

  console.log(`Обновлено: ${updated}, пропущено (нет nameEn): ${skipped}`)
}

main()
  .catch(e => { console.error(e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
