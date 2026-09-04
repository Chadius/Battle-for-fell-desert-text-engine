import type { CurrentScene } from "./movieSceneInspector.js"
import type { TMissionAffiliationTurn } from "../logic/src/mission/missionTurn.js"
import type { TSquaddieConditionType } from "../logic/src/proficiency/squaddieCondition.js"

// A single thing the runner wants shown to the player. TextMissionRunner produces these as it
// processes input and advances the mission; CliPresenter.render() turns a list of them into the
// display text. Keeping the runner on events instead of pre-formatted strings is step 2 of
// separating renderer-agnostic mission orchestration from CLI-specific presentation.
export type RunnerEvent =
    | RunnerMessageEvent
    | PhaseAnnouncementEvent
    | ConditionExpiredEvent
    | MovieSceneEvent
    | InvalidMovieInputEvent
    | MissionSummaryEvent

// Pre-formatted text from a lower layer (command processor, deployment processor, enemy AI)
// that the presenter passes through unchanged. Step 3 would replace these with typed events too.
export interface RunnerMessageEvent {
    kind: "message"
    text: string
}

// A phase-boundary transition worth telling the player about. The presenter owns the mapping
// from phase to label (and decides which phases have no player-facing announcement at all).
export interface PhaseAnnouncementEvent {
    kind: "phaseAnnouncement"
    phase: TMissionAffiliationTurn
    turnNumber: number
}

// A timed condition on a squaddie ran out at a phase boundary.
export interface ConditionExpiredEvent {
    kind: "conditionExpired"
    squaddieName: string
    conditionType: TSquaddieConditionType
}

// A frame of a playing movie/cutscene that should be shown now.
export interface MovieSceneEvent {
    kind: "movieScene"
    scene: CurrentScene
}

// The player typed something that isn't valid for the movie state they're in: either a
// non-command while a movie plays, or a non-choice at a decision point.
export interface InvalidMovieInputEvent {
    kind: "invalidMovieInput"
    input: string
    reason: "command" | "choice"
}

// The mission ended. Carries the facts; the presenter formats the summary lines.
export interface MissionSummaryEvent {
    kind: "missionSummary"
    isFailure: boolean
    turnNumber: number
    survivorNames: string[]
}
