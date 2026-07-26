import type { MissionEngine } from "../logic/src/mission/missionEngine/missionEngine.js"
import type { OffsetCoordinate } from "../logic/src/coordinateMap/offsetCoordinate.js"
import type { CampaignSquaddie } from "../logic/src/campaign/army/campaignSquaddie.js"
import type { CampaignSquaddieDeploymentCoordinate } from "../logic/src/mission/campaignSquaddieDeploymentCoordinate.js"
import { parseCoordinate } from "./coordinateInspector.js"
import {
    allCoordinatesOf,
    DeploymentInspector,
    type DeploymentStatus,
} from "./deploymentInspector.js"

export interface DeploymentContext {
    // Mutually exclusive: selecting a coordinate clears the squaddie selection and vice versa.
    selectedCoordinateId: string | undefined
    selectedCampaignSquaddieId: string | undefined
}

export const initialDeploymentContext = (): DeploymentContext => ({
    selectedCoordinateId: undefined,
    selectedCampaignSquaddieId: undefined,
})

export type DeploymentCommandAction =
    | "quit"
    | "echo"
    | "showMap"
    | "showCommands"
    | "showStatus"
    | "selectCoordinate"
    | "selectSquaddie"
    | "cancelSelection"
    | "deploySquaddie"
    | "undeploySquaddie"
    | "moveOrSwap"
    | "lookAtSquaddie"
    | "finalize"

export interface DeploymentCommandResult {
    action: DeploymentCommandAction
    message: string
    updatedContext?: DeploymentContext
}

export const processDeploymentCommand = (
    rawInput: string,
    engine: MissionEngine,
    context: DeploymentContext
): DeploymentCommandResult => {
    const normalizedInput = rawInput.trim().toUpperCase()

    if (normalizedInput === "Q") {
        return { action: "quit", message: "Goodbye!" }
    }
    if (normalizedInput === "M") {
        return {
            action: "showMap",
            message: DeploymentInspector.renderDeploymentMap(engine),
        }
    }
    if (normalizedInput === "?") {
        return { action: "showCommands", message: helpText() }
    }
    if (normalizedInput === "W") {
        return { action: "showStatus", message: DeploymentInspector.formatStatus(engine) }
    }
    if (normalizedInput === "F") {
        return handleFinalize(engine)
    }
    if (normalizedInput === "C") {
        return {
            action: "cancelSelection",
            message: "Selection cleared.",
            updatedContext: initialDeploymentContext(),
        }
    }
    if (normalizedInput === "X") {
        return handleUnassign(engine, context)
    }
    if (normalizedInput === "L") {
        return handleLookAtSquaddie(engine, context)
    }

    const coordinate = parseCoordinate(rawInput)
    if (coordinate != undefined) {
        return handleCoordinateInput(coordinate, engine, context)
    }

    const squaddieNumber = parseInt(normalizedInput, 10)
    if (!isNaN(squaddieNumber)) {
        return handleSquaddieNumber(squaddieNumber, engine, context)
    }

    return {
        action: "echo",
        message: `"${rawInput}" is not a valid deployment command. Enter '?' for help.`,
    }
}

const helpText = (): string =>
    [
        "Deployment commands:",
        "M - Show the deployment map",
        "W - Show deployment status (coordinates, assignments, unplaced squaddies)",
        "<n> - Select the numbered unplaced squaddie",
        "row, col - Select a deployment coordinate, or deploy the selected squaddie there",
        "L - Look at the selected squaddie's stats and actions",
        "X - Unassign the squaddie at the selected coordinate",
        "C - Cancel the current selection",
        "F - Finalize deployment and start the mission",
        "Q - Quit",
    ].join("\n")

const handleLookAtSquaddie = (
    engine: MissionEngine,
    context: DeploymentContext
): DeploymentCommandResult => {
    const status = engine.getCampaignDeploymentStatus()

    if (context.selectedCampaignSquaddieId != undefined) {
        const squaddie = status.unplacedEligibleCampaignSquaddies.find(
            (candidate) => candidate.id === context.selectedCampaignSquaddieId
        )
        if (squaddie == undefined) {
            return {
                action: "echo",
                message: "The selected squaddie is no longer available to inspect.",
            }
        }
        return {
            action: "lookAtSquaddie",
            message: DeploymentInspector.formatCampaignSquaddieDetails(engine, squaddie),
        }
    }

    if (context.selectedCoordinateId != undefined) {
        const assigned = status.assignments[context.selectedCoordinateId]
        if (assigned == undefined) {
            return {
                action: "echo",
                message: "That coordinate is open. Select an unplaced squaddie by number to inspect them.",
            }
        }
        return {
            action: "lookAtSquaddie",
            message: DeploymentInspector.formatCampaignSquaddieDetails(engine, assigned),
        }
    }

    return {
        action: "echo",
        message: "Select a squaddie (by number) or a coordinate with someone deployed first.",
    }
}

const findCoordinateAt = (
    status: DeploymentStatus,
    coordinate: OffsetCoordinate
): CampaignSquaddieDeploymentCoordinate | undefined =>
    allCoordinatesOf(status).find(
        (candidate) =>
            candidate.coordinate.row === coordinate.row &&
            candidate.coordinate.col === coordinate.col
    )

// A bare number selects an unplaced squaddie awaiting a destination coordinate. If a coordinate
// is already selected and open, it instead deploys that squaddie there directly (the older
// coordinate-first flow), so either order of selection works.
const handleSquaddieNumber = (
    squaddieNumber: number,
    engine: MissionEngine,
    context: DeploymentContext
): DeploymentCommandResult => {
    const status = engine.getCampaignDeploymentStatus()
    const squaddie = status.unplacedEligibleCampaignSquaddies[squaddieNumber - 1]
    if (squaddie == undefined) {
        return { action: "echo", message: `No unplaced squaddie numbered ${squaddieNumber}.` }
    }

    if (context.selectedCoordinateId == undefined) {
        return {
            action: "selectSquaddie",
            message: `${squaddie.name} selected. Enter a coordinate to deploy to, or 'C' to cancel.`,
            updatedContext: {
                selectedCoordinateId: undefined,
                selectedCampaignSquaddieId: squaddie.id,
            },
        }
    }

    const coordinate = allCoordinatesOf(status).find(
        (candidate) => candidate.id === context.selectedCoordinateId
    )
    if (coordinate == undefined || status.assignments[coordinate.id] != undefined) {
        return {
            action: "echo",
            message: "The selected coordinate is not open for a new squaddie.",
        }
    }

    return deploySquaddieToCoordinate(squaddie, coordinate, engine)
}

const handleCoordinateInput = (
    coordinate: OffsetCoordinate,
    engine: MissionEngine,
    context: DeploymentContext
): DeploymentCommandResult => {
    const status = engine.getCampaignDeploymentStatus()
    const target = findCoordinateAt(status, coordinate)
    if (target == undefined) {
        return {
            action: "echo",
            message: `(${coordinate.row},${coordinate.col}) is not a deployment coordinate.`,
        }
    }

    if (context.selectedCampaignSquaddieId != undefined) {
        return handleDeploySelectedSquaddie(context.selectedCampaignSquaddieId, target, status, engine)
    }

    const sourceId = context.selectedCoordinateId
    const sourceAssigned = sourceId != undefined ? status.assignments[sourceId] : undefined

    // Nothing selected yet, reselecting the same coordinate, or the prior selection had no
    // assignment to move: just (re)select the target coordinate for inspection/assignment.
    if (sourceId == undefined || sourceId === target.id || sourceAssigned == undefined) {
        return selectCoordinate(target, status)
    }

    return moveOrSwap(sourceId, sourceAssigned.id, target, status, engine)
}

const handleDeploySelectedSquaddie = (
    campaignSquaddieId: string,
    target: CampaignSquaddieDeploymentCoordinate,
    status: DeploymentStatus,
    engine: MissionEngine
): DeploymentCommandResult => {
    const occupant = status.assignments[target.id]
    if (occupant != undefined) {
        const label = `(${target.coordinate.row},${target.coordinate.col})`
        return {
            action: "echo",
            message: `${label} already has ${occupant.name}. Choose an open coordinate, or 'C' to cancel.`,
        }
    }

    const squaddie = status.unplacedEligibleCampaignSquaddies.find(
        (candidate) => candidate.id === campaignSquaddieId
    )
    if (squaddie == undefined) {
        return {
            action: "echo",
            message: "The selected squaddie is no longer available to deploy.",
            updatedContext: initialDeploymentContext(),
        }
    }

    return deploySquaddieToCoordinate(squaddie, target, engine)
}

const deploySquaddieToCoordinate = (
    squaddie: CampaignSquaddie,
    coordinate: CampaignSquaddieDeploymentCoordinate,
    engine: MissionEngine
): DeploymentCommandResult => {
    try {
        engine.deployCampaignSquaddie({
            coordinateId: coordinate.id,
            campaignSquaddieId: squaddie.id,
        })
    } catch (e) {
        return { action: "echo", message: e instanceof Error ? e.message : String(e) }
    }

    return {
        action: "deploySquaddie",
        message: `${squaddie.name} deployed to (${coordinate.coordinate.row},${coordinate.coordinate.col}).`,
        updatedContext: initialDeploymentContext(),
    }
}

const selectCoordinate = (
    coordinate: CampaignSquaddieDeploymentCoordinate,
    status: DeploymentStatus
): DeploymentCommandResult => {
    const label = `(${coordinate.coordinate.row},${coordinate.coordinate.col})`
    const assigned = status.assignments[coordinate.id]
    const updatedContext = {
        selectedCoordinateId: coordinate.id,
        selectedCampaignSquaddieId: undefined,
    }

    if (assigned == undefined) {
        const choices = status.unplacedEligibleCampaignSquaddies
            .map(
                (squaddie, index) =>
                    `  ${index + 1}. ${squaddie.name}${squaddie.isLeader ? " (Leader)" : ""}`
            )
            .join("\n")
        const message =
            choices.length > 0
                ? `Coordinate ${label} is open. Choose a squaddie to deploy:\n${choices}`
                : `Coordinate ${label} is open, but no unplaced squaddies are eligible.`
        return { action: "selectCoordinate", message, updatedContext }
    }

    return {
        action: "selectCoordinate",
        message: `Coordinate ${label} has ${assigned.name}. Enter another coordinate to move/swap, 'X' to unassign, or 'C' to cancel.`,
        updatedContext,
    }
}

const moveOrSwap = (
    sourceCoordinateId: string,
    sourceAssignedId: string,
    target: CampaignSquaddieDeploymentCoordinate,
    status: DeploymentStatus,
    engine: MissionEngine
): DeploymentCommandResult => {
    const destinationAssigned = status.assignments[target.id]

    try {
        if (destinationAssigned == undefined) {
            engine.deployCampaignSquaddie({
                coordinateId: target.id,
                campaignSquaddieId: sourceAssignedId,
            })
        } else {
            engine.swapCampaignSquaddieDeployment({
                coordinateIdA: sourceCoordinateId,
                coordinateIdB: target.id,
            })
        }
    } catch (e) {
        return {
            action: "echo",
            message: e instanceof Error ? e.message : String(e),
            updatedContext: initialDeploymentContext(),
        }
    }

    return {
        action: "moveOrSwap",
        message: DeploymentInspector.formatStatus(engine),
        updatedContext: initialDeploymentContext(),
    }
}

const handleUnassign = (
    engine: MissionEngine,
    context: DeploymentContext
): DeploymentCommandResult => {
    if (context.selectedCoordinateId == undefined) {
        return { action: "echo", message: "Select a coordinate first (enter its row,col)." }
    }

    try {
        engine.undeployCampaignSquaddie(context.selectedCoordinateId)
    } catch (e) {
        return { action: "echo", message: e instanceof Error ? e.message : String(e) }
    }

    return {
        action: "undeploySquaddie",
        message: "Squaddie unassigned.",
        updatedContext: initialDeploymentContext(),
    }
}

const handleFinalize = (engine: MissionEngine): DeploymentCommandResult => {
    try {
        engine.finalizeCampaignSquaddieDeploymentAndStartMission()
    } catch (e) {
        return { action: "echo", message: e instanceof Error ? e.message : String(e) }
    }

    return {
        action: "finalize",
        message: "Deployment confirmed. Mission starting...",
        updatedContext: initialDeploymentContext(),
    }
}
