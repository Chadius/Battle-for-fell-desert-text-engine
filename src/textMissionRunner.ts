import type { MissionEngine } from "../logic/src/mission/missionEngine/missionEngine.js"
import {
    processCommand,
    InteractionPhase,
} from "./commandProcessor.js"
import type { CommandContext } from "./commandProcessor.js"
import { MissionObjectiveInspector } from "./missionObjectiveInspector.js"
import {
    MissionAffiliationTurn,
    type TMissionAffiliationTurn,
} from "../logic/src/mission/missionTurn.js"

export interface ProcessInputResult {
    text: string
    shouldQuit: boolean
}

export class TextMissionRunner {
    private readonly engine: MissionEngine
    private context: CommandContext
    private readonly initialPhaseMessages: string[]

    constructor(engine: MissionEngine) {
        this.engine = engine
        this.context = {
            selectedSquaddieId: undefined,
            interactionPhase: InteractionPhase.BROWSING,
            actingSquaddieId: undefined,
        }
        this.initialPhaseMessages = this.advanceToInteractivePhase()
    }

    getWelcomeText(): string {
        const lines: string[] = [
            "Battle of Fell Desert CLI",
            "=========================",
            "Game engine initialized.",
            "Enter 'Q' to quit, '?' for commands.",
        ]

        if (this.initialPhaseMessages.length > 0) {
            lines.push("", ...this.initialPhaseMessages)
        }

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

        const phaseMessages = this.advanceToInteractivePhase()
        const allText = [result.message, ...phaseMessages]
            .filter((s) => s.length > 0)
            .join("\n")

        return {
            text: allText,
            shouldQuit: result.action === "quit",
        }
    }

    private announcePhase(phase: TMissionAffiliationTurn): string | undefined {
        if (phase === MissionAffiliationTurn.TURN_START) {
            const turnNumber = this.engine.getCurrentTurnNumber()
            return `Turn ${turnNumber} start`
        }

        const announcements: Partial<Record<string, string>> = {
            [MissionAffiliationTurn.PLAYER_TURN_START]: "Player Turn",
            [MissionAffiliationTurn.ALLY_TURN_START]: "Ally Turn",
            [MissionAffiliationTurn.ENEMY_TURN_START]: "Enemy Turn",
            [MissionAffiliationTurn.NONE_AFFILIATION_TURN_START]: "Neutral Turn",
            [MissionAffiliationTurn.TURN_END]: "End of Turn",
        }

        return announcements[phase]
    }

    private isInteractivePhase(phase: TMissionAffiliationTurn): boolean {
        const interactivePhases: TMissionAffiliationTurn[] = [
            MissionAffiliationTurn.PLAYER_TURN,
            MissionAffiliationTurn.ALLY_TURN,
            MissionAffiliationTurn.ENEMY_TURN,
            MissionAffiliationTurn.NONE_AFFILIATION_TURN,
        ]
        return interactivePhases.includes(phase)
    }

    private advanceToInteractivePhase(): string[] {
        const messages: string[] = []

        const currentPhase = this.engine.getCurrentAffiliationTurn()
        const currentAnnouncement = this.announcePhase(currentPhase)
        if (currentAnnouncement != undefined) {
            messages.push(currentAnnouncement)
        }

        let phaseChangeLimit = 20
        while (phaseChangeLimit > 0) {
            const phaseBefore = this.engine.getCurrentAffiliationTurn()
            this.engine.transitionToNextPhase()
            const phaseAfter = this.engine.getCurrentAffiliationTurn()

            if (phaseAfter === phaseBefore) {
                break
            }

            const announcement = this.announcePhase(phaseAfter)
            if (announcement != undefined) {
                messages.push(announcement)
            }

            if (this.isInteractivePhase(phaseAfter)) {
                break
            }
            phaseChangeLimit -= 1
        }

        if (phaseChangeLimit <= 0) {
            throw new Error("Changed phases too many times, possible infinite loop")
        }

        return messages
    }
}
