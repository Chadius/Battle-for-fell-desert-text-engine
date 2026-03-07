import type { MissionEngine } from "../logic/src/mission/missionEngine/missionEngine.js"
import type { SerializedSquaddieActionResult } from "../logic/src/squaddieAction/calculate/result/squaddieActionResult.js"
import {
    processCommand,
    InteractionPhase,
} from "./commandProcessor.js"
import type { CommandContext } from "./commandProcessor.js"
import { MissionObjectiveInspector } from "./missionObjectiveInspector.js"
import { conditionTypeName } from "./squaddieDetailInspector.js"
import {
    MissionAffiliationTurn,
    type TMissionAffiliationTurn,
} from "../logic/src/mission/missionTurn.js"
import {MissionObjectiveRewardType, TMissionObjectiveRewardType} from "../logic/src/mission/missionObjectiveReward.js"
import type { MissionObjective } from "../logic/src/mission/missionObjective.js"

const MAX_PHASE_TRANSITIONS = 20

export interface ProcessInputResult {
    text: string
    shouldQuit: boolean
}

export class TextMissionRunner {
    private readonly engine: MissionEngine
    private context: CommandContext
    private readonly initialPhaseMessages: string[]
    private lastKnownInteractivePhase: TMissionAffiliationTurn | undefined =
        undefined

    constructor(engine: MissionEngine) {
        this.engine = engine
        this.context = {
            selectedSquaddieId: undefined,
            interactionPhase: InteractionPhase.BROWSING,
            actingSquaddieId: undefined,
            pendingActionId: undefined,
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
        this.giveNonTerminalObjectiveRewards()

        const allText = [result.message, ...phaseMessages]
            .filter((s) => s.length > 0)
            .join("\n")

        if (result.action === "quit") {
            return { text: allText, shouldQuit: true }
        }

        // If mission was already ended by a previous processInput call (rewards already
        // marked), re-surface the summary so the caller always sees it regardless of
        // which input happened to trigger the final detection.
        if (this.engine.isDone()) {
            const rewarded = this.engine.getCompletedAndRewardedMissionObjectives()
            const summaryText = this.formatMissionSummary(rewarded)
            return {
                text: [allText, summaryText].filter((s) => s.length > 0).join("\n"),
                shouldQuit: true,
            }
        }

        const terminalObjectives = this.getPendingTerminalObjectives()
        if (terminalObjectives.length > 0) {
            const summaryText = this.formatMissionSummary(terminalObjectives)
            for (const objective of terminalObjectives) {
                this.engine.markMissionObjectiveAsRewarded(objective.id)
            }
            return {
                text: [allText, summaryText].filter((s) => s.length > 0).join("\n"),
                shouldQuit: true,
            }
        }

        return { text: allText, shouldQuit: false }
    }

    private giveNonTerminalObjectiveRewards(): void {
        const terminalTypes: Set<TMissionObjectiveRewardType> = new Set([
            MissionObjectiveRewardType.MISSION_ENDS,
            MissionObjectiveRewardType.MISSION_FAILURE,
        ])
        const completed = this.engine.getCompletedButNotRewardedMissionObjectives()
        for (const objective of completed) {
            const isTerminal = objective.rewards.some((r) =>
                terminalTypes.has(r.type)
            )
            if (!isTerminal) {
                this.engine.markMissionObjectiveAsRewarded(objective.id)
            }
        }
    }

    private getPendingTerminalObjectives(): MissionObjective[] {
        const terminalTypes: Set<TMissionObjectiveRewardType> = new Set([
            MissionObjectiveRewardType.MISSION_ENDS,
            MissionObjectiveRewardType.MISSION_FAILURE,
        ])
        return this.engine
            .getCompletedButNotRewardedMissionObjectives()
            .filter((obj) => obj.rewards.some((r) => terminalTypes.has(r.type)))
    }

    private formatMissionSummary(terminalObjectives: MissionObjective[]): string {
        const lines: string[] = []

        const isFailure = terminalObjectives.some((obj) =>
            obj.rewards.some(
                (reward) => reward.type === MissionObjectiveRewardType.MISSION_FAILURE
            )
        )
        lines.push(
            isFailure ? "Mission Failed!" : "Mission Complete!",
            `Completed on turn ${this.engine.getCurrentTurnNumber()}.`
        )

        const survivors = this.engine
            .getAllSquaddiePositions()
            .map(({ squaddieId }) => this.engine.getSquaddieInfo(squaddieId))
            .filter((info) => info != undefined && info.currentHitPoints > 0)
        if (survivors.length > 0) {
            lines.push(`Survivors: ${survivors.map((s) => s.name).join(", ")}`)
        }

        return lines.join("\n")
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
        const currentPhase = this.engine.getCurrentAffiliationTurn()
        if (this.isInteractivePhase(currentPhase)) {
            return this.announceRecentTransitions(currentPhase)
        }
        return this.advanceToInteractivePhaseManually()
    }

    private announceRecentTransitions(
        currentPhase: TMissionAffiliationTurn
    ): string[] {
        if (currentPhase === this.lastKnownInteractivePhase) {
            return []
        }
        const { recentPhaseTransitions } =
            this.engine.getInMissionSummary()
        const messages = recentPhaseTransitions
            .map((phase) => this.announcePhase(phase))
            .filter((msg): msg is string => msg != undefined)

        messages.push(
            ...this.formatConditionExpirationMessages(
                this.engine.getRecentTransitionResults()
            )
        )

        this.lastKnownInteractivePhase = currentPhase
        return messages
    }

    private advanceToInteractivePhaseManually(): string[] {
        const messages: string[] = []

        const currentAnnouncement = this.announcePhase(
            this.engine.getCurrentAffiliationTurn()
        )
        if (currentAnnouncement != undefined) {
            messages.push(currentAnnouncement)
        }

        let phaseChangeLimit = MAX_PHASE_TRANSITIONS
        while (phaseChangeLimit > 0) {
            const phaseBefore = this.engine.getCurrentAffiliationTurn()
            const transitionResults = this.engine.transitionToNextPhase()
            messages.push(...this.formatConditionExpirationMessages(transitionResults))
            const phaseAfter = this.engine.getCurrentAffiliationTurn()

            if (phaseAfter === phaseBefore) {
                break
            }

            const announcement = this.announcePhase(phaseAfter)
            if (announcement != undefined) {
                messages.push(announcement)
            }

            if (this.isInteractivePhase(phaseAfter)) {
                this.lastKnownInteractivePhase = phaseAfter
                break
            }
            phaseChangeLimit -= 1
        }

        if (phaseChangeLimit <= 0) {
            throw new Error("Changed phases too many times, possible infinite loop")
        }

        return messages
    }

    private formatConditionExpirationMessages(
        results: SerializedSquaddieActionResult[]
    ): string[] {
        const messages: string[] = []
        for (const result of results) {
            const types = result.dispel?.conditionTypes.types
            if (!types || types.length === 0) continue

            const info = this.engine.getSquaddieInfo({
                inBattleSquaddieId: result.inBattleSquaddieId,
                outOfBattleSquaddieId: result.outOfBattleSquaddieId,
            })
            const name = info?.name ?? result.outOfBattleSquaddieId
            for (const conditionType of types) {
                messages.push(`${name}'s ${conditionTypeName(conditionType)} expired`)
            }
        }
        return messages
    }
}
