import type {
    ActionPointCost,
    SquaddieAction,
} from "../logic/src/squaddieAction/squaddieAction.js"
import type { SquaddieActionValidity } from "../logic/src/squaddieAction/calculate/validity/squaddieActionValidationService.js"

export const SquaddieActionInspector = {
    formatActionPointCost: (cost: ActionPointCost | undefined) => formatActionPointCost(cost),
    formatSquaddieActions: (
        validity: SquaddieActionValidity,
        actionsById: Map<string, SquaddieAction>
    ) => formatSquaddieActions(validity, actionsById),
}

const formatActionPointCost = (
    cost: ActionPointCost | undefined
): string => {
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
