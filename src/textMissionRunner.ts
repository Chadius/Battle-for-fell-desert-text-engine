import type { MissionEngine } from "../logic/src/mission/missionEngine/missionEngine.js"
import type { SerializedSquaddieActionResult } from "../logic/src/squaddieAction/calculate/result/squaddieActionResult.js"
import {
    MovieEngineCommand,
    type TMovieEngineCommand,
} from "../logic/src/movie/movieEngine.js"
import { sceneIsWaitingForDecision, type CurrentScene } from "./movieSceneInspector.js"
import {
    processCommand,
    InteractionPhase,
} from "./commandProcessor.js"
import type { CommandContext } from "./commandProcessor.js"
import { isFailureObjective } from "./missionObjectiveInspector.js"
import {
    MissionAffiliationTurn,
    type TMissionAffiliationTurn,
} from "../logic/src/mission/missionTurn.js"
import { EnemyAI } from "./enemyAI.js"
import type { MissionObjective } from "../logic/src/mission/missionObjective.js"
import { DecisionClock } from "./decisionClock.js"
import { CliPresenter } from "./cliPresenter.js"
import { MissionTextSubstitutionToken } from "../logic/src/mission/missionEngine/textSubstitutionTokens.js"
import type {
    RunnerEvent,
    PhaseAnnouncementEvent,
    ConditionExpiredEvent,
    MovieSceneEvent,
    MissionSummaryEvent,
} from "./runnerEvent.js"
import {
    processDeploymentCommand,
    initialDeploymentContext,
    type DeploymentContext,
} from "./deploymentCommandProcessor.js"
import type { GlossaryManager } from "../logic/src/campaign/glossary/glossaryManager.js"

const MAX_ADVANCEMENT_STEPS = 30

export interface ProcessInputResult {
    text: string
    shouldQuit: boolean
}

export class TextMissionRunner {
    private readonly engine: MissionEngine
    private context: CommandContext
    private readonly initialPhaseEvents: RunnerEvent[]
    private lastKnownInteractivePhase: TMissionAffiliationTurn | undefined =
        undefined
    private overlayMap: string | undefined = undefined
    private readonly decisionClock: DecisionClock
    private deploymentContext: DeploymentContext = initialDeploymentContext()
    private readonly glossaryManager: GlossaryManager | undefined
    private readonly presenter: CliPresenter

    constructor(
        engine: MissionEngine,
        now: () => number = Date.now,
        glossaryManager?: GlossaryManager
    ) {
        this.engine = engine
        this.decisionClock = new DecisionClock(now)
        this.glossaryManager = glossaryManager
        this.presenter = new CliPresenter(engine)
        this.context = {
            selectedSquaddieId: undefined,
            interactionPhase: InteractionPhase.BROWSING,
            actingSquaddieId: undefined,
            pendingActionId: undefined,
        }
        // Checked before deployment begins so a PLAY_MOVIE reward tied to the mission's very
        // start (e.g. an intro cutscene) can fire before the deployment screen is ever shown.
        this.engine.checkAndTriggerObjectiveRewards()
        this.autoFinalizeTrivialDeployment()
        this.initialPhaseEvents =
            this.isInDeploymentPhase() || this.engine.isMoviePlaying()
                ? []
                : this.advanceToInteractivePhase()
        this.syncDecisionClock()
    }

    private isInDeploymentPhase(): boolean {
        return this.engine.isCampaignSquaddieDeploymentInProgress()
    }

    // If campaign deployment has nothing left to confirm (e.g. every coordinate was locked to
    // a specific/leader request and got auto-assigned, with no open slots or unplaced eligible
    // squaddies remaining), finalize it immediately instead of prompting with an empty screen.
    private autoFinalizeTrivialDeployment(): void {
        if (!this.isInDeploymentPhase()) return
        const status = this.engine.getCampaignDeploymentStatus()
        const nothingToConfirm =
            status.openCoordinates.length === 0 &&
            status.unplacedEligibleCampaignSquaddies.length === 0
        if (nothingToConfirm) {
            this.engine.finalizeCampaignSquaddieDeploymentAndStartMission()
        }
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
        const currentScene = this.engine.isMoviePlaying()
            ? this.currentScene()
            : undefined
        return this.presenter.welcomeText(this.initialPhaseEvents, currentScene)
    }

    getMapText(): string {
        return this.presenter.mapText(this.overlayMap)
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

    // Reads the live movie status for control-flow decisions (is a scene blocking on a
    // decision? what are the choices?). Dialogue may reference {TIME_ELAPSED}, which throws
    // on substitution when the token is missing, so every getMovieStatus() call supplies it.
    private movieStatus(): ReturnType<MissionEngine["getMovieStatus"]> {
        return this.engine.getMovieStatus({
            [MissionTextSubstitutionToken.TIME_ELAPSED]: String(
                this.getElapsedDecisionTimeMs()
            ),
        })
    }

    private currentScene(): CurrentScene | undefined {
        return this.movieStatus()?.currentScene
    }

    // The current movie frame as a (0- or 1-element) event list, for splicing into a result.
    private movieSceneEvents(): MovieSceneEvent[] {
        const scene = this.currentScene()
        return scene != undefined ? [{ kind: "movieScene", scene }] : []
    }

    // Shows the movie that just started playing (e.g. a victory cutscene triggered by an
    // objective reward mid-turn) instead of whatever the caller was about to do next.
    private showMovieInProgress(priorEvents: RunnerEvent[]): ProcessInputResult {
        return {
            text: this.presenter.render([...priorEvents, ...this.movieSceneEvents()]),
            shouldQuit: false,
        }
    }

    // Handles all input while a movie is playing. Returns to normal gameplay once the movie ends.
    private processMovieInput(input: string): ProcessInputResult {
        if (input.trim().toUpperCase() === "Q") return { text: "", shouldQuit: true }
        const command = this.movieCommandFromInput(input)

        // Decision scenes are blocking — recognized movie commands are silently re-displayed
        const currentScene = this.currentScene()
        if (currentScene != undefined && sceneIsWaitingForDecision(currentScene)) {
            if (command != undefined) {
                return {
                    text: this.presenter.render([
                        { kind: "movieScene", scene: currentScene },
                    ]),
                    shouldQuit: false,
                }
            }
            return this.movieDecisionResult(currentScene, input.trim())
        }

        if (command === MovieEngineCommand.STOP) {
            this.engine.processMovieCommand(MovieEngineCommand.STOP)
            return this.missionEndResultOrContinue()
        }

        if (command == undefined) {
            return {
                text: this.presenter.render([
                    { kind: "invalidMovieInput", input, reason: "command" },
                    ...this.movieSceneEvents(),
                ]),
                shouldQuit: false,
            }
        }

        this.engine.processMovieCommand(command)

        if (this.engine.isMoviePlaying()) {
            return {
                text: this.presenter.render(this.movieSceneEvents()),
                shouldQuit: false,
            }
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
                text: this.presenter.render([
                    { kind: "invalidMovieInput", input, reason: "choice" },
                    { kind: "movieScene", scene: currentScene },
                ]),
                shouldQuit: false,
            }
        }

        this.engine.selectMovieDecision(decisionId)

        if (this.engine.isMoviePlaying()) {
            return {
                text: this.presenter.render(this.movieSceneEvents()),
                shouldQuit: false,
            }
        }

        return this.missionEndResultOrContinue()
    }

    private missionEndResultOrContinue(
        priorEvents: RunnerEvent[] = []
    ): ProcessInputResult {
        // Always settle outstanding objective rewards before checking isDone() —
        // hasMissionEnded() only recognizes an objective once it's marked rewarded, and
        // settling it here (rather than assuming some earlier engine call already did it)
        // is what lets a PLAY_MOVIE reward on that objective actually fire.
        this.settleObjectiveRewards()

        // Rewarding may have just started a movie (e.g. a victory cutscene tied to the
        // objective that just completed) — show it instead of ending the mission unseen.
        if (this.engine.isMoviePlaying()) {
            return this.showMovieInProgress(priorEvents)
        }

        if (this.engine.isDone()) {
            const rewarded = this.engine.getCompletedAndRewardedMissionObjectives()
            return this.quitWithSummary(priorEvents, rewarded)
        }
        return { text: this.presenter.render(priorEvents), shouldQuit: false }
    }

    private quitWithSummary(
        priorEvents: RunnerEvent[],
        terminalObjectives: MissionObjective[]
    ): ProcessInputResult {
        return {
            text: this.presenter.render([
                ...priorEvents,
                this.missionSummaryEvent(terminalObjectives),
            ]),
            shouldQuit: true,
        }
    }

    // Handles all input during pre-mission campaign squaddie deployment. Once the player
    // finalizes, kicks off the same phase-advancement the constructor would have run normally.
    private processDeploymentInput(input: string): ProcessInputResult {
        const result = processDeploymentCommand(input, this.engine, this.deploymentContext)

        if (result.updatedContext != undefined) {
            this.deploymentContext = result.updatedContext
        }

        if (result.action === "quit") {
            return { text: result.message, shouldQuit: true }
        }

        if (result.action !== "finalize") {
            return { text: result.message, shouldQuit: false }
        }

        const events: RunnerEvent[] = [
            { kind: "message", text: result.message },
            ...this.advanceToInteractivePhase(),
        ]

        return this.missionEndResultOrContinue(events)
    }

    // Grants the reward for every completed-but-unrewarded objective. Goes through
    // checkAndTriggerObjectiveRewards() first so any PLAY_MOVIE/SET_CHALLENGE_MODIFIER reward
    // attached to an objective actually fires — markMissionObjectiveAsRewarded() alone only
    // flips the "rewarded" flag and would silently skip triggering those. What's left after
    // that (MISSION_ENDS/MISSION_FAILURE-only objectives, which checkAndTriggerObjectiveRewards
    // doesn't handle since there's nothing to trigger) still needs the flag set explicitly,
    // since hasMissionEnded() reads it directly.
    private settleObjectiveRewards(): void {
        this.engine.checkAndTriggerObjectiveRewards()
        for (const objective of this.engine.getCompletedButNotRewardedMissionObjectives()) {
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
        // A pre-deployment PLAY_MOVIE reward can leave a movie playing while deployment is
        // still technically in progress — the movie must take input priority in that case.
        if (this.engine.isMoviePlaying()) {
            return this.processMovieInput(input)
        }

        if (this.isInDeploymentPhase()) {
            return this.processDeploymentInput(input)
        }

        const result = processCommand(
            input,
            this.engine,
            this.context,
            this.glossaryManager
        )

        if (result.updatedContext != undefined) {
            this.context = result.updatedContext
        }

        if (result.mapText != undefined) {
            this.overlayMap = result.mapText
        } else if (this.context.interactionPhase === InteractionPhase.BROWSING) {
            this.overlayMap = undefined
        }

        const phaseEvents = this.advanceToInteractivePhase()

        const events: RunnerEvent[] = [
            { kind: "message", text: result.message },
            ...phaseEvents,
        ]

        // Quitting discards this engine instance entirely (no save/resume exists), so there's
        // no reason to settle objective rewards on this path — missionEndResultOrContinue()
        // is the single place that happens, and it's only reached when we're not quitting.
        if (result.action === "quit") {
            return { text: this.presenter.render(events), shouldQuit: true }
        }

        return this.missionEndResultOrContinue(events)
    }

    private missionSummaryEvent(
        terminalObjectives: MissionObjective[]
    ): MissionSummaryEvent {
        const survivors = this.engine
            .getAllSquaddiePositions()
            .map(({ squaddieId }) => this.engine.getSquaddieInfo(squaddieId))
            .filter((info) => info != undefined && info.currentHitPoints > 0)

        return {
            kind: "missionSummary",
            isFailure: terminalObjectives.some(isFailureObjective),
            turnNumber: this.engine.getCurrentTurnNumber(),
            survivorNames: survivors.map((s) => s.name),
        }
    }

    private phaseAnnouncementEvent(
        phase: TMissionAffiliationTurn
    ): PhaseAnnouncementEvent {
        return {
            kind: "phaseAnnouncement",
            phase,
            turnNumber: this.engine.getCurrentTurnNumber(),
        }
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
    private advanceToInteractivePhase(): RunnerEvent[] {
        const allEvents: RunnerEvent[] = []
        let stepCount = 0

        while (true) {
            const currentPhase = this.engine.getCurrentAffiliationTurn()
            const isInteractive = this.isInteractivePhase(currentPhase)

            if (isInteractive) {
                allEvents.push(...this.announceRecentTransitions(currentPhase))
            }

            if (this.shouldPauseAdvancementForMovie()) {
                break
            }

            if (!isInteractive) {
                // Advance through a single non-interactive bookend phase (START/END)
                allEvents.push(...this.stepToNextPhase())
            } else if (!this.isWaitingForHumanInput(currentPhase)) {
                allEvents.push(...this.processEnemySquaddies())
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

        return allEvents
    }

    // Execute one AI action for the first enemy who can act this phase
    private processEnemySquaddies(): RunnerEvent[] {
        const squaddieIds = this.engine.getSquaddiesWhoCanActThisPhase()
        if (squaddieIds.length === 0) return []
        return EnemyAI.takeTurn(this.engine, squaddieIds[0]).map((text) => ({
            kind: "message",
            text,
        }))
    }

    private announceRecentTransitions(
        currentPhase: TMissionAffiliationTurn
    ): RunnerEvent[] {
        if (currentPhase === this.lastKnownInteractivePhase) {
            return []
        }
        const { recentPhaseTransitions } = this.engine.getInMissionSummary()
        const events: RunnerEvent[] = recentPhaseTransitions.map((phase) =>
            this.phaseAnnouncementEvent(phase)
        )

        events.push(
            ...this.conditionExpirationEvents(
                this.engine.getRecentTransitionResults()
            )
        )

        this.lastKnownInteractivePhase = currentPhase
        return events
    }

    // Executes a single phase transition. Announces the departing phase if it's a bookend
    // (e.g. TURN_START/TURN_END) — the arriving phase is announced by announceRecentTransitions()
    // once the loop in advanceToInteractivePhase() re-reads the current phase on its next iteration.
    private stepToNextPhase(): RunnerEvent[] {
        // Announce the departing phase (only bookends like TURN_START/TURN_END render to
        // anything) before the transition — the arriving phase is announced by
        // announceRecentTransitions() on the loop's next iteration.
        const events: RunnerEvent[] = [
            this.phaseAnnouncementEvent(this.engine.getCurrentAffiliationTurn()),
        ]

        const transitionResults = this.engine.transitionToNextPhase()
        events.push(...this.conditionExpirationEvents(transitionResults))

        return events
    }

    private conditionExpirationEvents(
        results: SerializedSquaddieActionResult[]
    ): ConditionExpiredEvent[] {
        const events: ConditionExpiredEvent[] = []
        for (const result of results) {
            const types = result.dispel?.conditionTypes.types
            if (!types || types.length === 0) continue

            const info = this.engine.getSquaddieInfo({
                inBattleSquaddieId: result.inBattleSquaddieId,
                outOfBattleSquaddieId: result.outOfBattleSquaddieId,
            })
            const squaddieName = info?.name ?? result.outOfBattleSquaddieId
            for (const conditionType of types) {
                events.push({ kind: "conditionExpired", squaddieName, conditionType })
            }
        }
        return events
    }
}
