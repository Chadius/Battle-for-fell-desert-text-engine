import { type ActionPointCost } from "../logic/src/squaddieAction/squaddieAction.js"
import { combatActionIndex, DEFAULT_END_TURN_ACTION_ID, DEFAULT_MOVE_ACTION_ID } from "./actionKeyIndex.js"
import type { SquaddieActionValidity } from "../logic/src/squaddieAction/calculate/validity/squaddieActionValidationService.js"
import type {
    ActionModifierBreakdown,
    SerializedForecastedActionResult,
} from "../logic/src/squaddieAction/calculate/result/squaddieActionResultCalculator.js"
import type { TDegreeOfSuccess } from "../logic/src/degreesOfSuccess/degreeOfSuccess.js"

export const SquaddieActionInspector = {
    actionCostSuffix: (
        cost: ActionPointCost | undefined,
        cooldownTurns?: number,
        usesPerTurn?: number,
        usesPerMission?: number
    ) => actionCostSuffix(cost, cooldownTurns, usesPerTurn, usesPerMission),
    squaddieActionsText: (
        validity: SquaddieActionValidity,
    ) => squaddieActionsText(validity),
    squaddieActionsWithKeysText: (
        validity: SquaddieActionValidity,
    ) => squaddieActionsWithKeysText(validity),
    forecastText: (
        forecasts: SerializedForecastedActionResult[],
        targetName: string
    ) => forecastText(forecasts, targetName),
}

const actionCostSuffix = (
    cost: ActionPointCost | undefined,
    cooldownTurns?: number,
    usesPerTurn?: number,
    usesPerMission?: number
): string => {
    const parts: string[] = []
    if (cost === "all") {
        parts.push("all AP")
    } else if (cost != undefined && cost !== 0) {
        parts.push(`${cost} AP`)
    }
    if (cooldownTurns != undefined) {
        parts.push(`${cooldownTurns}-turn cooldown`)
    }
    if (usesPerTurn != undefined) {
        parts.push(`${usesPerTurn}x/turn`)
    }
    if (usesPerMission != undefined) {
        parts.push(`${usesPerMission}x/mission`)
    }
    if (parts.length === 0) return ""
    return ` (${parts.join(", ")})`
}

const squaddieActionsText = (
    validity: SquaddieActionValidity,
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
            lines.push(`    ${action.actionName}${actionCostSuffix(action.apCost, action.cooldownTurns, action.usesPerTurn, action.usesPerMission)}`)
        }
    }

    return lines.join("\n")
}

const squaddieActionsWithKeysText = (
    validity: SquaddieActionValidity,
): string => {
    const { validActions, invalidActions } = validity

    if (validActions.length === 0 && invalidActions.length === 0) {
        return ""
    }

    const lines: string[] = ["Actions:"]
    const combatIndex = combatActionIndex(validity)
    const invalidMap = new Map(invalidActions.map((a) => [a.actionId, a]))
    const validMap = new Map(validActions.map((a) => [a.actionId, a]))

    for (let i = 0; i < combatIndex.length; i++) {
        const actionId = combatIndex[i]
        const key = `A${i + 1}`

        const validAction = validMap.get(actionId)
        const invalidAction = invalidMap.get(actionId)
        const resolvedAction = validAction ?? invalidAction
        const actionName = resolvedAction?.actionName ?? actionId
        const suffix = actionCostSuffix(
            resolvedAction?.apCost,
            resolvedAction?.cooldownTurns,
            resolvedAction?.usesPerTurn,
            resolvedAction?.usesPerMission
        )

        if (invalidAction == undefined) {
            lines.push(`  ${key} - ${actionName}${suffix}`)
        } else {
            lines.push(`  ${key} - ${actionName}${suffix} [${invalidAction.reason}]`)
        }
    }

    const endTurnValid = validMap.get(DEFAULT_END_TURN_ACTION_ID)
    if (endTurnValid != undefined) {
        lines.push(`  AE - ${endTurnValid.actionName}${actionCostSuffix(endTurnValid.apCost, endTurnValid.cooldownTurns, endTurnValid.usesPerTurn, endTurnValid.usesPerMission)}`)
    }

    const moveValid = validMap.get(DEFAULT_MOVE_ACTION_ID)
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

const formatModifierBreakdown = (
    breakdown: ActionModifierBreakdown
): string => {
    const {
        actorProficiencyBonus,
        targetDefensiveBonus,
        multipleAttackPenalty,
        netModifier,
        isFlankingTarget,
        actorFrightenedPenalty,
        targetFrightenedPenalty,
    } = breakdown

    const formatNumber = (bonus: number): string => {
        if (bonus > 0) {
            return `+${bonus}`
        }
        if (bonus < 0) {
            return `${bonus}`
        }
        return `±0`
    }

    const proficiencyStr = "proficiency " + formatNumber(actorProficiencyBonus)
    const defenseStr = "defense " + formatNumber(targetDefensiveBonus)
    const mapStr = "MAP " + formatNumber(-multipleAttackPenalty)

    const parts = [proficiencyStr, defenseStr, mapStr]
    if (isFlankingTarget) parts.push("flanking")
    if (actorFrightenedPenalty != undefined && actorFrightenedPenalty > 0)
        parts.push(`actor frightened -${actorFrightenedPenalty}`)
    if (targetFrightenedPenalty != undefined && targetFrightenedPenalty > 0)
        parts.push(`target frightened +${targetFrightenedPenalty}`)

    const netStr =
        netModifier === 0
            ? "±0"
            : `${netModifier >= 0 ? "+" : ""}${netModifier}`
    return `  Attack modifier: ${netStr} (${parts.join(", ")})`
}

const isBreakdownNotable = (breakdown: ActionModifierBreakdown): boolean =>
    breakdown.multipleAttackPenalty > 0 ||
    breakdown.isFlankingTarget ||
    (breakdown.actorFrightenedPenalty != undefined && breakdown.actorFrightenedPenalty > 0) ||
    (breakdown.targetFrightenedPenalty != undefined && breakdown.targetFrightenedPenalty > 0)

const forecastText = (
    forecasts: SerializedForecastedActionResult[],
    targetName: string
): string => {
    const lines: string[] = [`Forecast for ${targetName}:`]

    // Display modifier breakdown when MAP is active or when flanking the target
    const firstNotable = forecasts.find(
        (f) =>
            f.modifierBreakdown != undefined &&
            isBreakdownNotable(f.modifierBreakdown)
    )
    if (firstNotable?.modifierBreakdown != undefined) {
        lines.push(formatModifierBreakdown(firstNotable.modifierBreakdown))
    }

    for (const forecast of forecasts) {
        const chance = `${forecast.chanceOutOf36}/36`
        const degree = formatDegreeLabel(forecast.degreeOfSuccess)

        const damageResult = forecast.squaddieActionResults.find(
            (r) => r.damage != undefined
        )
        const healingResult = forecast.squaddieActionResults.find(
            (r) => r.healing != undefined
        )
        // Check for condition-only outcomes (e.g., Blessing applies ARMOR)
        const conditionResult = forecast.squaddieActionResults.find(
            (r) => r.conditionsAdded != undefined && r.conditionsAdded.length > 0
        )
        // Check for forced movement (e.g., Gravity Pull)
        const movementResult = forecast.squaddieActionResults.find(
            (r) => r.movement != undefined
        )

        let effectDesc = "no effect"
        if (damageResult?.damage != undefined) {
            const { net, willKo, sneakAttackDamage } = damageResult.damage
            effectDesc = `${net} damage`
            if (sneakAttackDamage != undefined && sneakAttackDamage > 0) {
                effectDesc += ` (incl. ${sneakAttackDamage} sneak attack)`
            }
            if (willKo) effectDesc += " (will KO)"
        } else if (healingResult?.healing != undefined) {
            effectDesc = `heals ${healingResult.healing.net} HP`
        } else if (conditionResult?.conditionsAdded != undefined) {
            effectDesc = conditionResult.conditionsAdded
                .map((c) => {
                    let desc = `gains ${c.type}`
                    if (c.amount?.current != undefined) desc += ` ${c.amount.current}`
                    if (c.limit.duration?.duration != undefined) {
                        const turns = c.limit.duration.duration
                        desc += ` for ${turns} ${turns === 1 ? "turn" : "turns"}`
                    }
                    return desc
                })
                .join(", ")
        } else if (movementResult?.movement != undefined) {
            const steps = movementResult.movement.expectedPath.steps
            if (steps.length === 1) {
                // Teleport path has exactly 1 step (the destination); forced movement always has 2+
                // (START at origin + WALK steps). A 0-tile forced move returns no result at all.
                const { row, col } = steps[0]
                effectDesc = `teleported to (${row}, ${col})`
            } else {
                const tilesPulled = steps.length - 1
                effectDesc = `pulled ${tilesPulled} ${tilesPulled === 1 ? "tile" : "tiles"} toward actor`
            }
        }

        lines.push(`  ${chance} ${degree} → ${effectDesc}`)
    }

    return lines.join("\n")
}
