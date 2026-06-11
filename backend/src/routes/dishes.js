const router = require('express').Router()
const prisma = require('../lib/prisma')
const { authMiddleware: auth, optionalAuth } = require('../middleware/auth')
const { calculateNutrition } = require('../utils/nutrition')
const validate = require('../middleware/validate')
const { dishCreate, dishUpdate, dishBulk } = require('../lib/schemas')
const { logger } = require('../lib/logger')

// Вспомогательная — список groupId где user является участником
async function getMemberGroupIds(userId) {
  if (!userId) return []
  const memberships = await prisma.groupMember.findMany({
    where: { userId },
    select: { groupId: true },
  })
  return memberships.map(m => m.groupId)
}

// Вспомогательная — список FAMILY groupId пользователя
async function getFamilyGroupIds(userId) {
  if (!userId) return []
  const groups = await prisma.groupMember.findMany({
    where: { userId, group: { type: 'FAMILY' } },
    select: { groupId: true },
  })
  return groups.map(g => g.groupId)
}

// Фильтр "Моя кухня": только личные и семейные блюда
async function buildMyKitchenFilter(userId) {
  const memberships = await prisma.groupMember.findMany({
    where: { userId, group: { type: 'FAMILY' } },
    select: { groupId: true },
  })
  const familyGroupIds = memberships.map(m => m.groupId)
  return {
    OR: [
      { authorId: userId },
      ...(familyGroupIds.length ? [{ visibility: 'FAMILY', groupId: { in: familyGroupIds } }] : []),
    ],
  }
}

// Строит фильтр видимости с учётом групп и DishVisibility
async function buildVisibilityFilter(userId) {
  if (!userId) return { OR: [{ visibility: 'PUBLIC', status: 'APPROVED' }] }

  // Один запрос: всё членство с типом группы
  const memberships = await prisma.groupMember.findMany({
    where: { userId },
    select: { groupId: true, group: { select: { type: true } } },
  })

  const familyGroupIds = memberships.filter(m => m.group.type === 'FAMILY').map(m => m.groupId)
  const allGroupIds    = memberships.map(m => m.groupId)

  // Co-members для ALL_GROUPS — один запрос
  let allGroupsCondition = []
  if (allGroupIds.length) {
    const coMemberIds = await prisma.groupMember.findMany({
      where: { groupId: { in: allGroupIds }, userId: { not: userId } },
      select: { userId: true },
      distinct: ['userId'],
    })
    if (coMemberIds.length) {
      allGroupsCondition = [{ visibility: 'ALL_GROUPS', authorId: { in: coMemberIds.map(m => m.userId) } }]
    }
  }

  return {
    OR: [
      { visibility: 'PUBLIC', status: 'APPROVED' },
      { authorId: userId },
      ...(familyGroupIds.length ? [{ visibility: 'FAMILY', groupId: { in: familyGroupIds } }] : []),
      ...allGroupsCondition,
    ],
  }
}

// Проверка доступа к блюду по visibility — возвращает true если доступ разрешён
async function checkDishAccess(dish, userId) {
  if (dish.visibility === 'PUBLIC' && dish.status === 'APPROVED') return true
  if (dish.authorId === userId) return true
  const groupIds = await getMemberGroupIds(userId)
  if (dish.visibility === 'FAMILY' && dish.groupId) {
    return groupIds.includes(dish.groupId)
  }
  if (dish.visibility === 'ALL_GROUPS') {
    const sharedGroup = await prisma.groupMember.findFirst({
      where: { groupId: { in: groupIds }, userId: dish.authorId },
    })
    return Boolean(sharedGroup)
  }
  return false
}

// Полнотекстовый + нечёткий поиск через pg_trgm (raw SQL)
async function getSearchIds(q) {
  const likeQ = `%${q}%`
  const rows = await prisma.$queryRaw`
    SELECT DISTINCT d.id
    FROM dishes d
    LEFT JOIN dish_ingredients di ON di."dishId" = d.id
    LEFT JOIN ingredients i ON i.id = di."ingredientId"
    WHERE
      d."name" ILIKE ${likeQ}
      OR d.description ILIKE ${likeQ}
      OR similarity(d."name", ${q}) > 0.25
      OR EXISTS (SELECT 1 FROM unnest(d.tags) t WHERE t ILIKE ${likeQ})
      OR i."nameRu" ILIKE ${likeQ}
  `
  return rows.map(r => r.id)
}

// GET /api/dishes — поиск и фильтрация
// Query params: q, mealTime, category, tags, cuisine, difficulty, ingredients, fridgeMode, myKitchen, onlyMine, familyOnly, limit, offset
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const { q, mealTime, category, tags, cuisine, difficulty, ingredients, fridgeMode, myKitchen, onlyMine, familyOnly, favorites } = req.query
    const limit  = Math.min(parseInt(req.query.limit  || '100', 10), 200)
    const offset = parseInt(req.query.offset || '0', 10) || 0

    let visibilityFilter
    if (familyOnly === 'true' && req.userId) {
      const familyGroupIds = await getFamilyGroupIds(req.userId)
      visibilityFilter = familyGroupIds.length
        ? { visibility: 'FAMILY', groupId: { in: familyGroupIds } }
        : { id: 'none' }
    } else if (onlyMine === 'true' && req.userId) {
      visibilityFilter = { authorId: req.userId }
    } else if (myKitchen === 'true' && req.userId) {
      visibilityFilter = await buildMyKitchenFilter(req.userId)
    } else {
      visibilityFilter = await buildVisibilityFilter(req.userId)
    }

    const baseWhere = { ...visibilityFilter, ...buildBaseFilter({ mealTime, category, tags, cuisine, difficulty }) }

    // Collect id-filter sets — AND them together at the end
    let idSets = []

    if (q) {
      idSets.push(await getSearchIds(q))
    }

    if (favorites === 'true' && req.userId) {
      const favs = await prisma.favorite.findMany({
        where: { userId: req.userId },
        select: { dishId: true },
      })
      idSets.push(favs.map(f => f.dishId))
    }

    if (idSets.length === 1) {
      baseWhere.id = { in: idSets[0] }
    } else if (idSets.length > 1) {
      // Intersect all sets
      const intersection = idSets.reduce((a, b) => {
        const setB = new Set(b)
        return a.filter(id => setB.has(id))
      })
      baseWhere.id = { in: intersection }
    }

    if (fridgeMode === 'true') {
      if (!req.userId) {
        return res.status(401).json({ error: 'Войдите для режима холодильника' })
      }
      const familyMembership = await prisma.groupMember.findFirst({
        where: { userId: req.userId, group: { type: 'FAMILY' } },
        select: { groupId: true },
      })
      const fridgeWhere = familyMembership
        ? { groupId: familyMembership.groupId }
        : { userId: req.userId, groupId: null }
      const fridgeItems = await prisma.fridgeItem.findMany({
        where: fridgeWhere,
        select: { ingredientId: true },
      })
      const fridgeIngredientIds = fridgeItems.map(f => f.ingredientId)

      // Фильтрация на стороне БД: блюдо подходит, если нет ни одного
      // обязательного ингредиента (не optional, не toTaste, не специя),
      // которого нет в холодильнике. notIn: [] матчит всё — при пустом
      // холодильнике останутся только блюда без обязательных ингредиентов
      // (та же семантика, что была у JS-фильтра).
      const dishes = await prisma.dish.findMany({
        where: {
          ...baseWhere,
          ingredients: {
            none: {
              optional: false,
              toTaste: false,
              ingredient: {
                ignoreInFridgeFilter: false,
                id: { notIn: fridgeIngredientIds },
              },
            },
          },
        },
        include: { ingredients: { include: { ingredient: true } } },
        orderBy: { name: 'asc' },
      })

      return res.json(formatDishes(dishes))
    }

    const ingredientIds = ingredients ? ingredients.split(',').filter(Boolean) : null

    const where = {
      ...baseWhere,
      ...(ingredientIds?.length
        ? { ingredients: { some: { ingredientId: { in: ingredientIds } } } }
        : {}),
    }

    const [dishes, total] = await Promise.all([
      prisma.dish.findMany({
        where,
        include: { ingredients: { include: { ingredient: true } } },
        orderBy: { name: 'asc' },
        skip: offset,
        take: limit,
      }),
      prisma.dish.count({ where }),
    ])

    res.json({ dishes: formatDishes(dishes), total, limit, offset })
  } catch (err) {
    next(err)
  }
})

// GET /api/dishes/my
router.get('/my', auth, async (req, res, next) => {
  try {
    const dishes = await prisma.dish.findMany({
      where: { authorId: req.userId },
      include: { ingredients: { include: { ingredient: true } } },
      orderBy: { createdAt: 'desc' },
    })
    res.json(formatDishes(dishes))
  } catch (err) {
    next(err)
  }
})

// GET /api/dishes/:id
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const dish = await prisma.dish.findUnique({
      where: { id: req.params.id },
      include: { ingredients: { include: { ingredient: true } } },
    })
    if (!dish) return res.status(404).json({ error: 'Блюдо не найдено' })

    if (!await checkDishAccess(dish, req.userId)) {
      logger.warn({ action: 'dish_access_denied', dishId: req.params.id, userId: req.userId || 'guest', requestId: req.requestId }, 'dish_access_denied')
      return res.status(403).json({ error: 'Нет доступа' })
    }
    res.json(formatDish(dish))
  } catch (err) {
    next(err)
  }
})

// POST /api/dishes
router.post('/', auth, validate(dishCreate), async (req, res, next) => {
  try {
    const {
      name, description, categories, cuisine, mealTime, tags,
      cookTime, difficulty, calories, imageUrl, images, videoUrl,
      recipe, ingredients, visibility = 'PRIVATE', groupId,
    } = req.body

    if (!name?.trim()) return res.status(400).json({ error: 'Укажите название' })
    if (!categories?.length) return res.status(400).json({ error: 'Укажите категорию' })
    if (!mealTime?.length) return res.status(400).json({ error: 'Укажите время приёма пищи' })

    // Определяем groupId:
    // 1. Если передан groupId — проверяем членство и используем его
    // 2. Если visibility=FAMILY — берём семейную группу автора
    // 3. Иначе null
    let resolvedGroupId = null
    if (groupId) {
      const membership = await prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId: req.userId } },
      })
      if (!membership) return res.status(403).json({ error: 'Вы не являетесь участником этой группы' })
      resolvedGroupId = groupId
    } else if (visibility === 'FAMILY') {
      resolvedGroupId = (await getFamilyGroupIds(req.userId))[0] || null
    }

    const status = (visibility === 'PUBLIC' && req.userRole !== 'ADMIN') ? 'PENDING' : 'APPROVED'

    const dish = await prisma.dish.create({
      data: {
        name: name.trim(),
        description: description || null,
        categories: categories || [],
        cuisine: cuisine || null,
        mealTime: mealTime || [],
        tags: tags || [],
        cookTime: cookTime ? Number(cookTime) : null,
        difficulty: difficulty || null,
        calories: calories ? Number(calories) : null,
        imageUrl: imageUrl || null,
        images: images || [],
        videoUrl: videoUrl || null,
        recipe: recipe || null,
        visibility,
        status,
        authorId: req.userId,
        groupId: resolvedGroupId,
        ...(ingredients?.length ? {
          ingredients: {
            create: ingredients.map(ing => ({
              ingredientId: ing.id,
              amount: ing.amount || null,
              amountValue: ing.amountValue ? Number(ing.amountValue) : null,
              unit: ing.unit || null,
              toTaste: ing.toTaste || false,
              optional: ing.optional || false,
            })),
          },
        } : {}),
      },
      include: { ingredients: { include: { ingredient: true } } },
    })

    // Автоматический расчёт калорий если не введены вручную
    if (!calories && dish.ingredients.length) {
      const nutrition = calculateNutrition(dish.ingredients)
      if (nutrition) {
        await prisma.dish.update({ where: { id: dish.id }, data: { calories: nutrition.calories } })
        dish.calories = nutrition.calories
      }
    }

    res.status(201).json(formatDish(dish))
  } catch (err) {
    next(err)
  }
})

// POST /api/dishes/bulk — быстрое добавление нескольких блюд по названию
router.post('/bulk', auth, validate(dishBulk), async (req, res, next) => {
  try {
    const { names } = req.body
    if (!Array.isArray(names) || !names.length) {
      return res.status(400).json({ error: 'Укажите названия блюд' })
    }

    const validNames = names.map(n => n?.trim()).filter(Boolean)
    if (!validNames.length) return res.status(400).json({ error: 'Названия не могут быть пустыми' })

    // Определяем видимость: FAMILY если есть семейная группа, иначе PRIVATE
    const familyGroups = await prisma.groupMember.findMany({
      where: { userId: req.userId, group: { type: 'FAMILY' } },
      select: { groupId: true },
    })
    const familyGroupId = familyGroups[0]?.groupId || null
    const visibility = familyGroupId ? 'FAMILY' : 'PRIVATE'

    const created = await Promise.all(
      validNames.map(dishName =>
        prisma.dish.create({
          data: {
            name: dishName,
            categories: [],
            mealTime: ['ANYTIME'],
            tags: [],
            images: [],
            visibility,
            authorId: req.userId,
            groupId: familyGroupId,
          },
        })
      )
    )

    res.status(201).json({ created: created.map(d => ({ id: d.id, name: d.name })) })
  } catch (err) {
    next(err)
  }
})

// PUT /api/dishes/:id
router.put('/:id', auth, validate(dishUpdate), async (req, res, next) => {
  try {
    const dish = await prisma.dish.findUnique({ where: { id: req.params.id } })
    if (!dish) return res.status(404).json({ error: 'Блюдо не найдено' })
    if (dish.authorId !== req.userId) return res.status(403).json({ error: 'Нет доступа' })

    const {
      name, description, categories, cuisine, mealTime, tags,
      cookTime, difficulty, calories, imageUrl, images, videoUrl,
      recipe, ingredients, visibility,
    } = req.body

    // Если меняется visibility — пересчитываем groupId и status
    let resolvedGroupId = undefined
    let resolvedStatus = undefined
    if (visibility !== undefined) {
      resolvedGroupId = visibility === 'FAMILY'
        ? ((await getFamilyGroupIds(req.userId))[0] || null)
        : null
      if (visibility === 'PUBLIC' && req.userRole !== 'ADMIN') {
        resolvedStatus = 'PENDING'
      } else if (visibility !== 'PUBLIC') {
        resolvedStatus = 'APPROVED'
      }
    }

    if (ingredients !== undefined) {
      await prisma.dishIngredient.deleteMany({ where: { dishId: dish.id } })
    }

    const updated = await prisma.dish.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description: description || null }),
        ...(categories !== undefined && { categories }),
        ...(cuisine !== undefined && { cuisine: cuisine || null }),
        ...(mealTime !== undefined && { mealTime }),
        ...(tags !== undefined && { tags }),
        ...(cookTime !== undefined && { cookTime: cookTime ? Number(cookTime) : null }),
        ...(difficulty !== undefined && { difficulty: difficulty || null }),
        ...(calories !== undefined && { calories: calories ? Number(calories) : null }),
        ...(imageUrl !== undefined && { imageUrl: imageUrl || null }),
        ...(images !== undefined && { images: images || [] }),
        ...(videoUrl !== undefined && { videoUrl: videoUrl || null }),
        ...(recipe !== undefined && { recipe: recipe || null }),
        ...(visibility !== undefined && { visibility }),
        ...(resolvedStatus !== undefined && { status: resolvedStatus }),
        ...(resolvedGroupId !== undefined && { groupId: resolvedGroupId }),
        ...(ingredients?.length ? {
          ingredients: {
            create: ingredients.map(ing => ({
              ingredientId: ing.id,
              amount: ing.amount || null,
              amountValue: ing.amountValue ? Number(ing.amountValue) : null,
              unit: ing.unit || null,
              toTaste: ing.toTaste || false,
              optional: ing.optional || false,
            })),
          },
        } : {}),
      },
      include: { ingredients: { include: { ingredient: true } } },
    })

    // Пересчитать калории если ингредиенты изменились и calories не передан вручную
    if (ingredients !== undefined && !calories && updated.ingredients.length) {
      const nutrition = calculateNutrition(updated.ingredients)
      if (nutrition) {
        await prisma.dish.update({ where: { id: updated.id }, data: { calories: nutrition.calories } })
        updated.calories = nutrition.calories
      }
    }

    res.json(formatDish(updated))
  } catch (err) {
    next(err)
  }
})

// DELETE /api/dishes/:id
router.delete('/:id', auth, async (req, res, next) => {
  try {
    const dish = await prisma.dish.findUnique({ where: { id: req.params.id } })
    if (!dish) return res.status(404).json({ error: 'Блюдо не найдено' })
    if (dish.authorId !== req.userId) return res.status(403).json({ error: 'Нет доступа' })
    await prisma.dish.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// GET /api/dishes/:id/recommendations
router.get('/:id/recommendations', optionalAuth, async (req, res, next) => {
  try {
    const { id } = req.params

    const dish = await prisma.dish.findUnique({
      where: { id },
      include: { ingredients: { select: { ingredientId: true, toTaste: true } } },
    })
    if (!dish) return res.status(404).json({ error: 'Блюдо не найдено' })

    if (!await checkDishAccess(dish, req.userId)) {
      return res.status(403).json({ error: 'Нет доступа' })
    }

    const dishIngIds = dish.ingredients.filter(di => !di.toTaste).map(di => di.ingredientId)
    const dishIngIdSet = new Set(dishIngIds)

    const visibilityFilter = await buildVisibilityFilter(req.userId)

    // Похожие: кандидаты сужаются на стороне БД до блюд с >= 1 общим
    // ингредиентом, точный порог (>= 2) и сортировка — в JS на малом наборе
    const similarCandidates = dishIngIds.length
      ? await prisma.dish.findMany({
          where: {
            ...visibilityFilter,
            id: { not: id },
            ingredients: { some: { toTaste: false, ingredientId: { in: dishIngIds } } },
          },
          include: { ingredients: { include: { ingredient: true } } },
        })
      : []

    const similar = similarCandidates
      .map(d => {
        const overlap = d.ingredients.filter(di => !di.toTaste && dishIngIdSet.has(di.ingredientId)).length
        return { d, overlap }
      })
      .filter(({ overlap }) => overlap >= 2)
      .sort((a, b) => b.overlap - a.overlap)
      .slice(0, 6)
      .map(({ d }) => formatDish(d))

    if (!req.userId) {
      return res.json({ similar, fromFridge: null, nearMatch: null })
    }

    // Семейный холодильник или личный
    const familyMembership = await prisma.groupMember.findFirst({
      where: { userId: req.userId, group: { type: 'FAMILY' } },
      select: { groupId: true },
    })
    const fridgeWhere = familyMembership
      ? { groupId: familyMembership.groupId }
      : { userId: req.userId, groupId: null }
    const fridgeItems = await prisma.fridgeItem.findMany({ where: fridgeWhere, select: { ingredientId: true } })
    const fridgeIds = fridgeItems.map(f => f.ingredientId)
    const fridgeIdSet = new Set(fridgeIds)

    // Из холодильника: есть >= 1 обязательный ингредиент и ни одного
    // обязательного вне холодильника — целиком на стороне БД
    const fromFridgeDishes = await prisma.dish.findMany({
      where: {
        ...visibilityFilter,
        id: { not: id },
        ingredients: {
          some: { optional: false, toTaste: false, ingredient: { ignoreInFridgeFilter: false } },
          none: {
            optional: false,
            toTaste: false,
            ingredient: { ignoreInFridgeFilter: false, id: { notIn: fridgeIds } },
          },
        },
      },
      include: { ingredients: { include: { ingredient: true } } },
      take: 6,
    })
    const fromFridge = formatDishes(fromFridgeDishes)

    // nearMatch: 1–3 недостающих обязательных ингредиента. Первый запрос —
    // только id + обязательные ингредиенты (лёгкие строки), полные блюда
    // догружаются вторым запросом по 6 отобранным id
    const nearCandidates = await prisma.dish.findMany({
      where: { ...visibilityFilter, id: { not: id } },
      select: {
        id: true,
        ingredients: {
          where: { optional: false, toTaste: false, ingredient: { ignoreInFridgeFilter: false } },
          select: {
            ingredientId: true,
            ingredient: { select: { nameRu: true, emoji: true } },
          },
        },
      },
    })

    const nearPicked = nearCandidates
      .map(d => ({ id: d.id, missing: d.ingredients.filter(di => !fridgeIdSet.has(di.ingredientId)) }))
      .filter(({ missing }) => missing.length >= 1 && missing.length <= 3)
      .sort((a, b) => a.missing.length - b.missing.length)
      .slice(0, 6)

    const nearDishes = nearPicked.length
      ? await prisma.dish.findMany({
          where: { id: { in: nearPicked.map(p => p.id) } },
          include: { ingredients: { include: { ingredient: true } } },
        })
      : []
    const nearDishMap = new Map(nearDishes.map(d => [d.id, d]))
    const nearMatch = nearPicked
      .filter(p => nearDishMap.has(p.id))
      .map(p => ({
        dish: formatDish(nearDishMap.get(p.id)),
        missing: p.missing.map(di => ({ name: di.ingredient.nameRu, emoji: di.ingredient.emoji })),
      }))

    res.json({ similar, fromFridge, nearMatch })
  } catch (err) {
    next(err)
  }
})

const VALID_MEALTYPES = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK', 'ANYTIME']
const MEALTIME_STRING_MAP = { breakfast: 'BREAKFAST', lunch: 'LUNCH', dinner: 'DINNER', snack: 'SNACK', anytime: 'ANYTIME' }

function normalizeMealTime(mt) {
  if (!mt) return null
  return VALID_MEALTYPES.includes(mt) ? mt : (MEALTIME_STRING_MAP[mt.toLowerCase()] || null)
}

function buildBaseFilter({ mealTime, category, tags, cuisine, difficulty }) {
  const where = {}
  if (mealTime) {
    const mt = normalizeMealTime(mealTime)
    if (mt) where.mealTime = { has: mt }
  }
  if (category) where.categories = { has: category }
  if (cuisine) where.cuisine = { contains: cuisine, mode: 'insensitive' }
  if (tags) {
    const tagList = tags.split(',').filter(Boolean)
    if (tagList.length) where.tags = { hasSome: tagList }
  }
  if (difficulty) where.difficulty = difficulty
  return where
}

function formatDish(dish) {
  const nutrition = dish.ingredients?.length ? calculateNutrition(dish.ingredients) : null
  return {
    id: dish.id,
    name: dish.name,
    description: dish.description,
    categories: dish.categories,
    cuisine: dish.cuisine,
    mealTime: dish.mealTime,
    tags: dish.tags,
    cookTime: dish.cookTime,
    difficulty: dish.difficulty,
    calories: dish.calories,
    nutrition,
    imageUrl: dish.imageUrl,
    images: dish.images || [],
    videoUrl: dish.videoUrl,
    recipe: dish.recipe,
    visibility: dish.visibility,
    authorId: dish.authorId,
    groupId: dish.groupId,
    ingredients: dish.ingredients.map(di => ({
      id: di.ingredient.id,
      name: di.ingredient.nameRu,
      nameEn: di.ingredient.nameEn ?? null,
      emoji: di.ingredient.emoji,
      amount: di.amount,
      amountValue: di.amountValue,
      unit: di.unit,
      toTaste: di.toTaste,
      optional: di.optional,
      isBasic: di.ingredient.isBasic || false,
    })),
  }
}

function formatDishes(dishes) {
  return dishes.map(formatDish)
}

module.exports = router
