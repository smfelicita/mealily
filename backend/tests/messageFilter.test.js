// Тесты фильтра сообщений ИИ-чата (src/lib/messageFilter.js).
// Фильтр должен пропускать вопросы про еду и блокировать офтопик
// (политику, крипту, кино и т.д.), чтобы не тратить деньги на API.

import { describe, it, expect } from 'vitest'
import { checkMessageRelevance } from '../src/lib/messageFilter.js'

describe('checkMessageRelevance', () => {
  it('пропускает вопрос про рецепт', () => {
    expect(checkMessageRelevance('Подскажи рецепт борща со свининой').allowed).toBe(true)
  })

  it('пропускает вопрос «что приготовить»', () => {
    expect(checkMessageRelevance('Что приготовить на ужин из курицы и риса?').allowed).toBe(true)
  })

  it('пропускает короткие реплики-продолжения («да», «спасибо»)', () => {
    expect(checkMessageRelevance('да, давай').allowed).toBe(true)
    expect(checkMessageRelevance('спасибо!').allowed).toBe(true)
  })

  it('блокирует политику', () => {
    const r = checkMessageRelevance('Расскажи про последние выборы президента и парламент')
    expect(r.allowed).toBe(false)
    expect(r.reason).toBeTruthy()
  })

  it('блокирует криптовалюту', () => {
    expect(checkMessageRelevance('Стоит ли сейчас покупать биткоин на бирже?').allowed).toBe(false)
  })

  it('блокирует кино', () => {
    expect(checkMessageRelevance('Посоветуй интересный фильм или сериал на вечер').allowed).toBe(false)
  })

  it('еда побеждает офтопик: «ужин как в фильме» — это про еду', () => {
    // FOOD_SAFE_PATTERNS проверяются раньше OFF_TOPIC — слово «ужин» разрешает
    expect(checkMessageRelevance('Хочу приготовить ужин как в том фильме про повара').allowed).toBe(true)
  })

  it('нейтральные сообщения пропускаются', () => {
    expect(checkMessageRelevance('А можно сделать это побыстрее как-нибудь?').allowed).toBe(true)
  })

  // Ловушки русской морфологии: «рак» (болезнь) не должен блокировать раков (еда),
  // «обед» не должен находиться внутри «победы», «мороз» — внутри «морозилки»
  it('не блокирует раков как еду', () => {
    expect(checkMessageRelevance('посоветуй что-нибудь вкусное с раками к пиву').allowed).toBe(true)
  })

  it('блокирует склонения: «политикой», «биткоинами»', () => {
    expect(checkMessageRelevance('давай поговорим о политике и президентских делах').allowed).toBe(false)
  })

  it('«морозилка» — это про еду, а не про мороз', () => {
    expect(checkMessageRelevance('у меня морозилка забита, помоги разобрать').allowed).toBe(true)
  })
})
