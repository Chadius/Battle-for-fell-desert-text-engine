import { SquaddieActionService } from "../logic/src/squaddieAction/squaddieAction.js"
import type { SquaddieActionValidity } from "../logic/src/squaddieAction/calculate/validity/squaddieActionValidationService.js"

export const DEFAULT_MOVE_ACTION_ID = SquaddieActionService.defaultMove().id
export const DEFAULT_END_TURN_ACTION_ID = SquaddieActionService.defaultEndTurn().id

export const combatActionIndex = (
    validity: SquaddieActionValidity
): string[] => {
    const defaultActionIds = new Set([DEFAULT_MOVE_ACTION_ID, DEFAULT_END_TURN_ACTION_ID])
    const seen = new Set<string>()
    const ids: string[] = []

    for (const action of [
        ...validity.validActions,
        ...validity.invalidActions,
    ]) {
        if (!defaultActionIds.has(action.actionId) && !seen.has(action.actionId)) {
            seen.add(action.actionId)
            ids.push(action.actionId)
        }
    }

    return ids.sort((a, b) => a.localeCompare(b))
}
