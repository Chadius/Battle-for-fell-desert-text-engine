import type {MissionEngine} from "../logic/src/mission/missionEngine/missionEngine.js"
import type {ActionResult} from "../logic/src/mission/actionResult.js"
import type {SquaddieActionResult} from "../logic/src/squaddieAction/calculate/result/squaddieActionResult.js"
import type {TDegreeOfSuccess} from "../logic/src/degreesOfSuccess/degreeOfSuccess.js"
import type {TargetResult} from "../logic/src/mission/targetResult.js"

export const ActionResultInspector = {
    formatActionResults: (result: ActionResult, engine: MissionEngine): string =>
        formatActionResults(result, engine),
}

const formatDegreeOfSuccess = (degree: TDegreeOfSuccess): string => {
    if (degree === "CRITICAL") return "Critical"
    if (degree === "SUCCESS") return "Success"
    if (degree === "FAILURE") return "Failure"
    if (degree === "BOTCH") return "Botch"
    return degree
}

const getSquaddieName = (
    squaddieResult: SquaddieActionResult,
    engine: MissionEngine
): string => {
    const info = engine.getSquaddieInfo({
        inBattleSquaddieId: squaddieResult.inBattleSquaddieId,
        outOfBattleSquaddieId: squaddieResult.outOfBattleSquaddieId,
    })
    return info.name
}

const formatDamageLines = (
    squaddieResult: SquaddieActionResult,
    name: string
): string[] => {
    if (squaddieResult.damage == undefined) return []
    const {net, absorbed, willKo} = squaddieResult.damage
    let takeDamage: string = `  ${name} takes ${net} damage`
    if (absorbed > 0) {
        takeDamage += ` (absorbed ${absorbed}).`
    }
    const lines: string[] = [takeDamage]
    if (willKo) {
        lines.push(`  ${name} is knocked out!`)
    }
    return lines
}

const formatHealingLines = (
    squaddieResult: SquaddieActionResult,
    name: string
): string[] => {
    if (squaddieResult.healing == undefined) return []
    return [`  ${name} heals ${squaddieResult.healing.net} HP.`]
}

const formatConditionsAddedLines = (
    squaddieResult: SquaddieActionResult,
    name: string
): string[] => {
    if (
        squaddieResult.conditionsAdded == undefined ||
        squaddieResult.conditionsAdded.length === 0
    )
        return []
    return squaddieResult.conditionsAdded.map((c) => {
        // Build condition line with optional amount and duration
        let line = `  ${name} gains ${c.type}`
        if (c.amount?.current != undefined) {
            line += ` ${c.amount.current}`
        }
        if (c.limit.duration?.duration != undefined) {
            const turns = c.limit.duration.duration
            line += ` for ${turns} ${turns === 1 ? "turn" : "turns"}`
        }
        return `${line}.`
    })
}

const formatTargetResult = (
    targetResult: TargetResult,
    engine: MissionEngine
): string[] => {
    const lines: string[] = [
        `Result: ${formatDegreeOfSuccess(targetResult.degreeOfSuccess)}`,
    ]

    for (const squaddieResult of targetResult.squaddieActionResults) {
        const hasEffects =
            squaddieResult.damage != undefined ||
            squaddieResult.healing != undefined ||
            (squaddieResult.conditionsAdded != undefined &&
                squaddieResult.conditionsAdded.length > 0)
        if (!hasEffects) continue

        const name = getSquaddieName(squaddieResult, engine)
        lines.push(
            ...formatDamageLines(squaddieResult, name),
            ...formatHealingLines(squaddieResult, name),
            ...formatConditionsAddedLines(squaddieResult, name),
        )
    }

    return lines
}

const formatActionResults = (
    result: ActionResult,
    engine: MissionEngine
): string => {
    const lines: string[] = []

    if (result.actorRoll != undefined) {
        lines.push(`Roll: [${result.actorRoll[0]}, ${result.actorRoll[1]}]`)
    }

    for (const targetResult of Object.values(result.targetResults)) {
        lines.push(...formatTargetResult(targetResult, engine))
    }

    return lines.join("\n")
}
