import type { MissionEngine } from "../logic/src/mission/missionEngine/missionEngine.js"
import type { SerializedSquaddieActionResult } from "../logic/src/squaddieAction/calculate/result/squaddieActionResult.js"
import {
    MovieEngineCommand,
    type TMovieEngineCommand,
} from "../logic/src/movie/movieEngine.js"
import { sceneDisplayText, sceneIsWaitingForDecision, type CurrentScene } from "./movieSceneInspector.js"
import {
    processCommand,
    InteractionPhase,
} from "./commandProcessor.js"
import type { CommandContext } from "./commandProcessor.js"
import { MissionObjectiveInspector, isFailureObjective } from "./missionObjectiveInspector.js"
import { conditionTypeName } from "./squaddieDetailInspector.js"
import {
    MissionAffiliationTurn,
    type TMissionAffiliationTurn,
} from "../logic/src/mission/missionTurn.js"
import { renderMap, type MapRenderInfo } from "./mapRenderer.js"
import { baseRenderInfo } from "./mapDataGatherer.js"
import { EnemyAI } from "./enemyAI.js"
import type { MissionObjective } from "../logic/src/mission/missionObjective.js"
import { MissionTextSubstitutionToken } from "../logic/src/mission/missionEngine/textSubstitutionTokens.js"
import { DecisionClock } from "./decisionClock.js"

const MAX_ADVANCEMENT_STEPS = 30

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
    private overlayMap: string | undefined = undefined
    private readonly decisionClock: DecisionClock

    constructor(engine: MissionEngine, now: () => number = Date.now) {
        this.engine = engine
        this.decisionClock = new DecisionClock(now)
        this.context = {
            selectedSquaddieId: undefined,
            interactionPhase: InteractionPhase.BROWSING,
            actingSquaddieId: undefined,
            pendingActionId: undefined,
        }
        this.initialPhaseMessages = this.advanceToInteractivePhase()
        this.syncDecisionClock()
    }

    // The decision clock only runs while a human is expected to act — the same condition
    // that makes advanceToInteractivePhase()'s loop stop and wait, outside of movies/dialogue.
    private isAwaitingPlayerDecision(): boolean {
        if (this.engine.isMoviePlaying()) return false
        return this.isWaitingForHumanInput(this.engine.getCurrentAffiliationTurn())
    }

    // True when the given phase requires a human decision: it's interactive, and — for
    // ENEMY_TURN specifically — no AI action is preloaded (either no AI-controlled squaddie
    // can act, or the phase's active squaddie is human-controlled via an override).
    private isWaitingForHumanInput(
        currentPhase: TMissionAffiliationTurn
    ): boolean {
        if (!this.isInteractivePhase(currentPhase)) return false
        return !(
            currentPhase === MissionAffiliationTurn.ENEMY_TURN &&
            this.engine.getReadiedAction() != undefined
        )
    }

    private syncDecisionClock(): void {
        if (this.isAwaitingPlayerDecision()) {
            this.decisionClock.start()
        } else {
            this.decisionClock.stop()
        }
    }

    getElapsedDecisionTimeMs(): number {
        return this.decisionClock.elapsedMs()
    }

    getWelcomeText(): string {
        const summary = this.engine.getSerializedInMissionSummary()
        const lines: string[] = [
            "Battle of Fell Desert CLI",
            "=========================",
            `Map: ${summary.mapName}`,
            "Game engine initialized.",
            "Enter 'Q' to quit, '?' for commands.",
        ]

        if (this.initialPhaseMessages.length > 0) {
            lines.push("", ...this.initialPhaseMessages)
        }

        // A PLAY_MOVIE reward may have fired while advancing through the mission's opening phases.
        // Hold off on the objectives list until the movie finishes so the two aren't shown together.
        if (this.engine.isMoviePlaying()) {
            lines.push("", this.currentSceneText())
        } else {
            const objectiveEntries = MissionObjectiveInspector.gatherEntries(this.engine)
            const objectivesDisplay = MissionObjectiveInspector.formatEntries(objectiveEntries)
            if (objectivesDisplay.length > 0) {
                lines.push("", objectivesDisplay)
            }
        }

        return lines.join("\n")
    }

    // Returns the overlay map (with target/movement highlights) when one is active, otherwise the
    // plain map. Used by the split-pane UI to refresh the left panel after each command.
    getMapText(): string {
        if (this.overlayMap != undefined) {
            return this.overlayMap
        }
        const { overview, turnNumber, currentAffiliation, squaddieAffiliations } =
            baseRenderInfo(this.engine)
        const summary = this.engine.getSerializedInMissionSummary()
        const objectiveEntries = MissionObjectiveInspector.gatherEntries(this.engine)
        const objectivesDisplay = MissionObjectiveInspector.formatEntries(objectiveEntries)
        const renderInfo: MapRenderInfo = {
            turnNumber,
            currentAffiliation,
            squaddieAffiliations,
            objectivesDisplay: objectivesDisplay.length > 0 ? objectivesDisplay : undefined,
            mapName: summary.mapName,
        }
        return renderMap(overview, renderInfo)
    }

    // Maps raw player input to a MovieEngineCommand, or undefined (unrecognised).
    private movieCommandFromInput(
        input: string
    ): TMovieEngineCommand | undefined {
        const normalized = input.trim().toUpperCase()
        if (normalized === "" || normalized === "N") return MovieEngineCommand.CONFIRM
        if (normalized === "X") return MovieEngineCommand.COMPLETE_SCENE
        if (normalized === "F") return MovieEngineCommand.FAST_FORWARD
        if (normalized === "S") return MovieEngineCommand.STOP
        return undefined
    }

    // Dialogue text may reference {TIME_ELAPSED} (e.g. via timeFormat()), which throws on
    // substitution if the token is missing — so every getMovieStatus() call must supply it.
    private movieStatus(): ReturnType<MissionEngine["getMovieStatus"]> {
        return this.engine.getMovieStatus({
            [MissionTextSubstitutionToken.TIME_ELAPSED]: String(
                this.getElapsedDecisionTimeMs()
            ),
        })
    }

    private currentSceneText(): string {
        const status = this.movieStatus()
        if (status == undefined || status.currentScene == undefined) return ""
        return sceneDisplayText(status.currentScene)
    }

    // Handles all input while a movie is playing. Returns to normal gameplay once the movie ends.
    private processMovieInput(input: string): ProcessInputResult {
        if (input.trim().toUpperCase() === "Q") return { text: "", shouldQuit: true }
        const command = this.movieCommandFromInput(input)

        // Decision scenes are blocking — recognized movie commands are silently re-displayed
        const currentScene = this.movieStatus()?.currentScene
        if (currentScene != undefined && sceneIsWaitingForDecision(currentScene)) {
            if (command != undefined) {
                return { text: this.currentSceneText(), shouldQuit: false }
            }
            return this.movieDecisionResult(currentScene, input.trim())
        }

        if (command === MovieEngineCommand.STOP) {
            this.engine.processMovieCommand(MovieEngineCommand.STOP)
            return this.missionEndResultOrContinue()
        }

        if (command == undefined) {
            return {
                text: `"${input}" is not a valid command while a movie is playing.\n${this.currentSceneText()}`,
                shouldQuit: false,
            }
        }

        this.engine.processMovieCommand(command)

        if (this.engine.isMoviePlaying()) {
            return { text: this.currentSceneText(), shouldQuit: false }
        }

        return this.missionEndResultOrContinue()
    }

    // Maps a 1-based position string to the decisionId at that index, or undefined if out of range.
    private resolveDecisionId(scene: CurrentScene, input: string): string | undefined {
        if (!sceneIsWaitingForDecision(scene)) return undefined
        const choiceNumber = parseInt(input, 10)
        if (isNaN(choiceNumber) || choiceNumber < 1 || choiceNumber > scene.decisions.length) {
            return undefined
        }
        return scene.decisions[choiceNumber - 1]?.decisionId
    }

    // Resolves the player's input to a decision by matching decisionId, then submits it.
    private movieDecisionResult(currentScene: CurrentScene, input: string): ProcessInputResult {
        const decisionId = this.resolveDecisionId(currentScene, input)

        if (decisionId == undefined) {
            return {
                text: `"${input}" is not a valid choice.\n${this.currentSceneText()}`,
                shouldQuit: false,
            }
        }

        this.engine.selectMovieDecision(decisionId)

        if (this.engine.isMoviePlaying()) {
            return { text: this.currentSceneText(), shouldQuit: false }
        }

        return this.missionEndResultOrContinue()
    }

    private missionEndResultOrContinue(priorText = ""): ProcessInputResult {
        if (this.engine.isDone()) {
            const rewarded = this.engine.getCompletedAndRewardedMissionObjectives()
            const text = [priorText, this.missionSummary(rewarded)].filter((s) => s.length > 0).join("\n")
            return { text, shouldQuit: true }
        }
        const terminalObjectives = this.getPendingTerminalObjectives()
        if (terminalObjectives.length > 0) {
            this.rewardTerminalObjectives(terminalObjectives)
            const text = [priorText, this.missionSummary(terminalObjectives)].filter((s) => s.length > 0).join("\n")
            return { text, shouldQuit: true }
        }
        return { text: priorText, shouldQuit: false }
    }

    private rewardTerminalObjectives(objectives: MissionObjective[]): void {
        for (const objective of objectives) {
            this.engine.markMissionObjectiveAsRewarded(objective.id)
        }
    }

    processInput(input: string): ProcessInputResult {
        this.decisionClock.stop()
        const result = this.processInputAndAdvance(input)
        if (!result.shouldQuit) {
            this.syncDecisionClock()
        }
        return result
    }

    private processInputAndAdvance(input: string): ProcessInputResult {
        if (this.engine.isMoviePlaying()) {
            return this.processMovieInput(input)
        }

        const result = processCommand(input, this.engine, this.context)

        if (result.updatedContext != undefined) {
            this.context = result.updatedContext
        }

        if (result.mapText != undefined) {
            this.overlayMap = result.mapText
        } else if (this.context.interactionPhase === InteractionPhase.BROWSING) {
            this.overlayMap = undefined
        }

        const phaseMessages = this.advanceToInteractivePhase()
        this.giveNonTerminalObjectiveRewards()

        const allText = [result.message, ...phaseMessages]
            .filter((s) => s.length > 0)
            .join("\n")

        if (result.action === "quit") {
            return { text: allText, shouldQuit: true }
        }

        // A movie may have started during action resolution (e.g. victory cutscene).
        // Show its first frame before handling isDone so the player sees it.
        if (this.engine.isMoviePlaying()) {
            const movieText = this.currentSceneText()
            return {
                text: [allText, movieText].filter((s) => s.length > 0).join("\n"),
                shouldQuit: false,
            }
        }

        return this.missionEndResultOrContinue(allText)
    }

    private giveNonTerminalObjectiveRewards(): void {
        for (const objective of this.engine.getCompletedNonTerminalButNotRewardedObjectives()) {
            this.engine.markMissionObjectiveAsRewarded(objective.id)
        }
    }

    private getPendingTerminalObjectives(): MissionObjective[] {
        return this.engine.getCompletedTerminalButNotRewardedObjectives()
    }

    private missionSummary(terminalObjectives: MissionObjective[]): string {
        const lines: string[] = []

        const isFailure = terminalObjectives.some(isFailureObjective)
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

    // True when a PLAY_MOVIE reward fired mid-advancement; advancing loops should stop
    // immediately so the movie is shown instead of being skipped over.
    private shouldPauseAdvancementForMovie(): boolean {
        return this.engine.isMoviePlaying()
    }

    // Loop until reaching a human-controlled interactive phase, auto-processing
    // AI-controlled phases (e.g. ENEMY_TURN) along the way. Each iteration performs exactly
    // one atomic step (a single phase transition or a single AI action) and then evaluates
    // every stop condition — including the movie-pause check — in this one place, so a
    // PLAY_MOVIE reward can never be advanced past regardless of which step triggered it.
    private advanceToInteractivePhase(): string[] {
        const allMessages: string[] = []
        let stepCount = 0

        while (true) {
            const currentPhase = this.engine.getCurrentAffiliationTurn()
            const isInteractive = this.isInteractivePhase(currentPhase)

            if (isInteractive) {
                allMessages.push(...this.announceRecentTransitions(currentPhase))
            }

            if (this.shouldPauseAdvancementForMovie()) {
                break
            }

            if (!isInteractive) {
                // Advance through a single non-interactive bookend phase (START/END)
                allMessages.push(...this.stepToNextPhase())
            } else if (!this.isWaitingForHumanInput(currentPhase)) {
                allMessages.push(...this.processEnemySquaddies())
            } else {
                // A human is expected to act (PLAYER_TURN/ALLY_TURN/NONE_AFFILIATION_TURN, or
                // an ENEMY_TURN squaddie that's human-controlled via override) — stop.
                break
            }

            stepCount += 1
            if (stepCount >= MAX_ADVANCEMENT_STEPS) {
                throw new Error(
                    "[TextMissionRunner.advanceToInteractivePhase] Advanced too many steps without settling — possible infinite loop"
                )
            }
        }

        return allMessages
    }

    // Execute one AI action for the first enemy who can act this phase
    private processEnemySquaddies(): string[] {
        const squaddieIds = this.engine.getSquaddiesWhoCanActThisPhase()
        if (squaddieIds.length === 0) return []
        return EnemyAI.takeTurn(this.engine, squaddieIds[0])
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

    // Executes a single phase transition. Announces the departing phase if it's a bookend
    // (e.g. TURN_START/TURN_END) — the arriving phase is announced by announceRecentTransitions()
    // once the loop in advanceToInteractivePhase() re-reads the current phase on its next iteration.
    private stepToNextPhase(): string[] {
        const messages: string[] = []

        const departingPhaseAnnouncement = this.announcePhase(
            this.engine.getCurrentAffiliationTurn()
        )
        if (departingPhaseAnnouncement != undefined) {
            messages.push(departingPhaseAnnouncement)
        }

        const transitionResults = this.engine.transitionToNextPhase()
        messages.push(...this.formatConditionExpirationMessages(transitionResults))

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
