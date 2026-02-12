import type { MissionEngine } from "../logic/src/mission/missionEngine/missionEngine.js"
import type { OffsetCoordinate } from "../logic/src/coordinateMap/offsetCoordinate.js"

export const parseCoordinate = (
    input: string
): OffsetCoordinate | undefined => {
    const trimmed = input.trim()
    // Parses user input into a coordinate, supporting formats like "2, 0", "3 5", "(6, 10)", "(1 2)"
    const match = new RegExp(/^\(?(\d+)[,\s]+(\d+)\)?$/).exec(trimmed)
    if (match == undefined) {
        return undefined
    }
    return { row: Number.parseInt(match[1], 10), col: Number.parseInt(match[2], 10) }
}

export const terrainName = (
    movementCost: number | undefined,
    canStop: boolean
): string => {
    if (movementCost == undefined) return "Wall"
    if (!canStop) return "Pit"
    if (movementCost === 1) return "Standard"
    return "Difficult"
}

export const inspectCoordinate = (
    engine: MissionEngine,
    coordinate: OffsetCoordinate
): string => {
    const dimensions = engine.getMapDimensions()
    const coordinateLabel = `(${coordinate.row},${coordinate.col})`

    if (
        coordinate.row < 0 ||
        coordinate.col < 0 ||
        coordinate.row >= dimensions.height ||
        coordinate.col >= dimensions.width
    ) {
        return `${coordinateLabel} is off map (rows less than ${dimensions.height} and columns less than ${dimensions.width} are valid.)`
    }

    const terrain = engine.getTerrainAtCoordinate(coordinate)
    const name = terrainName(terrain.movementCost, terrain.canStop)
    const lines: string[] = [`${coordinateLabel}: ${name}`]

    const squaddieId = engine.getSquaddieAtCoordinate(coordinate)
    if (squaddieId != undefined) {
        const info = engine.getSquaddieInfo(squaddieId)
        lines.push(
            info.name,
            `  Affiliation: ${info.affiliation}`,
            `  Hit Points: ${info.currentHitPoints}/${info.maxHitPoints}`,
            `  Action Points: ${info.currentActionPoints}/${info.maximumActionPoints}`,
        )
    }

    return lines.join("\n")
}
