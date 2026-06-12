// ЕДИНАЯ логика видимости блюд для backend и telegram-бота.
// Вынесено из backend/src/routes/dishes.js — там остались тонкие обёртки.
// Правила (см. CLAUDE.md): PUBLIC (+APPROVED) — все; PRIVATE — автор;
// FAMILY — участники FAMILY-группы; ALL_GROUPS — участники любых групп автора.

async function getMemberGroupIds(prisma, userId) {
  if (!userId) return []
  const memberships = await prisma.groupMember.findMany({
    where: { userId },
    select: { groupId: true },
  })
  return memberships.map(m => m.groupId)
}

async function getFamilyGroupIds(prisma, userId) {
  if (!userId) return []
  const groups = await prisma.groupMember.findMany({
    where: { userId, group: { type: 'FAMILY' } },
    select: { groupId: true },
  })
  return groups.map(g => g.groupId)
}

// Prisma-фильтр (where) — какие блюда видит пользователь
async function buildVisibilityFilter(prisma, userId) {
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

// Точечная проверка доступа к одному блюду
async function checkDishAccess(prisma, dish, userId) {
  if (dish.visibility === 'PUBLIC' && dish.status === 'APPROVED') return true
  if (dish.authorId === userId) return true
  const groupIds = await getMemberGroupIds(prisma, userId)
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

module.exports = { getMemberGroupIds, getFamilyGroupIds, buildVisibilityFilter, checkDishAccess }
