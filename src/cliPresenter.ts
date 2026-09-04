import type { MissionEngine } from "../logic/src/mission/missionEngine/missionEngine.js"
import { sceneDisplayText } from "./movieSceneInspector.js"
import { MissionObjectiveInspector } from "./missionObjectiveInspector.js"
import { renderMap, type MapRenderInfo } from "./mapRenderer.js"
import { baseRenderInfo } from "./mapDataGatherer.js"
import { MissionTextSubstitutionToken } from "../logic/src/mission/missionEngine/textSubstitutionTokens.js"
import { DeploymentInspector } from "./deploymentInspector.js"

type MovieStatus = ReturnType<MissionEngine["getMovieStatus"]>

// CliPresenter owns the text rendering the runner used to do inline. It holds only a
// reference to the engine; anything that lives on the runner (in-progress phase messages,
// the active overlay map, elapsed decision time) is passed in per call. This is step 1 of
// separating the renderer-agnostic mission lifecycle from CLI-specific presentation.
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

    // Dialogue text may reference {TIME_ELAPSED} (e.g. via timeFormat()), which throws on
    // substitution if the token is missing — so every getMovieStatus() call must supply it.
    movieStatus(elapsedDecisionTimeMs: number): MovieStatus {
        return this.engine.getMovieStatus({
            [MissionTextSubstitutionToken.TIME_ELAPSED]: String(
                elapsedDecisionTimeMs
            ),
        })
    }

    currentSceneText(elapsedDecisionTimeMs: number): string {
        const status = this.movieStatus(elapsedDecisionTimeMs)
        if (status == undefined || status.currentScene == undefined) return ""
        return sceneDisplayText(status.currentScene)
    }

    welcomeText(
        initialPhaseMessages: string[],
        elapsedDecisionTimeMs: number
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

        if (initialPhaseMessages.length > 0) {
            lines.push("", ...initialPhaseMessages)
        }

        // A PLAY_MOVIE reward may have fired while advancing through the mission's opening phases.
        // Hold off on the objectives list until the movie finishes so the two aren't shown together.
        if (this.engine.isMoviePlaying()) {
            lines.push("", this.currentSceneText(elapsedDecisionTimeMs))
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
}
