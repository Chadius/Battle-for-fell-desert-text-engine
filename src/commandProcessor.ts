import type { MissionEngine } from "../logic/src/mission/missionEngine/missionEngine.js"
import type { BattleSquaddieId } from "../logic/src/squaddie/inBattle/inBattleSquaddieManager.js"
import {
    MissionTurnService,
    type TMissionAffiliationTurn,
} from "../logic/src/mission/missionTurn.js"
import type { TSquaddieAffiliation } from "../logic/src/affiliation/affiliation.js"
import { renderMap, type MapRenderInfo } from "./mapRenderer.js"
import { parseCoordinate, inspectCoordinate } from "./coordinateInspector.js"
import { formatSquaddieDetails } from "./squaddieDetailInspector.js"
import { SquaddieActionInspector} from "./squaddieActionInspector.js"
import type { SquaddieAction } from "../logic/src/squaddieAction/squaddieAction.js"
import { ControllableSquaddieInspector } from "./controllableSquaddieInspector.js"
import { MissionObjectiveInspector } from "./missionObjectiveInspector.js"

export const InteractionPhase = {
    BROWSING: "BROWSING",
    SELECTING_ACTION: "SELECTING_ACTION",
    SELECTING_TARGET: "SELECTING_TARGET",
    CONFIRMING_ACTION: "CONFIRMING_ACTION",
    VIEWING_RESULTS: "VIEWING_RESULTS",
} as const

export type TInteractionPhase = (typeof InteractionPhase)[keyof typeof InteractionPhase]

export type CommandAction =
    | "quit"
    | "echo"
    | "showMap"
    | "showCommands"
    | "showPhase"
    | "showObjectives"
    | "inspectCoordinate"
    | "lookAtSquaddie"
    | "listControllableSquaddies"

export interface CommandContext {
    selectedSquaddieId: BattleSquaddieId | undefined
    interactionPhase: TInteractionPhase
    actingSquaddieId: BattleSquaddieId | undefined
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

    if (normalizedInput === "W") {
        return handleListControllableSquaddies(engine)
    }

    if (normalizedInput === "P") {
        return handleShowPhase(engine)
    }

    if (normalizedInput === "O") {
        return handleShowObjectives(engine)
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
        "O - Show objectives",
        "W - Who can act this phase?",
        "P - Show current phase",
        "row, col - Inspect a coordinate",
    ]

    if (context?.selectedSquaddieId != undefined) {
        commandList.push("L - Look at selected squaddie")
    }

    commandList.push("Q - Quit the game", "? - Show all commands")

    return { action: "showCommands", message: commandList.join("\n") }
}

const buildSquaddieAffiliations = (
    engine: MissionEngine,
    overview: ReturnType<MissionEngine["getMapOverview"]>
): Map<string, TSquaddieAffiliation> => {
    const squaddieAffiliations = new Map<string, TSquaddieAffiliation>()
    for (const row of overview.tiles) {
        for (const tile of row) {
            if (tile.squaddieId != undefined) {
                const info = engine.getSquaddieInfo(tile.squaddieId)
                squaddieAffiliations.set(
                    tile.squaddieId.outOfBattleSquaddieId,
                    info.affiliation
                )
            }
        }
    }
    return squaddieAffiliations
}

const handleShowMap = (engine?: MissionEngine): CommandResult => {
    if (engine == undefined) {
        return {
            action: "showMap",
            message: "No engine available to display the map.",
        }
    }

    const overview = engine.getMapOverview()

    const turnNumber = engine.getCurrentTurnNumber()
    const affiliationTurn = engine.getCurrentAffiliationTurn()
    const currentAffiliation =
        MissionTurnService.getSquaddieAffiliationForAffiliationTurn(
            affiliationTurn
        )
    const squaddieAffiliations = buildSquaddieAffiliations(engine, overview)
    const objectiveEntries = MissionObjectiveInspector.gatherEntries(engine)
    const objectivesDisplay = MissionObjectiveInspector.formatEntries(objectiveEntries)

    const renderInfo: MapRenderInfo = {
        turnNumber,
        currentAffiliation,
        squaddieAffiliations,
        objectivesDisplay: objectivesDisplay.length > 0 ? objectivesDisplay : undefined,
    }

    return { action: "showMap", message: renderMap(overview, renderInfo) }
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
        updatedContext: {
            selectedSquaddieId: squaddieId,
            interactionPhase: InteractionPhase.BROWSING,
            actingSquaddieId: undefined,
        },
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

    const validity = engine.getSquaddieActionValidity(
        context.selectedSquaddieId
    )
    const actionsById = new Map<string, SquaddieAction>()
    for (const validAction of validity.validActions) {
        actionsById.set(
            validAction.actionId,
            engine.getActionById(validAction.actionId)
        )
    }
    const actionsOutput = SquaddieActionInspector.formatSquaddieActions(validity, actionsById)
    if (actionsOutput.length > 0) {
        lines.push(actionsOutput)
    }

    return {
        action: "lookAtSquaddie",
        message: lines.join("\n"),
    }
}

const handleListControllableSquaddies = (
    engine?: MissionEngine
): CommandResult => {
    if (engine == undefined) {
        return {
            action: "listControllableSquaddies",
            message: "No engine available to list controllable squaddies.",
        }
    }
    const entries = ControllableSquaddieInspector.gatherEntries(engine)
    const message = ControllableSquaddieInspector.formatEntries(entries)
    return { action: "listControllableSquaddies", message }
}

const handleShowObjectives = (engine?: MissionEngine): CommandResult => {
    if (engine == undefined) {
        return {
            action: "showObjectives",
            message: "No engine available to show objectives.",
        }
    }

    const entries = MissionObjectiveInspector.gatherEntries(engine)
    const message = MissionObjectiveInspector.formatEntries(entries)

    return {
        action: "showObjectives",
        message: message.length > 0 ? message : "No objectives.",
    }
}

export const transitionToNextPhase = (
    engine: MissionEngine
): TMissionAffiliationTurn => {
    engine.transitionToNextPhase()
    return engine.getCurrentAffiliationTurn()
}

const formatPhaseName = (phase: TMissionAffiliationTurn): string => {
    return phase
        .split("_")
        .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
        .join(" ")
}

const handleShowPhase = (engine?: MissionEngine): CommandResult => {
    if (engine == undefined) {
        return {
            action: "showPhase",
            message: "No engine available to show phase.",
        }
    }
    const phase = engine.getCurrentAffiliationTurn()
    const turnNumber = engine.getCurrentTurnNumber()
    return {
        action: "showPhase",
        message: `Turn ${turnNumber} - ${formatPhaseName(phase)}`,
    }
}
