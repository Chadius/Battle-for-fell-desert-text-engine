import type { MissionEngine } from "../logic/src/mission/missionEngine/missionEngine.js"
import { sceneDisplayText, type CurrentScene } from "./movieSceneInspector.js"
import { MissionObjectiveInspector } from "./missionObjectiveInspector.js"
import { renderMap, type MapRenderInfo } from "./mapRenderer.js"
import { baseRenderInfo } from "./mapDataGatherer.js"
import { DeploymentInspector } from "./deploymentInspector.js"
import { conditionTypeName } from "./squaddieDetailInspector.js"
import { MissionAffiliationTurn } from "../logic/src/mission/missionTurn.js"
import type {
    RunnerEvent,
    PhaseAnnouncementEvent,
    MissionSummaryEvent,
} from "./runnerEvent.js"

// CliPresenter owns the text rendering the runner used to do inline. It holds only a
// reference to the engine; anything that lives on the runner (in-progress phase events,
// the active overlay map, the current movie scene) is passed in per call. This is step 1
// and 2 of separating renderer-agnostic mission orchestration from CLI presentation.
export class CliPresenter {
    private readonly engine: MissionEngine

    constructor(engine: MissionEngine) {
        this.engine = engine
    }

    private titleLines(mapName: string): string[] {
        return [
            "Battle of Fell Desert CLI",
            "=========================",
            `Map: ${mapName}`,
        ]
    }

    private objectivesDisplayText(): string {
        return MissionObjectiveInspector.formatEntries(
            MissionObjectiveInspector.gatherEntries(this.engine)
        )
    }

    private sceneText(scene: CurrentScene | undefined): string {
        if (scene == undefined) return ""
        return sceneDisplayText(scene)
    }

    welcomeText(
        initialPhaseEvents: RunnerEvent[],
        currentScene: CurrentScene | undefined
    ): string {
        const { mapName } = this.engine.getSerializedInMissionSummary()

        // A PLAY_MOVIE reward may fire before deployment begins (e.g. an intro cutscene) —
        // give it priority over the deployment screen while it's playing.
        if (
            this.engine.isCampaignSquaddieDeploymentInProgress() &&
            !this.engine.isMoviePlaying()
        ) {
            return [
                ...this.titleLines(mapName),
                "Deploy your squad before the mission begins. Enter '?' for deployment commands.",
                "",
                DeploymentInspector.formatStatus(this.engine),
            ].join("\n")
        }

        const lines: string[] = [
            ...this.titleLines(mapName),
            "Game engine initialized.",
            "Enter 'Q' to quit, '?' for commands.",
        ]

        const phaseText = this.render(initialPhaseEvents)
        if (phaseText.length > 0) {
            lines.push("", phaseText)
        }

        // A PLAY_MOVIE reward may have fired while advancing through the mission's opening phases.
        // Hold off on the objectives list until the movie finishes so the two aren't shown together.
        if (this.engine.isMoviePlaying()) {
            lines.push("", this.sceneText(currentScene))
        } else {
            const objectivesDisplay = this.objectivesDisplayText()
            if (objectivesDisplay.length > 0) {
                lines.push("", objectivesDisplay)
            }
        }

        return lines.join("\n")
    }

    // Returns the overlay map (with target/movement highlights) when one is active, otherwise the
    // plain map. Used by the split-pane UI to refresh the left panel after each command.
    mapText(overlayMap: string | undefined): string {
        if (this.engine.isCampaignSquaddieDeploymentInProgress()) {
            return DeploymentInspector.renderDeploymentMap(this.engine)
        }
        if (overlayMap != undefined) {
            return overlayMap
        }
        const { overview, turnNumber, currentAffiliation, squaddieAffiliations } =
            baseRenderInfo(this.engine)
        const objectivesDisplay = this.objectivesDisplayText()
        const renderInfo: MapRenderInfo = {
            turnNumber,
            currentAffiliation,
            squaddieAffiliations,
            objectivesDisplay: objectivesDisplay.length > 0 ? objectivesDisplay : undefined,
            mapName: this.engine.getSerializedInMissionSummary().mapName,
        }
        return renderMap(overview, renderInfo)
    }

    // Turns the runner's event list into display text: each event to a line (or block),
    // empties dropped, joined by newlines.
    render(events: RunnerEvent[]): string {
        return events
            .map((event) => this.renderEvent(event))
            .filter((text) => text.length > 0)
            .join("\n")
    }

    private renderEvent(event: RunnerEvent): string {
        switch (event.kind) {
            case "message":
                return event.text
            case "phaseAnnouncement":
                return this.phaseAnnouncementText(event)
            case "conditionExpired":
                return `${event.squaddieName}'s ${conditionTypeName(
                    event.conditionType
                )} expired`
            case "movieScene":
                return sceneDisplayText(event.scene)
            case "invalidMovieInput":
                return event.reason === "command"
                    ? `"${event.input}" is not a valid command while a movie is playing.`
                    : `"${event.input}" is not a valid choice.`
            case "missionSummary":
                return this.missionSummaryText(event)
        }
    }

    private phaseAnnouncementText(event: PhaseAnnouncementEvent): string {
        if (event.phase === MissionAffiliationTurn.TURN_START) {
            return `Turn ${event.turnNumber} start`
        }

        const labels: Partial<Record<string, string>> = {
            [MissionAffiliationTurn.PLAYER_TURN_START]: "Player Turn",
            [MissionAffiliationTurn.ALLY_TURN_START]: "Ally Turn",
            [MissionAffiliationTurn.ENEMY_TURN_START]: "Enemy Turn",
            [MissionAffiliationTurn.NONE_AFFILIATION_TURN_START]: "Neutral Turn",
            [MissionAffiliationTurn.TURN_END]: "End of Turn",
        }

        return labels[event.phase] ?? ""
    }

    private missionSummaryText(event: MissionSummaryEvent): string {
        const lines: string[] = [
            event.isFailure ? "Mission Failed!" : "Mission Complete!",
            `Completed on turn ${event.turnNumber}.`,
        ]
        if (event.survivorNames.length > 0) {
            lines.push(`Survivors: ${event.survivorNames.join(", ")}`)
        }
        return lines.join("\n")
    }
}
