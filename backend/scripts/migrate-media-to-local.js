/**
 * Перенос медиафайлов из Supabase Storage на локальный диск (mealily.ru).
 *
 * Что делает:
 *   1. Находит в БД ссылки на *.supabase.co (Dish.imageUrl/images/videoUrl, Group.avatarUrl)
 *   2. Скачивает файлы по публичным URL
 *   3. Сохраняет в MEDIA_DIR с тем же путём (images/..., videos/...)
 *   4. Обновляет ссылки в БД на MEDIA_PUBLIC_URL/...
 *
 * Запуск (на сервере, из папки backend, с STORAGE_DRIVER=local в .env):
 *   node scripts/migrate-media-to-local.js --dry-run   # показать план
 *   node scripts/migrate-media-to-local.js             # выполнить
 *
 * Идемпотентный: не-supabase ссылки пропускаются, можно перезапускать.
 */

require('dotenv').config()
const path = require('path')
const fs = require('fs/promises')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const DRY = process.argv.includes('--dry-run')

const MEDIA_DIR = process.env.MEDIA_DIR
const PUBLIC_BASE = (process.env.MEDIA_PUBLIC_URL || '').replace(/\/$/, '')

const isSupabase = (url) => typeof url === 'string' && url.includes('.supabase.co/')

// https://xxx.supabase.co/storage/v1/object/public/media/images/a.jpg → images/a.jpg
function keyFromUrl(url) {
  const m = url.match(/\/object\/public\/[^/]+\/(.+)$/)
  return m ? decodeURIComponent(m[1]) : null
}

let migrated = 0, skipped = 0, failed = 0
const cache = new Map()

async function migrateUrl(url) {
  if (!isSupabase(url)) { skipped++; return url }
  if (cache.has(url)) return cache.get(url)

  const key = keyFromUrl(url)
  if (!key) { console.warn('  ! не разобрал URL:', url); failed++; return url }

  const newUrl = `${PUBLIC_BASE}/${key}`
  if (DRY) {
    console.log(`  [dry] ${key} → ${newUrl}`)
    cache.set(url, newUrl); migrated++
    return newUrl
  }

  const res = await fetch(url)
  if (!res.ok) { console.warn(`  ! HTTP ${res.status}: ${url}`); failed++; return url }
  const buffer = Buffer.from(await res.arrayBuffer())

  const full = path.resolve(MEDIA_DIR, key)
  await fs.mkdir(path.dirname(full), { recursive: true })
  await fs.writeFile(full, buffer)
  console.log(`  ✓ ${key} (${(buffer.length / 1024).toFixed(0)} КБ)`)
  cache.set(url, newUrl); migrated++
  return newUrl
}

async function main() {
  if (!MEDIA_DIR || !PUBLIC_BASE) {
    console.error('Задайте MEDIA_DIR и MEDIA_PUBLIC_URL в .env')
    process.exit(1)
  }
  console.log(DRY ? '=== DRY RUN ===' : `=== Перенос медиа в ${MEDIA_DIR} ===`)

  const dishes = await prisma.dish.findMany({
    select: { id: true, name: true, imageUrl: true, images: true, videoUrl: true },
  })
  for (const d of dishes) {
    const hasAny = isSupabase(d.imageUrl) || isSupabase(d.videoUrl) || (d.images || []).some(isSupabase)
    if (!hasAny) continue
    console.log(`Блюдо: ${d.name}`)
    const data = {}
    if (isSupabase(d.imageUrl)) data.imageUrl = await migrateUrl(d.imageUrl)
    if (isSupabase(d.videoUrl)) data.videoUrl = await migrateUrl(d.videoUrl)
    if ((d.images || []).some(isSupabase)) {
      data.images = []
      for (const img of d.images) data.images.push(await migrateUrl(img))
    }
    if (!DRY && Object.keys(data).length) {
      await prisma.dish.update({ where: { id: d.id }, data })
    }
  }

  const groups = await prisma.group.findMany({ select: { id: true, name: true, avatarUrl: true } })
  for (const g of groups) {
    if (!isSupabase(g.avatarUrl)) continue
    console.log(`Группа: ${g.name}`)
    const newUrl = await migrateUrl(g.avatarUrl)
    if (!DRY) await prisma.group.update({ where: { id: g.id }, data: { avatarUrl: newUrl } })
  }

  console.log(`\nИтог: перенесено ${migrated}, пропущено ${skipped}, ошибок ${failed}`)
  if (failed > 0) process.exit(1)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
