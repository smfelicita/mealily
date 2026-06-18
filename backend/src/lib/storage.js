// Хранилище медиафайлов с переключаемым драйвером (STORAGE_DRIVER в .env):
//   'supabase' (по умолчанию) — Supabase Storage, как было всегда (mealily.ru)
//   'local'                   — локальный диск + раздача через nginx (mealily.ru)
//
// Для local обязательны:
//   MEDIA_DIR        — каталог на диске, например /var/www/mealily-media
//   MEDIA_PUBLIC_URL — публичный префикс, например https://mealily.ru/media

const path = require('path')
const fs = require('fs/promises')

const DRIVER = process.env.STORAGE_DRIVER || 'supabase'

async function saveLocal(key, buffer) {
  const base = process.env.MEDIA_DIR
  const publicBase = (process.env.MEDIA_PUBLIC_URL || '').replace(/\/$/, '')
  if (!base || !publicBase) {
    throw new Error('STORAGE_DRIVER=local: задайте MEDIA_DIR и MEDIA_PUBLIC_URL в .env')
  }
  const resolvedBase = path.resolve(base)
  const full = path.resolve(resolvedBase, key)
  // Защита от выхода за пределы каталога (key приходит из кода, но перестрахуемся)
  if (!full.startsWith(resolvedBase + path.sep)) {
    throw new Error('Некорректный путь файла')
  }
  await fs.mkdir(path.dirname(full), { recursive: true })
  await fs.writeFile(full, buffer)
  return `${publicBase}/${key}`
}

async function saveSupabase(key, buffer, contentType) {
  const getSupabase = require('./supabase')
  const supabase = getSupabase()
  const { error } = await supabase.storage
    .from('media')
    .upload(key, buffer, { contentType, upsert: false })
  if (error) throw error
  const { data } = supabase.storage.from('media').getPublicUrl(key)
  return data.publicUrl
}

/**
 * Сохраняет файл и возвращает его публичный URL.
 * @param {string} key — путь вида "images/<userId>_<ts>.jpg"
 * @param {Buffer} buffer
 * @param {string} contentType
 * @returns {Promise<string>}
 */
async function saveFile(key, buffer, contentType) {
  return DRIVER === 'local'
    ? saveLocal(key, buffer)
    : saveSupabase(key, buffer, contentType)
}

module.exports = { saveFile, DRIVER }
