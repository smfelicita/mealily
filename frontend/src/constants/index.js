// Справочники приложения. Метки локализованы через t().
// Поле `label` оставлено как fallback (показывается если t() не вернёт значение
// — например, в тестах или если страница не пробрасывает useTranslation).
// В компонентах используем формат: t(`common:dishCategory.${value}`).

export const UNITS = ['г', 'кг', 'мл', 'л', 'шт', 'зубчик', 'пучок', 'щепотка', 'ст.л.', 'ч.л.']

// Маппинг unit → ключ в common.units (для t())
export const UNIT_I18N_KEY = {
  'г':       'gram',
  'кг':      'kg',
  'мл':      'ml',
  'л':       'litre',
  'шт':      'piece',
  'зубчик':  'garlicClove',
  'пучок':   'bunch',
  'щепотка': 'pinch',
  'ст.л.':   'tablespoon',
  'ч.л.':    'teaspoon',
}

// Метки через t('common:dishCategory.<value>')
export const DISH_CATEGORIES = [
  { value: 'SOUP'    },
  { value: 'SALAD'   },
  { value: 'MAIN'    },
  { value: 'SIDE'    },
  { value: 'DESSERT' },
  { value: 'DRINK'   },
  { value: 'BAKERY'  },
  { value: 'SAUCE'   },
]

// Метки через t('common:mealTimeShort.<value>')
export const MEAL_TIMES = [
  { value: 'BREAKFAST' },
  { value: 'LUNCH'     },
  { value: 'DINNER'    },
  { value: 'SNACK'     },
  { value: 'ANYTIME'   },
]

export const DIFFICULTIES = [
  { value: 'easy',   label: 'Легко'  },
  { value: 'medium', label: 'Средне' },
  { value: 'hard',   label: 'Сложно' },
]

// Кухни: на UI показываем через t(`common:cuisines.${slug}`).
// Бэк хранит cuisine как произвольную строку — здесь только пресеты для chip-выбора.
export const CUISINE_PRESETS = [
  { value: 'Русская',           i18nKey: 'russian'       },
  { value: 'Итальянская',       i18nKey: 'italian'       },
  { value: 'Азиатская',         i18nKey: 'asian'         },
  { value: 'Средиземноморская', i18nKey: 'mediterranean' },
  { value: 'Греческая',         i18nKey: 'greek'         },
  { value: 'Французская',       i18nKey: 'french'        },
  { value: 'Мексиканская',      i18nKey: 'mexican'       },
  { value: 'Японская',          i18nKey: 'japanese'      },
  { value: 'Индийская',         i18nKey: 'indian'        },
  { value: 'Европейская',       i18nKey: 'european'      },
  { value: 'Американская',      i18nKey: 'american'      },
]

// Старый формат — массив строк, оставлен для обратной совместимости.
export const CUISINES = CUISINE_PRESETS.map(c => c.value)

export const ING_CATEGORIES = [
  { value: 'dairy',     label: 'Молочное' },
  { value: 'meat',      label: 'Мясо'     },
  { value: 'fish',      label: 'Рыба'     },
  { value: 'vegetable', label: 'Овощи'    },
  { value: 'fruit',     label: 'Фрукты'   },
  { value: 'grain',     label: 'Злаки'    },
  { value: 'legume',    label: 'Бобовые'  },
  { value: 'egg',       label: 'Яйца'     },
  { value: 'bread',     label: 'Хлеб'     },
  { value: 'oil',       label: 'Масла'    },
  { value: 'sauce',     label: 'Соусы'    },
  { value: 'spice',     label: 'Специи'   },
  { value: 'herb',      label: 'Зелень'   },
  { value: 'nut',       label: 'Орехи'    },
  { value: 'sweetener', label: 'Сладкое'  },
  { value: 'canned',    label: 'Консервы' },
  { value: 'other',     label: 'Другое'   },
]

export const VISIBILITY_OPTIONS = [
  { value: 'PRIVATE',    label: 'Личный',         desc: 'Только вы'                        },
  { value: 'FAMILY',     label: 'Семья',          desc: 'Только участники семейной группы' },
  { value: 'ALL_GROUPS', label: 'Все мои группы', desc: 'Участники всех ваших групп'       },
]

// Метки через t('plan:meal.<value>') — эмодзи уже в locale
export const PLAN_MEAL_TYPES = [
  { value: 'BREAKFAST' },
  { value: 'LUNCH'     },
  { value: 'DINNER'    },
  { value: 'SNACK'     },
  { value: 'ANYTIME'   },
]
