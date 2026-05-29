/**
 * Возвращает локализованное название ингредиента.
 * @param {{ name?: string, nameRu?: string, nameEn?: string }} ingredient
 * @param {string} lang — текущий язык из i18n.language ('ru' | 'en')
 * @returns {string}
 */
export function getIngredientName(ingredient, lang) {
  if (lang === 'en' && ingredient.nameEn) return ingredient.nameEn
  return ingredient.nameRu || ingredient.name || ''
}
