import type {MissionEngine} from "../logic/src/mission/missionEngine/missionEngine.js"
import type {DebugFlags} from "../logic/src/mission/debugFlags.js"
import type {BattleSquaddieId} from "../logic/src/squaddie/inBattle/battleSquaddieId.js"
import {MissionTurnService, type TMissionAffiliationTurn,} from "../logic/src/mission/missionTurn.js"
import type {TSquaddieAffiliation} from "../logic/src/affiliation/affiliation.js"
import {type MapRenderInfo, renderMap} from "./mapRenderer.js"
import {inspectCoordinate, parseCoordinate} from "./coordinateInspector.js"
import {formatSquaddieDetails} from "./squaddieDetailInspector.js"
import {SquaddieActionInspector} from "./squaddieActionInspector.js"
import type {SquaddieAction} from "../logic/src/squaddieAction/squaddieAction.js"
import {ControllableSquaddieInspector} from "./controllableSquaddieInspector.js"
import {MissionObjectiveInspector} from "./missionObjectiveInspector.js"
import {MovementInspector,} from "./movementInspector.js"
import {ActionResultInspector} from "./actionResultInspector.js"
import {OffsetCoordinate} from "../logic/src/coordinateMap/offsetCoordinate.js";
import {CoordinateCalculator} from "../logic/src/coordinateMap/coordinateCalculator.js";

// Ordered list of all known debug flags. Index 1-based maps to DS <n> commands.
// Append new flags here as they are added to DebugFlags.
export const DEBUG_FLAG_NAMES: (keyof DebugFlags)[] = ["enemyAlwaysEndsTheirTurn"]

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
    | "selectAction"
    | "moveSquaddie"
    | "executeAction"
    | "cancelAction"
    | "undoAction"
    | "showDebugFlags"
    | "setDebugFlag"

export interface CommandContext {
    selectedSquaddieId: BattleSquaddieId | undefined
    interactionPhase: TInteractionPhase
    actingSquaddieId: BattleSquaddieId | undefined
    pendingActionId?: string
    pendingTargetCount?: number
    // True when the pending action moves the actor to a player-chosen destination
    // (ACTOR_CHOSEN or ACTOR_CHOSEN_SPECIAL_TRAVERSAL). Routes SELECTING_TARGET
    // input to the actor-chosen movement handler instead of the combat handler.
    pendingActionIsActorChosenMovement?: boolean
    // Stores the primary target chosen in phase 1 of a teleport action (e.g. Rescue).
    // Used in phase 2 (destination selection) to call readyAction with both target and destination.
    pendingTeleportTargetId?: BattleSquaddieId
    // True when in the destination-selection phase of a teleport action.
    // Routes SELECTING_TARGET input to handleTeleportDestinationSelection instead of the combat handler.
    pendingActionIsSelectingTeleportDestination?: boolean
}

export interface CommandResult {
    action: CommandAction
    message: string
    mapText?: string
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
        return handleShowCommands(context, engine)
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

    if (normalizedInput === "Z") {
        return handleUndoAction(engine)
    }

    if (context?.interactionPhase === InteractionPhase.CONFIRMING_ACTION) {
        return handleActionConfirmation(normalizedInput, engine, context)
    }

    if (context?.interactionPhase === InteractionPhase.SELECTING_TARGET) {
        if (context.pendingActionId === "default-move") {
            return handleMovementTargetSelection(rawInput, engine, context)
        }
        if (context.pendingActionIsActorChosenMovement) {
            return handleActorChosenMovementTargetSelection(rawInput, engine, context)
        }
        // Phase 2 of teleport: player is choosing where to place the rescued target.
        if (context.pendingActionIsSelectingTeleportDestination) {
            return handleTeleportDestinationSelection(rawInput, engine, context)
        }
        return handleCombatActionTargetSelection(rawInput, engine, context)
    }

    if (normalizedInput.startsWith("A")) {
        return handleSelectAction(normalizedInput, engine, context)
    }

    if (normalizedInput === "DF") {
        return handleShowDebugFlags(engine)
    }

    if (normalizedInput.startsWith("DS")) {
        return handleSetDebugFlag(normalizedInput, engine)
    }

    const coordinate = parseCoordinate(rawInput)
    if (coordinate != undefined) {
        return handleInspectCoordinate(engine, coordinate)
    }

    return { action: "echo", message: `You entered: ${rawInput}` }
}

const handleShowCommands = (context?: CommandContext, engine?: MissionEngine): CommandResult => {
    const commandList = [
        "M - Show the map",
        "O - Show objectives",
        "W - Who can act this phase?",
        "P - Show current phase",
        "row, col - Inspect a coordinate",
    ]

    if (context?.selectedSquaddieId != undefined) {
        commandList.push("L - Look at selected squaddie", "A - Select action")
    }

    commandList.push("Z - Undo last action", "Q - Quit the game", "? - Show all commands")
    commandList.push("DF - Show debug flags", "DS <n> - Toggle debug flag by number")

    // Append turn flow explanation
    commandList.push("", "Turn Flow: Player Turn → Enemy Turn → Ally Turn → Other Turn → next round")

    // Append objectives summary if an engine is available
    if (engine != undefined) {
        const entries = MissionObjectiveInspector.gatherEntries(engine)
        const objectivesSummary = MissionObjectiveInspector.formatEntries(entries)
        if (objectivesSummary.length > 0) {
            commandList.push("", objectivesSummary)
        }
    }

    return { action: "showCommands", message: commandList.join("\n") }
}

// Returns all debug flags and their current ON/OFF values, numbered for use with DS.
const handleShowDebugFlags = (engine?: MissionEngine): CommandResult => {
    if (engine == undefined) {
        return { action: "showDebugFlags", message: "No engine available." }
    }

    const flags = engine.getDebugFlags() ?? {}
    const lines = DEBUG_FLAG_NAMES.map((name, index) => {
        const value = flags[name] === true ? "ON" : "OFF"
        return `${index + 1}. ${name}: ${value}`
    })

    return { action: "showDebugFlags", message: lines.join("\n") }
}

// Toggles a debug flag by 1-based number (matching the DF display).
// Input format: "DS 1"
const handleSetDebugFlag = (
    normalizedInput: string,
    engine?: MissionEngine
): CommandResult => {
    if (engine == undefined) {
        return { action: "setDebugFlag", message: "No engine available." }
    }

    const numberStr = normalizedInput.slice(2).trim()
    const flagIndex = parseInt(numberStr, 10) - 1

    if (
        numberStr === "" ||
        isNaN(flagIndex) ||
        flagIndex < 0 ||
        flagIndex >= DEBUG_FLAG_NAMES.length
    ) {
        return {
            action: "setDebugFlag",
            message: `Invalid flag number. Use DF to list flags and DS <n> to toggle.`,
        }
    }

    const flagName = DEBUG_FLAG_NAMES[flagIndex]
    const currentFlags = engine.getDebugFlags() ?? {}
    const newValue = !(currentFlags[flagName] === true)
    engine.setDebugFlag(flagName, newValue)

    return {
        action: "setDebugFlag",
        message: `${flagName}: ${newValue ? "ON" : "OFF"}`,
    }
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

// Renders the map with the action line, aim coordinate, and hit targets highlighted.
// "//" marks cells the bolt passes through; "<>" marks the aim coordinate; "HT" marks squaddies that will be hit.
// Both inBattleSquaddieId and outOfBattleSquaddieId must match to correctly identify targets
// (inBattleSquaddieId is an index per outOfBattleSquaddieId, not a global unique ID).
const buildActionEffectMapText = (
    aimCoordinate: OffsetCoordinate,
    allTargetIds: BattleSquaddieId[],
    actingSquaddieId: BattleSquaddieId,
    engine: MissionEngine
): string => {
    const squaddiePositions = engine.getAllSquaddiePositions()

    const hitPositions = squaddiePositions
        .filter((p) =>
            allTargetIds.some(
                (t) =>
                    t.inBattleSquaddieId === p.squaddieId.inBattleSquaddieId &&
                    t.outOfBattleSquaddieId === p.squaddieId.outOfBattleSquaddieId
            )
        )
        .map((p) => p.coordinate)

    // Find actor's position to compute the line path. Exclude the actor's own cell (index 0)
    // so the actor's symbol shows normally rather than being replaced by "//".
    const actorEntry = squaddiePositions.find(
        (p) =>
            p.squaddieId.inBattleSquaddieId === actingSquaddieId.inBattleSquaddieId &&
            p.squaddieId.outOfBattleSquaddieId === actingSquaddieId.outOfBattleSquaddieId
    )
    const lineCoordinates: OffsetCoordinate[] | undefined =
        actorEntry?.coordinate.row != undefined &&
        actorEntry?.coordinate.col != undefined
            ? CoordinateCalculator.calculateEveryCoordinateInLine(
                  { row: actorEntry.coordinate.row, col: actorEntry.coordinate.col },
                  aimCoordinate
              ).slice(1)
            : undefined

    const tileOverlays = MovementInspector.buildActionEffectOverlay(aimCoordinate, hitPositions, lineCoordinates)
    const overview = engine.getMapOverview()
    const turnNumber = engine.getCurrentTurnNumber()
    const affiliationTurn = engine.getCurrentAffiliationTurn()
    const currentAffiliation =
        MissionTurnService.getSquaddieAffiliationForAffiliationTurn(affiliationTurn)
    const squaddieAffiliations = buildSquaddieAffiliations(engine, overview)
    return renderMap(overview, {
        turnNumber,
        currentAffiliation,
        squaddieAffiliations,
        tileOverlays,
    })
}

const handleShowMap = (engine?: MissionEngine): CommandResult => {
    if (engine == undefined) {
        return {
            action: "showMap",
            message: "No engine available to display the map.",
        }
    }

    const overview = engine.getMapOverview()
    const summary = engine.getSerializedInMissionSummary()

    const turnNumber = engine.getCurrentTurnNumber()
    const affiliationTurn = engine.getCurrentAffiliationTurn()
    const currentAffiliation =
        MissionTurnService.getSquaddieAffiliationForAffiliationTurn(
            affiliationTurn
        )
    const squaddieAffiliations = buildSquaddieAffiliations(engine, overview)
    const objectiveEntries = MissionObjectiveInspector.gatherEntries(engine)
    const objectivesDisplay =
        MissionObjectiveInspector.formatEntries(objectiveEntries)

    const renderInfo: MapRenderInfo = {
        turnNumber,
        currentAffiliation,
        squaddieAffiliations,
        objectivesDisplay:
            objectivesDisplay.length > 0 ? objectivesDisplay : undefined,
        mapName: summary.mapName,
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
            pendingActionId: undefined,
        },
    }
}

const buildActionsById = (
    engine: MissionEngine,
    validity: ReturnType<MissionEngine["getSquaddieActionValidity"]>
): Map<string, SquaddieAction> => {
    const actionsById = new Map<string, SquaddieAction>()
    for (const validAction of validity.validActions) {
        actionsById.set(validAction.actionId, engine.getActionById(validAction.actionId))
    }
    for (const invalidAction of validity.invalidActions) {
        actionsById.set(invalidAction.actionId, engine.getActionById(invalidAction.actionId))
    }
    return actionsById
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

    const validity = engine.getSquaddieActionValidity(context.selectedSquaddieId)
    const actionsById = buildActionsById(engine, validity)
    const actionsOutput = SquaddieActionInspector.formatSquaddieActionsWithKeys(
        validity,
        actionsById
    )
    if (actionsOutput.length > 0) {
        lines.push(actionsOutput)
    }

    return {
        action: "lookAtSquaddie",
        message: lines.join("\n"),
    }
}

const handleListActions = (
    engine: MissionEngine,
    context: CommandContext
): CommandResult => {
    if (context?.selectedSquaddieId == undefined) {
        throw new Error("No squaddie was selected.")
    }

    const validity = engine.getSquaddieActionValidity(context.selectedSquaddieId)
    const actionsById = buildActionsById(engine, validity)
    const message = SquaddieActionInspector.formatSquaddieActionsWithKeys(
        validity,
        actionsById
    )

    return {action: "selectAction", message}
}

const actionKeyMap: Record<string, string> = {
    E: "default-end-turn",
    M: "default-move",
}

const handleSelectAction = (
    normalizedInput: string,
    engine: MissionEngine | undefined,
    context: CommandContext | undefined
): CommandResult => {
    if (engine == undefined) {
        return {
            action: "selectAction",
            message: "No engine available to select actions.",
        }
    }

    if (context?.selectedSquaddieId == undefined) {
        return {
            action: "selectAction",
            message:
                "No squaddie selected. Inspect a coordinate with a squaddie first.",
        }
    }

    // A alone is read-only, so allow it for any selected squaddie regardless of affiliation
    if (normalizedInput === "A") {
        return handleListActions(engine, context)
    }

    // Guard: state-mutating sub-commands require the selected squaddie to belong to the current phase
    const phaseAffiliation = MissionTurnService.getSquaddieAffiliationForAffiliationTurn(
        engine.getCurrentAffiliationTurn()
    )
    const selectedSquaddieInfo = engine.getSquaddieInfo(context.selectedSquaddieId)
    if (phaseAffiliation == undefined || phaseAffiliation !== selectedSquaddieInfo.affiliation) {
        return {
            action: "selectAction",
            message: `Cannot command ${selectedSquaddieInfo.name}: it is not ${selectedSquaddieInfo.affiliation}'s turn.`,
        }
    }

    const actionSuffix = normalizedInput.substring(1)

    if (/^\d+$/.test(actionSuffix)) {
        return handleSelectNumberedAction(Number.parseInt(actionSuffix), engine, context)
    }

    const actionId = actionKeyMap[actionSuffix]
    if (actionId === "default-end-turn") {
        return handleEndTurn(engine, context)
    }
    if (actionId === "default-move") {
        return handleInitiateMovement(engine, context)
    }

    return {
        action: "selectAction",
        message: `Unknown action key: ${actionSuffix}`,
    }
}

const handleSelectNumberedAction = (
    num: number,
    engine: MissionEngine,
    context: CommandContext
): CommandResult => {
    const actingSquaddieId = context.selectedSquaddieId!
    const validity = engine.getSquaddieActionValidity(actingSquaddieId)
    const combatIndex = SquaddieActionInspector.buildCombatActionIndex(validity)

    const actionId = combatIndex[num - 1]
    if (actionId == undefined) {
        return {
            action: "selectAction",
            message: `No action at number ${num}.`,
        }
    }

    const invalidAction = validity.invalidActions.find(
        (a) => a.actionId === actionId
    )
    if (invalidAction != undefined) {
        // Actions that require a destination decision (e.g. Rescue) are always categorized as
        // invalid because the destination isn't chosen yet. Allow them to proceed through the
        // two-step target → destination flow.
        const decisions = engine.getRequiredDecisionsForAction(actionId)
        if (!decisions.requiresTargetDestination) {
            return {
                action: "selectAction",
                message: `Cannot use ${invalidAction.actionName}: ${invalidAction.reason}`,
            }
        }
    }

    return handleInitiateCombatAction(actionId, engine, context)
}

const handleInitiateCombatActionWith1Target = (targetIds: BattleSquaddieId[], engine: MissionEngine, actingSquaddieId: BattleSquaddieId, actionId: string, aimCoordinate: OffsetCoordinate): CommandResult => {
    const targetId = targetIds[0]

    // If the action requires a destination for the target (e.g. Rescue), skip readyAction here
    // and start destination selection instead. readyAction will be called in phase 2 with both
    // the target and the destination decision.
    const decisions = engine.getRequiredDecisionsForAction(actionId)
    if (decisions.requiresTargetDestination) {
        return handleAfterTeleportPrimaryTargetSelected(targetId, actingSquaddieId, actionId, engine)
    }

    const readyResult = engine.readyAction({
        actor: actingSquaddieId,
        targets: [targetId],
        action: {id: actionId},
    })

    if (!readyResult.isValid) {
        return {
            action: "selectAction",
            message: readyResult.message ?? "Cannot perform this action.",
        }
    }

    const forecasts = engine.previewReadiedActionAndForecastResults()
    const targetName = engine.getSquaddieInfo(targetId).name
    const forecastText = SquaddieActionInspector.formatForecast(
        forecasts,
        targetName
    )

    const mapText = buildActionEffectMapText(aimCoordinate, targetIds, actingSquaddieId, engine)

    return {
        action: "executeAction",
        mapText,
        message: forecastText + "\nPress Y to confirm or N/C to cancel.",
        updatedContext: {
            selectedSquaddieId: actingSquaddieId,
            interactionPhase: InteractionPhase.CONFIRMING_ACTION,
            actingSquaddieId,
            pendingActionId: actionId,
            pendingTargetCount: 1,
        },
    }
}
// When actorIsAimCoordinate is true, the actor's own position is the aim coordinate.
// Skip target selection and go directly to the forecast + CONFIRMING_ACTION step.
const handleInitiateCombatActionWithActorAsAimCoordinate = (
    actionId: string,
    engine: MissionEngine,
    actingSquaddieId: BattleSquaddieId
): CommandResult => {
    const actorPosition = engine.getAllSquaddiePositions().find(
        (p) =>
            p.squaddieId.inBattleSquaddieId === actingSquaddieId.inBattleSquaddieId &&
            p.squaddieId.outOfBattleSquaddieId === actingSquaddieId.outOfBattleSquaddieId
    )
    if (actorPosition == undefined) {
        return { action: "selectAction", message: "Cannot find actor position." }
    }

    const aimCoordinate = actorPosition.coordinate
    const allTargetIds = engine.getTargetsForAimCoordinate({
        actor: actingSquaddieId,
        actionId,
        aimCoordinate,
    })

    if (allTargetIds.length === 0) {
        return { action: "selectAction", message: "No targets in range for this action." }
    }

    const readyResult = engine.readyAction({
        actor: actingSquaddieId,
        targets: allTargetIds,
        action: { id: actionId },
    })
    if (!readyResult.isValid) {
        return { action: "selectAction", message: readyResult.message ?? "Cannot perform this action." }
    }

    const forecasts = engine.previewReadiedActionAndForecastResults()
    const forecastText = allTargetIds
        .map((targetId) => {
            const targetForecasts = forecasts.filter(
                (f) => f.battleSquaddieId.inBattleSquaddieId === targetId.inBattleSquaddieId
            )
            return SquaddieActionInspector.formatForecast(targetForecasts, engine.getSquaddieInfo(targetId).name)
        })
        .join("\n")

    const mapText = buildActionEffectMapText(aimCoordinate, allTargetIds, actingSquaddieId, engine)

    return {
        action: "executeAction",
        mapText,
        message: forecastText + "\nPress Y to confirm or N/C to cancel.",
        updatedContext: {
            selectedSquaddieId: actingSquaddieId,
            interactionPhase: InteractionPhase.CONFIRMING_ACTION,
            actingSquaddieId,
            pendingActionId: actionId,
            pendingTargetCount: allTargetIds.length,
        },
    }
}

const handleInitiateCombatAction = (
    actionId: string,
    engine: MissionEngine,
    context: CommandContext
): CommandResult => {
    const actingSquaddieId = context.selectedSquaddieId!
    const actorInfo = engine.getSquaddieInfo(actingSquaddieId)

    // Ask the engine what decisions the player needs to make for this action.
    const decisions = engine.getRequiredDecisionsForAction(actionId)

    // Actor needs to choose a destination (e.g. Leap): show destination overlay and enter SELECTING_TARGET.
    if (decisions.requiresTargetDestination && !decisions.requiresSpecificTarget) {
        return handleInitiateActorChosenMovementAction(actionId, engine, context)
    }

    // Aim-coordinate actions: if the actor IS the aim coordinate (e.g. Gravity Pull), skip
    // target selection and use the actor's position directly.
    if (decisions.requiresAimCoordinate && decisions.actorIsAimCoordinate) {
        return handleInitiateCombatActionWithActorAsAimCoordinate(actionId, engine, actingSquaddieId)
    }

    // Aim-coordinate actions (e.g. future LINE/CONE): show aim area, player picks a coordinate.
    if (decisions.requiresAimCoordinate) {
        const aimCoordinates = engine.getAimCoordinatesForAction({ actor: actingSquaddieId, actionId })
        if (aimCoordinates.length === 0) {
            return { action: "selectAction", message: `No valid aim coordinates for this action.` }
        }
        const tileOverlays = MovementInspector.buildTargetOverlay(aimCoordinates)
        const overview = engine.getMapOverview()
        const turnNumber = engine.getCurrentTurnNumber()
        const affiliationTurn = engine.getCurrentAffiliationTurn()
        const currentAffiliation = MissionTurnService.getSquaddieAffiliationForAffiliationTurn(affiliationTurn)
        const squaddieAffiliations = buildSquaddieAffiliations(engine, overview)
        const mapText = renderMap(overview, { turnNumber, currentAffiliation, squaddieAffiliations, tileOverlays })
        return {
            action: "executeAction",
            mapText,
            message: `${actorInfo.name}: Select aim coordinate (or enter invalid coordinate to cancel):`,
            updatedContext: {
                selectedSquaddieId: actingSquaddieId,
                interactionPhase: InteractionPhase.SELECTING_TARGET,
                actingSquaddieId,
                pendingActionId: actionId,
                pendingTargetCount: aimCoordinates.length,
            },
        }
    }

    const validity = engine.getSquaddieActionValidity(actingSquaddieId)
    const validAction = validity.validActions.find((a) => a.actionId === actionId)

    // Specific-target actions with a destination step (e.g. Rescue) are always in invalidActions
    // because the destination isn't chosen yet. Compute their aim coordinates directly.
    const teleportAimCoordinates = (decisions.requiresSpecificTarget && decisions.requiresTargetDestination)
        ? engine.getAimCoordinatesForAction({ actor: actingSquaddieId, actionId })
        : undefined

    if (validAction == undefined && teleportAimCoordinates == undefined) {
        return {
            action: "selectAction",
            message: `Action ${actionId} is not valid.`,
        }
    }

    // Use pre-computed aim coordinates from validity when available; fall back to the directly-
    // computed ones for actions that also require a destination (e.g. Rescue).
    const validAimCoordinates = (teleportAimCoordinates ?? validAction!.aimCoordinateResults).filter(
        (c) => c.targetIds.length > 0
    )

    if (validAimCoordinates.length === 1) {
        return handleInitiateCombatActionWith1Target(
            validAimCoordinates[0].targetIds,
            engine,
            actingSquaddieId,
            actionId,
            validAimCoordinates[0].aimCoordinate
        )
    }

    const tileOverlays = MovementInspector.buildTargetOverlay(validAimCoordinates)
    const overview = engine.getMapOverview()
    const turnNumber = engine.getCurrentTurnNumber()
    const affiliationTurn = engine.getCurrentAffiliationTurn()
    const currentAffiliation =
        MissionTurnService.getSquaddieAffiliationForAffiliationTurn(affiliationTurn)
    const squaddieAffiliations = buildSquaddieAffiliations(engine, overview)

    const renderInfo: MapRenderInfo = {
        turnNumber,
        currentAffiliation,
        squaddieAffiliations,
        tileOverlays,
    }

    const mapText = renderMap(overview, renderInfo)
    const message = `${actorInfo.name}: Select target (or enter invalid coordinate to cancel):`

    return {
        action: "executeAction",
        mapText,
        message,
        updatedContext: {
            selectedSquaddieId: actingSquaddieId,
            interactionPhase: InteractionPhase.SELECTING_TARGET,
            actingSquaddieId,
            pendingActionId: actionId,
            pendingTargetCount: validAimCoordinates.length,
        },
    }
}

const handleCombatActionTargetSelection = (
    rawInput: string,
    engine: MissionEngine | undefined,
    context: CommandContext
): CommandResult => {
    if (engine == undefined) {
        return {
            action: "cancelAction",
            message: "No engine available to execute action.",
            updatedContext: {
                selectedSquaddieId: undefined,
                interactionPhase: InteractionPhase.BROWSING,
                actingSquaddieId: undefined,
                pendingActionId: undefined,
            },
        }
    }

    const desiredCoordinate = parseCoordinate(rawInput)
    if (desiredCoordinate == undefined) {
        return {
            action: "cancelAction",
            message: "Action cancelled.",
            updatedContext: {
                selectedSquaddieId: undefined,
                interactionPhase: InteractionPhase.BROWSING,
                actingSquaddieId: undefined,
                pendingActionId: undefined,
            },
        }
    }

    const actingSquaddieId = context.actingSquaddieId!
    const pendingActionId = context.pendingActionId!
    const decisions = engine.getRequiredDecisionsForAction(pendingActionId)

    const validActionCheck = handleCombatActionTargetSelectionIsActionValid({
        engine,
        actingSquaddieId,
        context,
        decisions,
    })
    if (!validActionCheck.isValid) {
        return validActionCheck.commandResult!
    }

    // Ask the engine which squaddies would be hit by aiming at the desired coordinate.
    // Returns [] if the coordinate is out of range or no targets are in the action's area.
    const allTargetIds = engine.getTargetsForAimCoordinate({
        actor: actingSquaddieId,
        actionId: pendingActionId,
        aimCoordinate: desiredCoordinate,
    })

    if (allTargetIds.length === 0) {
        return {
            action: "cancelAction",
            message: `No targets in that direction. Action cancelled.`,
            updatedContext: {
                selectedSquaddieId: undefined,
                interactionPhase: InteractionPhase.BROWSING,
                actingSquaddieId: undefined,
                pendingActionId: undefined,
            },
        }
    }

    // If the action requires a destination for the target (e.g. Rescue), enter phase 2
    // (destination selection) instead of readying the action now.
    if (decisions.requiresTargetDestination) {
        return handleAfterTeleportPrimaryTargetSelected(
            allTargetIds[0], actingSquaddieId, pendingActionId, engine
        )
    }

    const readyActionCheck = handleCombatActionTargetSelectionCheckForValidReadyAction({
        engine,
        actingSquaddieId,
        targetSquaddieIds: allTargetIds,
        context,
    })
    if (!readyActionCheck.isValid) {
        return readyActionCheck.commandResult!
    }

    const forecasts = engine.previewReadiedActionAndForecastResults()

    // Single target: show one forecast block. Multiple targets: show one block per target.
    let forecastText: string
    if (allTargetIds.length === 1) {
        const targetName = engine.getSquaddieInfo(allTargetIds[0]).name
        forecastText = SquaddieActionInspector.formatForecast(forecasts, targetName)
    } else {
        forecastText = allTargetIds
            .map((targetId) => {
                const targetForecasts = forecasts.filter(
                    (f) => f.battleSquaddieId.inBattleSquaddieId === targetId.inBattleSquaddieId
                )
                const name = engine.getSquaddieInfo(targetId).name
                return SquaddieActionInspector.formatForecast(targetForecasts, name)
            })
            .join("\n")
    }

    const mapText = buildActionEffectMapText(desiredCoordinate, allTargetIds, actingSquaddieId, engine)

    return {
        action: "executeAction",
        mapText,
        message: forecastText + "\nPress Y to confirm or N/C to cancel.",
        updatedContext: {
            selectedSquaddieId: actingSquaddieId,
            interactionPhase: InteractionPhase.CONFIRMING_ACTION,
            actingSquaddieId,
            pendingActionId: context.pendingActionId,
            pendingTargetCount: allTargetIds.length,
        },
    }
}

const handleCombatActionTargetSelectionIsActionValid = (
    {engine, actingSquaddieId, context, decisions}: {
        engine: MissionEngine,
        actingSquaddieId: BattleSquaddieId,
        context: CommandContext
        decisions: { requiresTargetDestination: boolean }
    }
): { isValid: boolean, commandResult?: CommandResult } => {
    const validity = engine.getSquaddieActionValidity(actingSquaddieId)
    const validAction = validity.validActions.find(
        (a) => a.actionId === context.pendingActionId
    )

    // Actions that also require a destination (e.g. Rescue) are always in invalidActions at this
    // stage because the destination hasn't been chosen yet. Allow them to proceed.
    const isKnownTwoPhaseAction =
        decisions.requiresTargetDestination &&
        validity.invalidActions.some((a) => a.actionId === context.pendingActionId)

    if (validAction == undefined && !isKnownTwoPhaseAction) {
        return {
            isValid: false, commandResult: {
                action: "cancelAction",
                message: "Action is no longer valid. Action cancelled.",
                updatedContext: {
                    selectedSquaddieId: undefined,
                    interactionPhase: InteractionPhase.BROWSING,
                    actingSquaddieId: undefined,
                    pendingActionId: undefined,
                },
            }
        }
    }
    return {isValid: true}
}


const handleCombatActionTargetSelectionCheckForValidReadyAction = (
    {engine, actingSquaddieId, targetSquaddieIds, context}: {
        engine: MissionEngine,
        actingSquaddieId: BattleSquaddieId,
        targetSquaddieIds: BattleSquaddieId[],
        context: CommandContext
    }
): { isValid: boolean, commandResult?: CommandResult } => {
    const readyResult = engine.readyAction({
        actor: actingSquaddieId,
        targets: targetSquaddieIds,
        action: {id: context.pendingActionId!},
    })

    if (!readyResult.isValid) {
        return {
            isValid: false, commandResult: {
                action: "cancelAction",
                message: readyResult.message ?? "Cannot perform this action.",
                updatedContext: {
                    selectedSquaddieId: undefined,
                    interactionPhase: InteractionPhase.BROWSING,
                    actingSquaddieId: undefined,
                    pendingActionId: undefined,
                },
            }
        }
    }
    return {isValid: true}
}

const handleActionConfirmation = (
    normalizedInput: string,
    engine: MissionEngine | undefined,
    context: CommandContext
): CommandResult => {
    if (engine == undefined) {
        return {
            action: "cancelAction",
            message: "No engine available.",
            updatedContext: {
                selectedSquaddieId: undefined,
                interactionPhase: InteractionPhase.BROWSING,
                actingSquaddieId: undefined,
                pendingActionId: undefined,
            },
        }
    }

    if (normalizedInput === "Y") {
        const actionResult = engine.useActionAndGetResults()
        const resultText = ActionResultInspector.formatActionResults(
            actionResult,
            engine
        )

        return {
            action: "executeAction",
            message: resultText,
            updatedContext: {
                selectedSquaddieId: undefined,
                interactionPhase: InteractionPhase.BROWSING,
                actingSquaddieId: undefined,
                pendingActionId: undefined,
            },
        }
    }

    if (normalizedInput === "N" || normalizedInput === "C") {
        engine.cancelReadiedAction()

        const pendingTargetCount = context.pendingTargetCount ?? 1

        if (pendingTargetCount > 1) {
            return handleInitiateCombatAction(
                context.pendingActionId!,
                engine,
                context
            )
        }

        return {
            action: "cancelAction",
            message: "Action cancelled.",
            updatedContext: {
                selectedSquaddieId: undefined,
                interactionPhase: InteractionPhase.BROWSING,
                actingSquaddieId: undefined,
                pendingActionId: undefined,
            },
        }
    }

    return {
        action: "executeAction",
        message: "Please type Y to confirm or N/C to cancel.",
        updatedContext: context,
    }
}

const handleEndTurn = (
    engine: MissionEngine,
    context: CommandContext
): CommandResult => {
    const squaddieId = context.selectedSquaddieId!
    const info = engine.getSquaddieInfo(squaddieId)

    engine.endSquaddieTurn(squaddieId)

    return {
        action: "selectAction",
        message: `${info.name} ends their turn.`,
        updatedContext: {
            selectedSquaddieId: undefined,
            interactionPhase: InteractionPhase.BROWSING,
            actingSquaddieId: undefined,
            pendingActionId: undefined,
        },
    }
}

// Starts an actor-chosen movement action (e.g. Leap). Shows the movement
// overlay as a destination hint and prompts the player to pick a tile.
const handleInitiateActorChosenMovementAction = (
    actionId: string,
    engine: MissionEngine,
    context: CommandContext
): CommandResult => {
    const actingSquaddieId = context.selectedSquaddieId!
    const info = engine.getSquaddieInfo(actingSquaddieId)

    // Use the target destinations overlay as a hint. Special traversal rules (e.g.
    // skipping pits for Leap) may allow additional tiles; readyAction is the
    // authoritative validator.
    const movementOptions = engine.getTargetDestinationsForAction(actingSquaddieId, actionId)
    const tileOverlays = MovementInspector.buildMovementOverlay(movementOptions)

    const overview = engine.getMapOverview()
    const turnNumber = engine.getCurrentTurnNumber()
    const affiliationTurn = engine.getCurrentAffiliationTurn()
    const currentAffiliation =
        MissionTurnService.getSquaddieAffiliationForAffiliationTurn(affiliationTurn)
    const squaddieAffiliations = buildSquaddieAffiliations(engine, overview)

    const renderInfo: MapRenderInfo = {
        turnNumber,
        currentAffiliation,
        squaddieAffiliations,
        tileOverlays,
    }

    const mapText = renderMap(overview, renderInfo)
    const actionDef = engine.getActionById(actionId)
    const message = `${info.name}: Select destination for ${actionDef.name} (or enter invalid coordinate to cancel):`

    return {
        action: "executeAction",
        mapText,
        message,
        updatedContext: {
            selectedSquaddieId: actingSquaddieId,
            interactionPhase: InteractionPhase.SELECTING_TARGET,
            actingSquaddieId,
            pendingActionId: actionId,
            pendingActionIsActorChosenMovement: true,
        },
    }
}

// Handles destination input for an actor-chosen movement action (e.g. Leap).
// Calls readyAction with the chosen destination; readyAction validates range.
const handleActorChosenMovementTargetSelection = (
    rawInput: string,
    engine: MissionEngine | undefined,
    context: CommandContext
): CommandResult => {
    if (engine == undefined) {
        return {
            action: "moveSquaddie",
            message: "No engine available to execute movement.",
            updatedContext: {
                selectedSquaddieId: undefined,
                interactionPhase: InteractionPhase.BROWSING,
                actingSquaddieId: undefined,
                pendingActionId: undefined,
            },
        }
    }

    const desiredTargetCoordinate = parseCoordinate(rawInput)
    if (desiredTargetCoordinate == undefined) {
        return {
            action: "moveSquaddie",
            message: "Movement cancelled.",
            updatedContext: {
                selectedSquaddieId: undefined,
                interactionPhase: InteractionPhase.BROWSING,
                actingSquaddieId: undefined,
                pendingActionId: undefined,
            },
        }
    }

    const actingSquaddieId = context.actingSquaddieId!
    const info = engine.getSquaddieInfo(actingSquaddieId)

    const readyResult = engine.readyAction({
        actor: actingSquaddieId,
        targets: [actingSquaddieId],
        action: {
            id: context.pendingActionId!,
            decisions: { targetDestination: desiredTargetCoordinate },
        },
    })

    if (!readyResult.isValid) {
        return {
            action: "moveSquaddie",
            message: readyResult.message ?? "Cannot perform this action.",
            updatedContext: {
                selectedSquaddieId: undefined,
                interactionPhase: InteractionPhase.BROWSING,
                actingSquaddieId: undefined,
                pendingActionId: undefined,
            },
        }
    }

    const actionResult = engine.useActionAndGetResults()

    const movementResult = Object.values(actionResult.targetResults)
        .flatMap((target) => target.squaddieActionResults)
        .find((result) => result.movement != undefined)

    const tileOverlays =
        movementResult?.movement == undefined
            ? new Map<string, string>()
            : MovementInspector.buildRouteOverlay(movementResult.movement.expectedPath)

    const overview = engine.getMapOverview()
    const turnNumber = engine.getCurrentTurnNumber()
    const affiliationTurn = engine.getCurrentAffiliationTurn()
    const currentAffiliation =
        MissionTurnService.getSquaddieAffiliationForAffiliationTurn(affiliationTurn)
    const squaddieAffiliations = buildSquaddieAffiliations(engine, overview)

    const renderInfo: MapRenderInfo = {
        turnNumber,
        currentAffiliation,
        squaddieAffiliations,
        tileOverlays,
    }

    const routeMap = renderMap(overview, renderInfo)

    const apSpent = movementResult?.actionPoints?.spent ?? 0
    const infoAfter = engine.getSquaddieInfo(actingSquaddieId)
    const apRemaining = infoAfter.currentActionPoints

    const actionDef = engine.getActionById(context.pendingActionId!)
    const message = `${info.name} uses ${actionDef.name} to move to (${desiredTargetCoordinate.row}, ${desiredTargetCoordinate.col}), spending ${apSpent} AP (${apRemaining} remaining).`

    return {
        action: "moveSquaddie",
        mapText: routeMap,
        message,
        updatedContext: {
            selectedSquaddieId: undefined,
            interactionPhase: InteractionPhase.BROWSING,
            actingSquaddieId: undefined,
            pendingActionId: undefined,
        },
    }
}

// Phase 1 complete: a teleport primary target has been identified (either auto-selected or
// chosen by the player from a multi-target overlay). Shows valid destination tiles so the
// player can choose where to place the rescued target. Enters SELECTING_TARGET phase 2.
const handleAfterTeleportPrimaryTargetSelected = (
    targetId: BattleSquaddieId,
    actorId: BattleSquaddieId,
    actionId: string,
    engine: MissionEngine
): CommandResult => {
    const validDestinations = engine.getTargetDestinationsForAction(actorId, actionId)
    if (validDestinations.length === 0) {
        return {
            action: "cancelAction",
            message: "No valid destinations for this action.",
            updatedContext: {
                selectedSquaddieId: undefined,
                interactionPhase: InteractionPhase.BROWSING,
                actingSquaddieId: undefined,
                pendingActionId: undefined,
            },
        }
    }

    const tileOverlays = MovementInspector.buildMovementOverlay(validDestinations)

    const overview = engine.getMapOverview()
    const turnNumber = engine.getCurrentTurnNumber()
    const affiliationTurn = engine.getCurrentAffiliationTurn()
    const currentAffiliation =
        MissionTurnService.getSquaddieAffiliationForAffiliationTurn(affiliationTurn)
    const squaddieAffiliations = buildSquaddieAffiliations(engine, overview)

    const renderInfo: MapRenderInfo = {
        turnNumber,
        currentAffiliation,
        squaddieAffiliations,
        tileOverlays,
    }

    const mapText = renderMap(overview, renderInfo)
    const targetName = engine.getSquaddieInfo(targetId).name
    const actorName = engine.getSquaddieInfo(actorId).name
    const actionDef = engine.getActionById(actionId)

    return {
        action: "executeAction",
        mapText,
        message: `${actorName} will use ${actionDef.name} on ${targetName}.\nSelect destination (or enter invalid coordinate to cancel):`,
        updatedContext: {
            selectedSquaddieId: actorId,
            interactionPhase: InteractionPhase.SELECTING_TARGET,
            actingSquaddieId: actorId,
            pendingActionId: actionId,
            pendingTeleportTargetId: targetId,
            pendingActionIsSelectingTeleportDestination: true,
        },
    }
}

// Phase 2 of a teleport action: the player has chosen a destination for the rescued target.
// Calls readyAction with both the target and the destination decision, shows a forecast,
// and enters CONFIRMING_ACTION.
const handleTeleportDestinationSelection = (
    rawInput: string,
    engine: MissionEngine | undefined,
    context: CommandContext
): CommandResult => {
    if (engine == undefined) {
        return {
            action: "cancelAction",
            message: "No engine available to execute action.",
            updatedContext: {
                selectedSquaddieId: undefined,
                interactionPhase: InteractionPhase.BROWSING,
                actingSquaddieId: undefined,
                pendingActionId: undefined,
            },
        }
    }

    const desiredDestination = parseCoordinate(rawInput)
    if (desiredDestination == undefined) {
        return {
            action: "cancelAction",
            message: "Action cancelled.",
            updatedContext: {
                selectedSquaddieId: undefined,
                interactionPhase: InteractionPhase.BROWSING,
                actingSquaddieId: undefined,
                pendingActionId: undefined,
            },
        }
    }

    const actorId = context.actingSquaddieId!
    const targetId = context.pendingTeleportTargetId!
    const actionId = context.pendingActionId!

    const readyResult = engine.readyAction({
        actor: actorId,
        targets: [targetId],
        action: {
            id: actionId,
            decisions: { targetDestination: desiredDestination },
        },
    })

    if (!readyResult.isValid) {
        // Keep the player in destination selection so they can try a different tile.
        return {
            action: "executeAction",
            message: readyResult.message ?? "Invalid destination. Try another tile:",
            updatedContext: context,
        }
    }

    const forecasts = engine.previewReadiedActionAndForecastResults()
    const targetName = engine.getSquaddieInfo(targetId).name
    const actorName = engine.getSquaddieInfo(actorId).name
    const actionDef = engine.getActionById(actionId)
    const forecastText = SquaddieActionInspector.formatForecast(forecasts, targetName)

    const overview = engine.getMapOverview()
    const turnNumber = engine.getCurrentTurnNumber()
    const affiliationTurn = engine.getCurrentAffiliationTurn()
    const currentAffiliation =
        MissionTurnService.getSquaddieAffiliationForAffiliationTurn(affiliationTurn)
    const squaddieAffiliations = buildSquaddieAffiliations(engine, overview)

    // Mark the destination tile to show the player where the target will land.
    const tileOverlays = new Map<string, string>([
        [`${desiredDestination.row},${desiredDestination.col}`, "TG"],
    ])

    const renderInfo: MapRenderInfo = {
        turnNumber,
        currentAffiliation,
        squaddieAffiliations,
        tileOverlays,
    }

    const mapText = renderMap(overview, renderInfo)

    return {
        action: "executeAction",
        mapText,
        message: `${actorName} will use ${actionDef.name} on ${targetName} → (${desiredDestination.row}, ${desiredDestination.col}).\n${forecastText}\nPress Y to confirm or N/C to cancel.`,
        updatedContext: {
            selectedSquaddieId: actorId,
            interactionPhase: InteractionPhase.CONFIRMING_ACTION,
            actingSquaddieId: actorId,
            pendingActionId: actionId,
            // pendingTargetCount: 1 so that N/C cancels to BROWSING rather than re-entering target selection.
            pendingTargetCount: 1,
        },
    }
}

const handleInitiateMovement = (
    engine: MissionEngine,
    context: CommandContext
): CommandResult => {
    const squaddieId = context.selectedSquaddieId!
    const info = engine.getSquaddieInfo(squaddieId)

    const movementOptions = engine.getMovementOptionsWithCosts(squaddieId)
    const tileOverlays = MovementInspector.buildMovementOverlay(movementOptions)

    const overview = engine.getMapOverview()
    const turnNumber = engine.getCurrentTurnNumber()
    const affiliationTurn = engine.getCurrentAffiliationTurn()
    const currentAffiliation =
        MissionTurnService.getSquaddieAffiliationForAffiliationTurn(
            affiliationTurn
        )
    const squaddieAffiliations = buildSquaddieAffiliations(engine, overview)

    const renderInfo: MapRenderInfo = {
        turnNumber,
        currentAffiliation,
        squaddieAffiliations,
        tileOverlays,
    }

    const mapText = renderMap(overview, renderInfo)
    const message = `${info.name}: Select destination (or enter invalid coordinate to cancel):`

    return {
        action: "moveSquaddie",
        mapText,
        message,
        updatedContext: {
            selectedSquaddieId: squaddieId,
            interactionPhase: InteractionPhase.SELECTING_TARGET,
            actingSquaddieId: squaddieId,
            pendingActionId: "default-move",
        },
    }
}

const handleMovementTargetSelection = (
    rawInput: string,
    engine: MissionEngine | undefined,
    context: CommandContext
): CommandResult => {
    if (engine == undefined) {
        return {
            action: "moveSquaddie",
            message: "No engine available to execute movement.",
            updatedContext: {
                selectedSquaddieId: undefined,
                interactionPhase: InteractionPhase.BROWSING,
                actingSquaddieId: undefined,
                pendingActionId: undefined,
            },
        }
    }

    const desiredTargetCoordinate = parseCoordinate(rawInput)
    if (desiredTargetCoordinate == undefined) {
        return {
            action: "moveSquaddie",
            message: "Movement cancelled.",
            updatedContext: {
                selectedSquaddieId: undefined,
                interactionPhase: InteractionPhase.BROWSING,
                actingSquaddieId: undefined,
                pendingActionId: undefined,
            },
        }
    }

    const actingSquaddieId = context.actingSquaddieId!
    const validity = engine.getSquaddieActionValidity(actingSquaddieId)
    const moveAction = validity.validActions.find(
        (a) => a.actionId === "default-move"
    )
    const isReachable =
        moveAction?.reachableCoordinates.some(
            (coordinate) =>
                coordinate.row === desiredTargetCoordinate.row &&
                coordinate.col === desiredTargetCoordinate.col
        ) ?? false

    if (!isReachable) {
        return {
            action: "moveSquaddie",
            message: `Coordinate (${desiredTargetCoordinate.row},${desiredTargetCoordinate.col}) is out of reach. Movement cancelled.`,
            updatedContext: {
                selectedSquaddieId: undefined,
                interactionPhase: InteractionPhase.BROWSING,
                actingSquaddieId: undefined,
                pendingActionId: undefined,
            },
        }
    }

    const info = engine.getSquaddieInfo(actingSquaddieId)

    const readyResult = engine.readyAction({
        actor: actingSquaddieId,
        targets: [actingSquaddieId],
        action: {
            id: "default-move",
            decisions: { targetDestination: desiredTargetCoordinate },
        },
    })

    if (!readyResult.isValid) {
        return {
            action: "moveSquaddie",
            message: readyResult.message ?? "Cannot perform this action.",
            updatedContext: {
                selectedSquaddieId: undefined,
                interactionPhase: InteractionPhase.BROWSING,
                actingSquaddieId: undefined,
                pendingActionId: undefined,
            },
        }
    }

    const actionResult = engine.useActionAndGetResults()

    const movementResult = Object.values(actionResult.targetResults)
        .flatMap((target) => target.squaddieActionResults)
        .find((result) => result.movement != undefined)

    const tileOverlays =
        movementResult?.movement == undefined
            ? new Map<string, string>()
            : MovementInspector.buildRouteOverlay(movementResult.movement.expectedPath)

    const overview = engine.getMapOverview()
    const turnNumber = engine.getCurrentTurnNumber()
    const affiliationTurn = engine.getCurrentAffiliationTurn()
    const currentAffiliation =
        MissionTurnService.getSquaddieAffiliationForAffiliationTurn(
            affiliationTurn
        )
    const squaddieAffiliations = buildSquaddieAffiliations(engine, overview)

    const renderInfo: MapRenderInfo = {
        turnNumber,
        currentAffiliation,
        squaddieAffiliations,
        tileOverlays,
    }

    const routeMap = renderMap(overview, renderInfo)

    const apSpent = movementResult?.actionPoints?.spent ?? 0
    const infoAfter = engine.getSquaddieInfo(actingSquaddieId)
    const apRemaining = infoAfter.currentActionPoints

    const message = `${info.name} moves to (${desiredTargetCoordinate.row}, ${desiredTargetCoordinate.col}), spending ${apSpent} AP (${apRemaining} remaining).\n${routeMap}`

    return {
        action: "moveSquaddie",
        message,
        updatedContext: {
            selectedSquaddieId: undefined,
            interactionPhase: InteractionPhase.BROWSING,
            actingSquaddieId: undefined,
            pendingActionId: undefined,
        },
    }
}

// Handles the Z command: undo the last player-undoable action.
const handleUndoAction = (engine: MissionEngine | undefined): CommandResult => {
    if (engine == undefined) {
        return {
            action: "undoAction",
            message: "[handleUndoAction] No engine available.",
        }
    }

    const result = engine.undoLastPlayerUndoableAction()

    if (!result.success) {
        return {
            action: "undoAction",
            message: `Cannot undo: ${result.reason}.`,
        }
    }

    const actionName = result.removedAction!.action.name
    return {
        action: "undoAction",
        message: `Undid: ${actionName}.`,
        updatedContext: {
            selectedSquaddieId: undefined,
            interactionPhase: InteractionPhase.BROWSING,
            actingSquaddieId: undefined,
            pendingActionId: undefined,
        },
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
