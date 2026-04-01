import type { MapOverview } from "../logic/src/mission/missionEngine/missionEngine.js"
import {
    SquaddieAffiliation,
    type TSquaddieAffiliation,
} from "../logic/src/affiliation/affiliation.js"
import { SquaddieIdConverterService } from "../logic/src/squaddie/idConverterService.js"

export interface MapRenderInfo {
    turnNumber: number
    currentAffiliation: TSquaddieAffiliation | undefined
    squaddieAffiliations: Map<string, TSquaddieAffiliation>
    objectivesDisplay?: string
    tileOverlays?: Map<string, string>
    mapName?: string
}

export const affiliationDisplayName = (
    affiliation: TSquaddieAffiliation
): string => {
    const displayNames: Record<TSquaddieAffiliation, string> = {
        [SquaddieAffiliation.PLAYER]: "Player",
        [SquaddieAffiliation.ALLY]: "Ally",
        [SquaddieAffiliation.ENEMY]: "Enemy",
        [SquaddieAffiliation.NONE]: "None",
    }
    return displayNames[affiliation]
}

export const terrainToSymbol = (
    movementCost: number | undefined,
    canStop: boolean
): string => {
    if (canStop && movementCost === 1) return "."
    if (canStop && movementCost !== undefined) return "~"
    if (!canStop && movementCost !== undefined) return "_"
    return "#"
}

// SquaddiePair associates a unique composite key with the archetype name used for label generation.
interface SquaddiePair {
    compositeKey: string
    outOfBattleId: string
}

export const buildSquaddieLabels = (
    overview: MapOverview
): Map<string, string> => {
    const squaddiePairs: SquaddiePair[] = []

    for (const row of overview.tiles) {
        for (const tile of row) {
            if (tile.squaddieId != undefined) {
                squaddiePairs.push({
                    compositeKey: SquaddieIdConverterService.squaddieIdToKey(
                        tile.squaddieId
                    ),
                    outOfBattleId: tile.squaddieId.outOfBattleSquaddieId,
                })
            }
        }
    }

    const labels = new Map<string, string>()

    // Group pairs by the first character of their outOfBattleId.
    const firstCharGroups = new Map<string, SquaddiePair[]>()
    for (const pair of squaddiePairs) {
        const firstChar = pair.outOfBattleId[0].toUpperCase()
        if (!firstCharGroups.has(firstChar)) {
            firstCharGroups.set(firstChar, [])
        }
        firstCharGroups.get(firstChar)!.push(pair)
    }

    for (const [firstChar, pairs] of firstCharGroups) {
        if (pairs.length === 1) {
            labels.set(pairs[0].compositeKey, firstChar)
        } else {
            assignDisambiguatedLabels(pairs, labels)
        }
    }

    return labels
}

const assignDisambiguatedLabels = (
    pairs: SquaddiePair[],
    labels: Map<string, string>
): void => {
    // When any two pairs share the same outOfBattleId, character-position
    // disambiguation is impossible — go straight to indexed fallback.
    const outOfBattleIds = pairs.map((p) => p.outOfBattleId)
    const hasDuplicateArchetypes =
        new Set(outOfBattleIds).size < outOfBattleIds.length

    if (!hasDuplicateArchetypes) {
        // Try to find a character position where all outOfBattleIds differ.
        for (let charIndex = 1; charIndex < 20; charIndex++) {
            const candidateLabels = pairs.map((pair) => {
                const char = pair.outOfBattleId[charIndex] ?? pair.outOfBattleId[0]
                return char.toUpperCase()
            })

            const allUnique =
                new Set(candidateLabels).size === candidateLabels.length
            if (allUnique) {
                for (let i = 0; i < pairs.length; i++) {
                    labels.set(pairs[i].compositeKey, candidateLabels[i])
                }
                return
            }
        }
    }

    // Fallback: use first character of outOfBattleId plus a numeric index.
    for (let i = 0; i < pairs.length; i++) {
        labels.set(
            pairs[i].compositeKey,
            pairs[i].outOfBattleId[0].toUpperCase() + i
        )
    }
}

const renderGridLines = (
    overview: MapOverview,
    squaddieLabels: Map<string, string>,
    renderInfo?: MapRenderInfo
): string[] => {
    const lines: string[] = []

    for (let row = 0; row < overview.height; row++) {
        const indent = row % 2 === 1 ? " " : ""
        const tileCells = overview.tiles[row].map((tile) => {
            const overlayKey = `${tile.row},${tile.col}`
            const overlayChar = renderInfo?.tileOverlays?.get(overlayKey)
            if (overlayChar != undefined) {
                return overlayChar
            }
            if (tile.squaddieId != undefined) {
                return squaddieLabels.get(
                    SquaddieIdConverterService.squaddieIdToKey(tile.squaddieId)
                )!
            }
            return terrainToSymbol(tile.movementCost, tile.canStop)
        })
        lines.push(indent + tileCells.join(" "))
    }

    return lines
}

const renderLegend = (): string[] => {
    return [
        "",
        "Legend:",
        "  . = Normal terrain",
        "  ~ = Rough terrain",
        "  _ = Pit (cannot stop)",
        "  # = Wall (impassable)",
    ]
}

const collectSquaddieEntries = (
    overview: MapOverview,
    squaddieLabels: Map<string, string>
): { outOfBattleId: string; label: string; row: number; col: number }[] => {
    const entries: {
        outOfBattleId: string
        label: string
        row: number
        col: number
    }[] = []
    for (const row of overview.tiles) {
        for (const tile of row) {
            if (tile.squaddieId != undefined) {
                const compositeKey = SquaddieIdConverterService.squaddieIdToKey(
                    tile.squaddieId
                )
                const label = squaddieLabels.get(compositeKey)!
                entries.push({
                    outOfBattleId: tile.squaddieId.outOfBattleSquaddieId,
                    label,
                    row: tile.row,
                    col: tile.col,
                })
            }
        }
    }
    return entries
}

const renderFlatSquaddieList = (
    entries: { outOfBattleId: string; label: string; row: number; col: number }[]
): string[] => {
    return entries.map(
        (entry) =>
            `  ${entry.label} = ${entry.outOfBattleId} (${entry.row},${entry.col})`
    )
}

const renderGroupedSquaddieList = (
    entries: {
        outOfBattleId: string
        label: string
        row: number
        col: number
    }[],
    squaddieAffiliations: Map<string, TSquaddieAffiliation>
): string[] => {
    const affiliationOrder: TSquaddieAffiliation[] = [
        SquaddieAffiliation.PLAYER,
        SquaddieAffiliation.ALLY,
        SquaddieAffiliation.ENEMY,
        SquaddieAffiliation.NONE,
    ]

    const lines: string[] = []
    for (const affiliation of affiliationOrder) {
        const groupEntries = entries.filter(
            (entry) =>
                squaddieAffiliations.get(entry.outOfBattleId) === affiliation
        )
        if (groupEntries.length === 0) continue

        lines.push(`  ${affiliationDisplayName(affiliation)}:`)
        for (const entry of groupEntries) {
            lines.push(
                `    ${entry.label} = ${entry.outOfBattleId} (${entry.row},${entry.col})`
            )
        }
    }
    return lines
}

const renderSquaddieList = (
    overview: MapOverview,
    squaddieLabels: Map<string, string>,
    renderInfo?: MapRenderInfo
): string[] => {
    if (squaddieLabels.size === 0) return []

    const entries = collectSquaddieEntries(overview, squaddieLabels)
    const lines: string[] = ["Squaddies:"]

    if (renderInfo == undefined) {
        lines.push(...renderFlatSquaddieList(entries))
    } else {
        lines.push(
            ...renderGroupedSquaddieList(
                entries,
                renderInfo.squaddieAffiliations
            )
        )
    }

    return lines
}

const renderTurnHeader = (renderInfo: MapRenderInfo): string => {
    if (renderInfo.currentAffiliation != undefined) {
        const phaseName = affiliationDisplayName(renderInfo.currentAffiliation)
        return `Turn ${renderInfo.turnNumber} - ${phaseName} Phase`
    }
    return `Turn ${renderInfo.turnNumber}`
}

export const renderMap = (
    overview: MapOverview,
    renderInfo?: MapRenderInfo
): string => {
    const squaddieLabels = buildSquaddieLabels(overview)

    const allLines: string[] = []

    if (renderInfo != undefined) {
        allLines.push(renderTurnHeader(renderInfo))
    }

    // Show map name in header if provided, otherwise fall back to dimension-only format
    const header =
        renderInfo?.mapName != undefined
            ? `${renderInfo.mapName} (${overview.width} columns x ${overview.height} rows)`
            : `Map: ${overview.width} columns x ${overview.height} rows`
    const gridLines = renderGridLines(overview, squaddieLabels, renderInfo)
    const legend = renderLegend()
    const squaddieList = renderSquaddieList(overview, squaddieLabels, renderInfo)

    allLines.push(header, ...gridLines, ...legend, ...squaddieList)

    if (renderInfo?.objectivesDisplay != undefined) {
        allLines.push("", renderInfo.objectivesDisplay)
    }

    return allLines.join("\n")
}
