import type {
    ActionPointCost,
    SquaddieAction,
} from "../logic/src/squaddieAction/squaddieAction.js"
import type { SquaddieActionValidity } from "../logic/src/squaddieAction/calculate/validity/squaddieActionValidationService.js"
import type { SerializedForecastedActionResult } from "../logic/src/squaddieAction/calculate/result/squaddieActionResultCalculator.js"
import type { TDegreeOfSuccess } from "../logic/src/degreesOfSuccess/degreeOfSuccess.js"

export const SquaddieActionInspector = {
    formatActionPointCost: (cost: ActionPointCost | undefined) =>
        formatActionPointCost(cost),
    formatSquaddieActions: (
        validity: SquaddieActionValidity,
        actionsById: Map<string, SquaddieAction>
    ) => formatSquaddieActions(validity, actionsById),
    buildCombatActionIndex: (validity: SquaddieActionValidity): string[] =>
        buildCombatActionIndex(validity),
    formatSquaddieActionsWithKeys: (
        validity: SquaddieActionValidity,
        actionsById: Map<string, SquaddieAction>
    ) => formatSquaddieActionsWithKeys(validity, actionsById),
    formatForecast: (
        forecasts: SerializedForecastedActionResult[],
        targetName: string
    ) => formatForecast(forecasts, targetName),
}

const formatActionPointCost = (cost: ActionPointCost | undefined): string => {
    if (cost == undefined || cost === 0) {
        return ""
    }
    if (cost === "all") {
        return " (all AP)"
    }
    return ` (${cost} AP)`
}

const formatSquaddieActions = (
    validity: SquaddieActionValidity,
    actionsById: Map<string, SquaddieAction>
): string => {
    const { invalidActions, validActions } = validity

    if (invalidActions.length === 0 && validActions.length === 0) {
        return ""
    }

    const lines: string[] = ["Actions:"]

    if (invalidActions.length > 0) {
        lines.push("  Invalid:")
        for (const action of invalidActions) {
            lines.push(`    ${action.actionName} - ${action.reason}`)
        }
    }

    if (validActions.length > 0) {
        lines.push("  Valid:")
        for (const action of validActions) {
            const squaddieAction = actionsById.get(action.actionId)
            const cost =
                squaddieAction?.effectOnActor.SUCCESS?.actionPoints?.spent
            const costSuffix = formatActionPointCost(cost)
            lines.push(`    ${action.actionName}${costSuffix}`)
        }
    }

    return lines.join("\n")
}

const buildCombatActionIndex = (
    validity: SquaddieActionValidity
): string[] => {
    const defaultActionIds = new Set(["default-move", "default-end-turn"])
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

const formatSquaddieActionsWithKeys = (
    validity: SquaddieActionValidity,
    actionsById: Map<string, SquaddieAction>
): string => {
    const { validActions, invalidActions } = validity

    if (validActions.length === 0 && invalidActions.length === 0) {
        return ""
    }

    const lines: string[] = ["Actions:"]
    const combatIndex = buildCombatActionIndex(validity)
    const invalidMap = new Map(invalidActions.map((a) => [a.actionId, a]))
    const validMap = new Map(validActions.map((a) => [a.actionId, a]))

    for (let i = 0; i < combatIndex.length; i++) {
        const actionId = combatIndex[i]
        const key = `A${i + 1}`
        const squaddieAction = actionsById.get(actionId)
        const cost = squaddieAction?.effectOnActor.SUCCESS?.actionPoints?.spent
        const costSuffix = formatActionPointCost(cost)

        const validAction = validMap.get(actionId)
        const invalidAction = invalidMap.get(actionId)
        const actionName =
            validAction?.actionName ?? invalidAction?.actionName ?? actionId

        if (invalidAction == undefined) {
            lines.push(`  ${key} - ${actionName}${costSuffix}`)
        } else {
            lines.push(
                `  ${key} - ${actionName}${costSuffix} [${invalidAction.reason}]`
            )
        }
    }

    const endTurnValid = validMap.get("default-end-turn")
    if (endTurnValid != undefined) {
        const squaddieAction = actionsById.get("default-end-turn")
        const cost = squaddieAction?.effectOnActor.SUCCESS?.actionPoints?.spent
        const costSuffix = formatActionPointCost(cost)
        lines.push(`  AE - ${endTurnValid.actionName}${costSuffix}`)
    }

    const moveValid = validMap.get("default-move")
    if (moveValid != undefined) {
        lines.push(`  AM - ${moveValid.actionName}`)
    }

    return lines.join("\n")
}

const formatDegreeLabel = (degree: TDegreeOfSuccess): string => {
    if (degree === "CRITICAL") return "Critical"
    if (degree === "SUCCESS") return "Success"
    if (degree === "FAILURE") return "Failure"
    if (degree === "BOTCH") return "Botch"
    return degree
}

const formatForecast = (
    forecasts: SerializedForecastedActionResult[],
    targetName: string
): string => {
    const lines: string[] = [`Forecast for ${targetName}:`]

    for (const forecast of forecasts) {
        const chance = `${forecast.chanceOutOf36}/36`
        const degree = formatDegreeLabel(forecast.degreeOfSuccess)

        const damageResult = forecast.squaddieActionResults.find(
            (r) => r.damage != undefined
        )
        const healingResult = forecast.squaddieActionResults.find(
            (r) => r.healing != undefined
        )

        let effectDesc = "no effect"
        if (damageResult?.damage != undefined) {
            const { net, willKo } = damageResult.damage
            effectDesc = `${net} damage`
            if (willKo) effectDesc += " (will KO)"
        } else if (healingResult?.healing != undefined) {
            effectDesc = `heals ${healingResult.healing.net} HP`
        }

        lines.push(`  ${chance} ${degree} → ${effectDesc}`)
    }

    return lines.join("\n")
}
