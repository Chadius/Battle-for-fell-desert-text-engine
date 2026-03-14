import type {MissionEngine} from "../logic/src/mission/missionEngine/missionEngine.js"
import type {BattleSquaddieId} from "../logic/src/squaddie/inBattle/inBattleSquaddieManager.js"
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
import {ValidSquaddieAction} from "../logic/src/squaddieAction/calculate/validity/squaddieActionValidationService.js";

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

export interface CommandContext {
    selectedSquaddieId: BattleSquaddieId | undefined
    interactionPhase: TInteractionPhase
    actingSquaddieId: BattleSquaddieId | undefined
    pendingActionId?: string
    pendingTargetCount?: number
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

    if (context?.interactionPhase === InteractionPhase.CONFIRMING_ACTION) {
        return handleActionConfirmation(normalizedInput, engine, context)
    }

    if (context?.interactionPhase === InteractionPhase.SELECTING_TARGET) {
        if (context.pendingActionId === "default-move") {
            return handleMovementTargetSelection(rawInput, engine, context)
        }
        return handleCombatActionTargetSelection(rawInput, engine, context)
    }

    if (normalizedInput.startsWith("A")) {
        return handleSelectAction(normalizedInput, engine, context)
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
        commandList.push("L - Look at selected squaddie", "A - Select action")
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
    const objectivesDisplay =
        MissionObjectiveInspector.formatEntries(objectiveEntries)

    const renderInfo: MapRenderInfo = {
        turnNumber,
        currentAffiliation,
        squaddieAffiliations,
        objectivesDisplay:
            objectivesDisplay.length > 0 ? objectivesDisplay : undefined,
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

    if (normalizedInput === "A") {
        return handleListActions(engine, context)
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
        return {
            action: "selectAction",
            message: `Cannot use ${invalidAction.actionName}: ${invalidAction.reason}`,
        }
    }

    return handleInitiateCombatAction(actionId, engine, context)
}

const handleInitiateCombatActionWith1Target = (targetIds: BattleSquaddieId[], engine: MissionEngine, actingSquaddieId: BattleSquaddieId, actionId: string): CommandResult => {
    const targetId = targetIds[0]

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

    return {
        action: "executeAction",
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
const handleInitiateCombatAction = (
    actionId: string,
    engine: MissionEngine,
    context: CommandContext
): CommandResult => {
    const actingSquaddieId = context.selectedSquaddieId!
    const actorInfo = engine.getSquaddieInfo(actingSquaddieId)
    const validity = engine.getSquaddieActionValidity(actingSquaddieId)

    const validAction = validity.validActions.find((a) => a.actionId === actionId)
    if (validAction == undefined) {
        return {
            action: "selectAction",
            message: `Action ${actionId} is not valid.`,
        }
    }

    const targetIds = validAction.targetBattleSquaddieIds

    if (targetIds.length === 1) {
        return handleInitiateCombatActionWith1Target(targetIds, engine, actingSquaddieId, actionId);
    }

    const tileOverlays = MovementInspector.buildTargetOverlay(validAction.targetCoordinates)
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
    const message = `${mapText}\n${actorInfo.name}: Select target (or enter invalid coordinate to cancel):`

    return {
        action: "executeAction",
        message,
        updatedContext: {
            selectedSquaddieId: actingSquaddieId,
            interactionPhase: InteractionPhase.SELECTING_TARGET,
            actingSquaddieId,
            pendingActionId: actionId,
            pendingTargetCount: targetIds.length,
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
    const validActionCheck = handleCombatActionTargetSelectionIsActionValid({
        engine,
        actingSquaddieId,
        context,
    })
    if (!validActionCheck.isValid) {
        return validActionCheck.commandResult!
    }
    const validAction = validActionCheck.validAction!

    const validTargetAtCoordinateCheck = handleCombatActionTargetSelectionIsValidTargetAtCoordinate({
        validAction,
        desiredCoordinate,
    })
    if (!validTargetAtCoordinateCheck.isValid) {
        return validTargetAtCoordinateCheck.commandResult!
    }

    const getTargetSquaddieIdCheck = handleCombatActionTargetSelectionGetTargetSquaddieId({engine, desiredCoordinate})
    if (!getTargetSquaddieIdCheck.isValid) {
        return getTargetSquaddieIdCheck.commandResult!
    }
    const targetSquaddieId = getTargetSquaddieIdCheck.targetSquaddieId!

    const readyActionCheck = handleCombatActionTargetSelectionCheckForValidReadyAction({
        engine,
        actingSquaddieId,
        targetSquaddieIds: [targetSquaddieId],
        context,
    })
    if (!readyActionCheck.isValid) {
        return readyActionCheck.commandResult!
    }

    const forecasts = engine.previewReadiedActionAndForecastResults()
    const targetName = engine.getSquaddieInfo(targetSquaddieId).name
    const forecastText = SquaddieActionInspector.formatForecast(
        forecasts,
        targetName
    )

    return {
        action: "executeAction",
        message: forecastText + "\nPress Y to confirm or N/C to cancel.",
        updatedContext: {
            selectedSquaddieId: actingSquaddieId,
            interactionPhase: InteractionPhase.CONFIRMING_ACTION,
            actingSquaddieId,
            pendingActionId: context.pendingActionId,
            pendingTargetCount: context.pendingTargetCount,
        },
    }
}

const handleCombatActionTargetSelectionIsActionValid = (
    {engine, actingSquaddieId, context}: {
        engine: MissionEngine,
        actingSquaddieId: BattleSquaddieId,
        context: CommandContext
    }
): { isValid: boolean, commandResult?: CommandResult, validAction?: ValidSquaddieAction } => {
    const validity = engine.getSquaddieActionValidity(actingSquaddieId)
    const validAction = validity.validActions.find(
        (a) => a.actionId === context.pendingActionId
    )

    if (validAction == undefined) {
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
    return {isValid: true, validAction}
}

const handleCombatActionTargetSelectionIsValidTargetAtCoordinate = (
    {validAction, desiredCoordinate}: { validAction: ValidSquaddieAction, desiredCoordinate: OffsetCoordinate }
): { isValid: boolean, commandResult?: CommandResult } => {
    const isValidTarget = validAction.targetCoordinates.some(
        (c) =>
            c.row === desiredCoordinate.row && c.col === desiredCoordinate.col
    )

    if (!isValidTarget) {
        return {
            isValid: false, commandResult: {
                action: "cancelAction",
                message: `(${desiredCoordinate.row},${desiredCoordinate.col}) is not a valid target. Action cancelled.`,
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

const handleCombatActionTargetSelectionGetTargetSquaddieId = (
    {engine, desiredCoordinate}: { engine: MissionEngine, desiredCoordinate: OffsetCoordinate }
): { isValid: boolean, commandResult?: CommandResult, targetSquaddieId?: BattleSquaddieId } => {
    const targetSquaddieId = engine.getSquaddieAtCoordinate(desiredCoordinate)
    if (targetSquaddieId == undefined) {
        return {
            isValid: false, commandResult: {
                action: "cancelAction",
                message: "No target at that coordinate. Action cancelled.",
                updatedContext: {
                    selectedSquaddieId: undefined,
                    interactionPhase: InteractionPhase.BROWSING,
                    actingSquaddieId: undefined,
                    pendingActionId: undefined,
                },
            }
        }
    }
    return {isValid: true, targetSquaddieId}
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
    const message = `${mapText}\n${info.name}: Select destination (or enter invalid coordinate to cancel):`

    return {
        action: "moveSquaddie",
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
        moveAction?.targetCoordinates.some(
            (coordinate) =>
                coordinate.row === desiredTargetCoordinate.row &&
                coordinate.col === desiredTargetCoordinate.col
        ) ?? false

    if (!isReachable) {
        return {
            action: "moveSquaddie",
            message: `Coordinate (${desiredTargetCoordinate.row},${desiredTargetCoordinate.col}) is out of reach.`,
            updatedContext: {
                ...context,
                interactionPhase: InteractionPhase.SELECTING_TARGET,
            },
        }
    }

    const info = engine.getSquaddieInfo(actingSquaddieId)

    const readyResult = engine.readyAction({
        actor: actingSquaddieId,
        targets: [actingSquaddieId],
        action: {
            id: "default-move",
            decisions: { desiredMovementDestination: desiredTargetCoordinate },
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
