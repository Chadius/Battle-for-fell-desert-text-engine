import type { MissionEngine } from "../logic/src/mission/missionEngine/missionEngine.js"
import {
    processCommand,
    InteractionPhase,
} from "./commandProcessor.js"
import type { CommandContext } from "./commandProcessor.js"
import { MissionObjectiveInspector } from "./missionObjectiveInspector.js"

export interface ProcessInputResult {
    text: string
    shouldQuit: boolean
}

export class TextMissionRunner {
    private readonly engine: MissionEngine
    private context: CommandContext

    constructor(engine: MissionEngine) {
        this.engine = engine
        this.context = {
            selectedSquaddieId: undefined,
            interactionPhase: InteractionPhase.BROWSING,
            actingSquaddieId: undefined,
        }
    }

    getWelcomeText(): string {
        const lines: string[] = [
            "Battle of Fell Desert CLI",
            "=========================",
            "Game engine initialized.",
            "Enter 'Q' to quit, '?' for commands.",
        ]

        const objectiveEntries = MissionObjectiveInspector.gatherEntries(this.engine)
        const objectivesDisplay = MissionObjectiveInspector.formatEntries(objectiveEntries)
        if (objectivesDisplay.length > 0) {
            lines.push("", objectivesDisplay)
        }

        return lines.join("\n")
    }

    processInput(input: string): ProcessInputResult {
        const result = processCommand(input, this.engine, this.context)

        if (result.updatedContext != undefined) {
            this.context = result.updatedContext
        }

        return {
            text: result.message,
            shouldQuit: result.action === "quit",
        }
    }
}
