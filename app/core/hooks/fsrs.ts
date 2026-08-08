import { type Card, type CardInput, FSRS, type Grade, Rating } from 'ts-fsrs'
import { useSettingStore } from '../stores/setting.ts'

export function useGetGradeByWrongTimes() {
  let store = useSettingStore()
  function getGradeByWrongTimes(wrongTimes?: number): Rating {
    if (wrongTimes !== undefined) {
      if (wrongTimes <= store.fsrsEasyLimit) return Rating.Easy
      else if (wrongTimes <= store.fsrsGoodLimit) return Rating.Good
      else if (wrongTimes <= store.fsrsHardLimit) return Rating.Hard
      else return Rating.Again
    } else {
      return Rating.Easy
    }
  }
  return { getGradeByWrongTimes }
}

export function useNextCard() {
  let store = useSettingStore()
  let fsrs = new FSRS(store.fsrsParameters)
  function nextCard(card: CardInput | Card, grade: Grade): Card {
    return fsrs.next(card, new Date(), grade).card
  }
  return { nextCard }
}
