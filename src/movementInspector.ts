import type { OffsetCoordinate } from "../logic/src/coordinateMap/offsetCoordinate.js"
import type { CoordinateMovePath } from "../logic/src/coordinateMap/path/path.js"

const buildMovementOverlay = (
    movementOptions: Array<{
        destination: OffsetCoordinate
        actionPointCost: number
    }>
): Map<string, string> => {
    const overlay = new Map<string, string>()

    for (const { destination, actionPointCost } of movementOptions) {
        const key = `${destination.row},${destination.col}`
        overlay.set(key, String(actionPointCost))
    }

    return overlay
}

const buildTargetOverlay = (
    targetCoordinates: Array<{ aimCoordinate: OffsetCoordinate }>
): Map<string, string> => {
    const overlay = new Map<string, string>()
    for (const { aimCoordinate } of targetCoordinates) {
        const key = `${aimCoordinate.row},${aimCoordinate.col}`
        overlay.set(key, "TG")
    }
    return overlay
}

// Builds an overlay showing which tiles the action line passes through and which are hit.
// Priority (highest wins): "HT" hit target > "<>" aim coordinate > "//" line path cell.
const buildActionEffectOverlay = (
    aimCoordinate: OffsetCoordinate,
    targetPositions: Array<{ row: number | undefined; col: number | undefined }>,
    lineCoordinates?: OffsetCoordinate[]
): Map<string, string> => {
    const overlay = new Map<string, string>()

    // Lowest priority: mark intermediate line cells that the bolt passes through.
    if (lineCoordinates != undefined) {
        for (const cell of lineCoordinates) {
            overlay.set(`${cell.row},${cell.col}`, "//")
        }
    }

    // Medium priority: aim coordinate overrides a plain line cell.
    overlay.set(`${aimCoordinate.row},${aimCoordinate.col}`, "<>")

    // Highest priority: hit targets override everything.
    for (const pos of targetPositions) {
        if (pos.row == undefined || pos.col == undefined) continue
        overlay.set(`${pos.row},${pos.col}`, "HT")
    }

    return overlay
}

const buildRouteOverlay = (
    path: CoordinateMovePath
): Map<string, string> => {
    const overlay = new Map<string, string>()

    path.steps.forEach((step, index) => {
        const key = `${step.row},${step.col}`
        const char = index === path.steps.length - 1 ? "!!" : "**"
        overlay.set(key, char)
    })

    return overlay
}

export const MovementInspector = {
    buildMovementOverlay,
    buildTargetOverlay,
    buildActionEffectOverlay,
    buildRouteOverlay,
}
