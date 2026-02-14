import type { MissionEngine } from "../logic/src/mission/missionEngine/missionEngine.js"
import type { BattleSquaddieId } from "../logic/src/squaddie/inBattle/inBattleSquaddieManager.js"
import type { OffsetMaybeOffmapCoordinate } from "../logic/src/coordinateMap/coordinateMap.js"

export interface ControllableSquaddieEntry {
    squaddieId: BattleSquaddieId
    name: string
    currentActionPoints: number
    maximumActionPoints: number
    coordinate: OffsetMaybeOffmapCoordinate | undefined
}

const formatCoordinate = (
    coordinate: OffsetMaybeOffmapCoordinate | undefined
): string => {
    if (
        coordinate?.row == undefined ||
        coordinate?.col == undefined
    ) {
        return "(off map)"
    }
    return `(${coordinate.row},${coordinate.col})`
}

const formatEntry = (entry: ControllableSquaddieEntry): string => {
    const position = formatCoordinate(entry.coordinate)
    return `  ${entry.name} ${position} - AP: ${entry.currentActionPoints}/${entry.maximumActionPoints}`
}

const gatherEntries = (engine: MissionEngine): ControllableSquaddieEntry[] => {
    const squaddieIds = engine.getSquaddiesWhoCanActThisPhase()

    return squaddieIds.map((squaddieId) => {
        const info = engine.getSquaddieInfo(squaddieId)
        const coordinate = engine.getSquaddiePosition(squaddieId)

        return {
            squaddieId,
            name: info.name,
            currentActionPoints: info.currentActionPoints,
            maximumActionPoints: info.maximumActionPoints,
            coordinate,
        }
    })
}

const formatEntries = (entries: ControllableSquaddieEntry[]): string => {
    if (entries.length === 0) {
        return "No squaddies can act this phase."
    }

    const lines = ["Squaddies who can act:"]
    for (const entry of entries) {
        lines.push(formatEntry(entry))
    }
    return lines.join("\n")
}

export const ControllableSquaddieInspector = {
    gatherEntries: (engine: MissionEngine) => gatherEntries(engine),
    formatEntries: (entries: ControllableSquaddieEntry[]) =>
        formatEntries(entries),
}
