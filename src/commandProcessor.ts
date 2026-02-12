import type { MissionEngine } from "../logic/src/mission/missionEngine/missionEngine.js"
import type { BattleSquaddieId } from "../logic/src/squaddie/inBattle/inBattleSquaddieManager.js"
import { renderMap } from "./mapRenderer.js"
import { parseCoordinate, inspectCoordinate } from "./coordinateInspector.js"
import { formatSquaddieDetails } from "./squaddieDetailInspector.js"

export type CommandAction =
    | "quit"
    | "echo"
    | "showMap"
    | "showCommands"
    | "inspectCoordinate"
    | "lookAtSquaddie"

export interface CommandContext {
    selectedSquaddieId: BattleSquaddieId | undefined
}

export interface CommandResult {
    action: CommandAction
    message: string
    updatedContext?: CommandContext
}

export const processCommand = (
    rawInput: string,
    engine?: MissionEngine,
    context?: CommandContext
): CommandResult => {
    const normalizedInput = rawInput.trim().toUpperCase()

    if (normalizedInput === "Q") {
        return { action: "quit", message: "Goodbye!" }
    }

    if (normalizedInput === "M") {
        return handleShowMap(engine)
    }

    if (normalizedInput === "?") {
        return handleShowCommands(context)
    }

    if (normalizedInput === "L") {
        return handleLookAtSquaddie(engine, context)
    }

    const coordinate = parseCoordinate(rawInput)
    if (coordinate != undefined) {
        return handleInspectCoordinate(engine, coordinate)
    }

    return { action: "echo", message: `You entered: ${rawInput}` }
}

const handleShowCommands = (context?: CommandContext): CommandResult => {
    const commandList = [
        "M - Show the map",
        "row, col - Inspect a coordinate",
    ]

    if (context?.selectedSquaddieId != undefined) {
        commandList.push("L - Look at selected squaddie")
    }

    commandList.push("Q - Quit the game", "? - Show all commands")

    return { action: "showCommands", message: commandList.join("\n") }
}

const handleShowMap = (engine?: MissionEngine): CommandResult => {
    if (engine == undefined) {
        return {
            action: "showMap",
            message: "No engine available to display the map.",
        }
    }

    const overview = engine.getMapOverview()
    return { action: "showMap", message: renderMap(overview) }
}

const handleInspectCoordinate = (
    engine: MissionEngine | undefined,
    coordinate: { row: number; col: number }
): CommandResult => {
    if (engine == undefined) {
        return {
            action: "inspectCoordinate",
            message: "No engine available to inspect coordinates.",
        }
    }

    const message = inspectCoordinate(engine, coordinate)

    const squaddieId = engine.getSquaddieAtCoordinate(coordinate)
    return {
        action: "inspectCoordinate",
        message,
        updatedContext: { selectedSquaddieId: squaddieId },
    }
}

const handleLookAtSquaddie = (
    engine: MissionEngine | undefined,
    context: CommandContext | undefined
): CommandResult => {
    if (engine == undefined) {
        return {
            action: "lookAtSquaddie",
            message: "No engine available to look at squaddie details.",
        }
    }

    if (context?.selectedSquaddieId == undefined) {
        return {
            action: "lookAtSquaddie",
            message:
                "No squaddie selected. Inspect a coordinate with a squaddie first.",
        }
    }

    const info = engine.getSquaddieInfo(context.selectedSquaddieId)

    const lines: string[] = [
        info.name,
        `  Affiliation: ${info.affiliation}`,
        `  Hit Points: ${info.currentHitPoints}/${info.maxHitPoints}`,
        `  Action Points: ${info.currentActionPoints}/${info.maximumActionPoints}`,
    ]

    const conditionsOutput = formatSquaddieDetails(info.conditions)
    if (conditionsOutput.length > 0) {
        lines.push(conditionsOutput)
    }

    return {
        action: "lookAtSquaddie",
        message: lines.join("\n"),
    }
}
