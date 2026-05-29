// Экспортирует ингредиенты в CSV для заполнения nameEn
// Запуск: DATABASE_URL="..." node scripts/export-ingredients-csv.js > ingredients-en.csv
//
// Колонки: id, nameRu, nameEn (уже заполненное или пусто)
// После заполнения nameEn — импортировать через import-ingredients-csv.js

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

function esc(s) {
  if (!s) return ''
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${String(s).replace(/"/g, '""')}"`
  }
  return s
}

async function main() {
  const ingredients = await prisma.ingredient.findMany({
    orderBy: { nameRu: 'asc' },
    select: { id: true, nameRu: true, nameEn: true },
  })

  const lines = ['id,nameRu,nameEn']
  for (const ing of ingredients) {
    lines.push([esc(ing.id), esc(ing.nameRu), esc(ing.nameEn || '')].join(','))
  }

  process.stdout.write(lines.join('\n') + '\n')
  process.stderr.write(`Экспортировано: ${ingredients.length} ингредиентов\n`)
}

main()
  .catch(e => { process.stderr.write(e.message + '\n'); process.exit(1) })
  .finally(() => prisma.$disconnect())
