import { useTranslation } from 'react-i18next'

// values — uppercase, соответствуют enum MealTime в БД
const MEAL_TIME_VALUES = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK']

export default function MealTypeChips({ active, onChange, multi = false, showAll = false }) {
  const { t } = useTranslation('common')

  const options = showAll
    ? [{ value: '', label: t('mealAll') }, ...MEAL_TIME_VALUES.map(v => ({ value: v, label: t(`mealTimeShort.${v}`) }))]
    : MEAL_TIME_VALUES.map(v => ({ value: v, label: t(`mealTimeShort.${v}`) }))

  function handleClick(value) {
    if (multi) {
      const current = active || []
      onChange(current.includes(value) ? current.filter(v => v !== value) : [...current, value])
    } else {
      onChange(active === value ? '' : value)
    }
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
      {options.map(mt => {
        const isActive = multi
          ? (active || []).includes(mt.value)
          : active === mt.value || (mt.value === '' && !active)

        return (
          <button
            key={mt.value}
            type="button"
            onClick={() => handleClick(mt.value)}
            className={[
              'shrink-0 px-4 py-1.5 rounded-xl text-sm2 font-medium transition-all',
              'focus:outline-none whitespace-nowrap border',
              isActive
                ? 'bg-sage text-white border-transparent'
                : 'bg-white text-text-2 border-border/60',
            ].join(' ')}
          >
            {mt.label}
          </button>
        )
      })}
    </div>
  )
}
