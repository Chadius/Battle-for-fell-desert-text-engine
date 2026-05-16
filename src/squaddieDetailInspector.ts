import type {
    SquaddieCondition,
    TSquaddieConditionType,
} from "../logic/src/proficiency/squaddieCondition.js"
import { SquaddieConditionType } from "../logic/src/proficiency/squaddieCondition.js"

const conditionTypeDisplayNames: Record<TSquaddieConditionType, string> = {
    [SquaddieConditionType.UNKNOWN]: "Unknown",
    [SquaddieConditionType.ABSORB]: "Absorb",
    [SquaddieConditionType.ARMOR]: "Armor",
    [SquaddieConditionType.ELUSIVE]: "Elusive",
    [SquaddieConditionType.FRIGHTENED]: "Frightened",
    [SquaddieConditionType.OFF_GUARD]: "Off Guard",
    [SquaddieConditionType.SLOWED]: "Slowed",
    [SquaddieConditionType.HUSTLE]: "Hustle",
}

export const conditionTypeName = (type: TSquaddieConditionType): string => {
    return conditionTypeDisplayNames[type]
}

export const formatCondition = (condition: SquaddieCondition): string => {
    let result = conditionTypeName(condition.type)

    if (condition.amount != undefined) {
        result += `: ${condition.amount.current}`
    }

    if (condition.limit.duration != undefined) {
        result += ` (${condition.limit.duration.duration} turns remaining)`
    }

    return result
}

export const formatSquaddieDetails = (
    conditions: SquaddieCondition[]
): string => {
    if (conditions.length === 0) {
        return ""
    }

    const conditionLines = conditions.map(
        (condition) => `  ${formatCondition(condition)}`
    )
    return `Conditions:\n${conditionLines.join("\n")}`
}
