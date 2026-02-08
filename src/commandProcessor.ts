import type { MissionEngine } from "../logic/src/mission/missionEngine/missionEngine.js"
import { renderMap } from "./mapRenderer.js"

export type CommandAction = "quit" | "echo" | "showMap" | "showCommands"

export interface CommandResult {
    action: CommandAction
    message: string
}

export const processCommand = (
    rawInput: string,
    engine?: MissionEngine
): CommandResult => {
    const normalizedInput = rawInput.trim().toUpperCase()

    if (normalizedInput === "Q") {
        return { action: "quit", message: "Goodbye!" }
    }

    if (normalizedInput === "M") {
        return handleShowMap(engine)
    }

    if (normalizedInput === "?") {
        return handleShowCommands()
    }

    return { action: "echo", message: `You entered: ${rawInput}` }
}

// Builds the help message listing all available commands
const handleShowCommands = (): CommandResult => {
    const commandList = [
        "M - Show the map",
        "Q - Quit the game",
        "? - Show all commands",
    ].join("\n")

    return { action: "showCommands", message: commandList }
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
