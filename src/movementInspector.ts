import type { OffsetCoordinate } from "../logic/src/coordinateMap/offsetCoordinate.js"
import type { CoordinateMovePath } from "../logic/src/coordinateMap/path/path.js"

export const buildMovementOverlay = (
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

export const buildRouteOverlay = (
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
