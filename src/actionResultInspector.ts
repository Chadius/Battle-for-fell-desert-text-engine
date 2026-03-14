import type {MissionEngine} from "../logic/src/mission/missionEngine/missionEngine.js"
import type {ActionResult} from "../logic/src/mission/actionResult.js"
import type {SquaddieActionResult} from "../logic/src/squaddieAction/calculate/result/squaddieActionResult.js"
import type {TDegreeOfSuccess} from "../logic/src/degreesOfSuccess/degreeOfSuccess.js"
import type {TargetResult} from "../logic/src/mission/targetResult.js"

export const ActionResultInspector = {
    // actionId is optional; when provided, the function looks up the action's possible
    // degrees of success so it can omit the "Result:" header for single-outcome actions.
    formatActionResults: (
        result: ActionResult,
        engine: MissionEngine,
        actionId?: string
    ): string => formatActionResults(result, engine, actionId),
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
    engine: MissionEngine,
    degreesOfSuccess: TDegreeOfSuccess[] | undefined
): string[] => {
    // Collect effect lines first; only emit the "Result:" header if there are effects
    const effectLines: string[] = []

    for (const squaddieResult of targetResult.squaddieActionResults) {
        const hasEffects =
            squaddieResult.damage != undefined ||
            squaddieResult.healing != undefined ||
            (squaddieResult.conditionsAdded != undefined &&
                squaddieResult.conditionsAdded.length > 0)
        if (!hasEffects) continue

        const name = getSquaddieName(squaddieResult, engine)
        effectLines.push(
            ...formatDamageLines(squaddieResult, name),
            ...formatHealingLines(squaddieResult, name),
            ...formatConditionsAddedLines(squaddieResult, name),
        )
    }

    if (effectLines.length === 0) {
        // A miss (FAILURE/BOTCH) is always worth announcing even with no applied effects
        if (
            targetResult.degreeOfSuccess === "FAILURE" ||
            targetResult.degreeOfSuccess === "BOTCH"
        ) {
            return [`Result: ${formatDegreeOfSuccess(targetResult.degreeOfSuccess)}`]
        }
        return []
    }
    // Omit the "Result:" header when the action can only produce a single outcome —
    // announcing the outcome adds no information the player doesn't already expect.
    if (degreesOfSuccess != undefined && degreesOfSuccess.length === 1) return effectLines
    return [
        `Result: ${formatDegreeOfSuccess(targetResult.degreeOfSuccess)}`,
        ...effectLines,
    ]
}

const formatActionResults = (
    result: ActionResult,
    engine: MissionEngine,
    actionId?: string
): string => {
    const lines: string[] = []

    if (result.actorRoll != undefined) {
        lines.push(`Roll: [${result.actorRoll[0]}, ${result.actorRoll[1]}]`)
    }

    // Look up the action's possible degrees so formatTargetResult can decide
    // whether the outcome header is worth announcing.
    const degreesOfSuccess: TDegreeOfSuccess[] | undefined =
        actionId != undefined
            ? engine.getActionById(actionId)?.degreesOfSuccess
            : undefined

    for (const targetResult of Object.values(result.targetResults)) {
        lines.push(...formatTargetResult(targetResult, engine, degreesOfSuccess))
    }

    return lines.join("\n")
}
