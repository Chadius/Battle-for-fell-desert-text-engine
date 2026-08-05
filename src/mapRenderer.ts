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

// SquaddiePair associates a unique composite key with the archetype id used for label generation.
interface SquaddiePair {
    compositeKey: string
    outOfBattleId: string
}

// A single archetype's map label ("label", used when the archetype has exactly one instance
// on the map) and the single character ("letter") used to build "letter + number" labels when
// the archetype has multiple instances on the map.
interface ArchetypeDiscriminator {
    label: string
    letter: string
}

// Capital first character + lowercase character at secondCharIndex, e.g. "Si" for "sir_camil".
const twoCharLabel = (outOfBattleId: string, secondCharIndex: number): string => {
    const first = outOfBattleId[0]?.toUpperCase() ?? ""
    const second = (outOfBattleId[secondCharIndex] ?? "").toLowerCase()
    return `${first}${second}`
}

// Finds the earliest character position (starting after the default second character) where
// every id in the group differs from every other id in the group, or undefined if none exists
// within the length of the longest id.
const findDistinguishingCharIndex = (
    outOfBattleIds: string[]
): number | undefined => {
    const maxLength = Math.max(...outOfBattleIds.map((id) => id.length))
    for (let index = 1; index < maxLength; index++) {
        const chars = outOfBattleIds.map((id) => (id[index] ?? "").toUpperCase())
        if (new Set(chars).size === chars.length) {
            return index
        }
    }
    return undefined
}

// Assigns each distinct archetype (outOfBattleId) present on the map a label/letter pair.
// Archetypes default to a two-character "Capital + lowercase" label. When two or more
// archetypes would otherwise share the same default label (e.g. "enemy_demon_slither" and
// "enemy_demon_locust" both default to "En"), a later character position that distinguishes
// them is substituted for the second character instead.
const assignArchetypeDiscriminators = (
    outOfBattleIds: string[]
): Map<string, ArchetypeDiscriminator> => {
    const discriminators = new Map<string, ArchetypeDiscriminator>()

    const byDefaultLabel = new Map<string, string[]>()
    for (const outOfBattleId of outOfBattleIds) {
        const defaultLabel = twoCharLabel(outOfBattleId, 1)
        if (!byDefaultLabel.has(defaultLabel)) {
            byDefaultLabel.set(defaultLabel, [])
        }
        byDefaultLabel.get(defaultLabel)!.push(outOfBattleId)
    }

    for (const group of byDefaultLabel.values()) {
        if (group.length === 1) {
            const outOfBattleId = group[0]
            discriminators.set(outOfBattleId, {
                label: twoCharLabel(outOfBattleId, 1),
                letter: outOfBattleId[0].toUpperCase(),
            })
            continue
        }

        const distinguishingIndex = findDistinguishingCharIndex(group)
        group.forEach((outOfBattleId, groupIndex) => {
            if (distinguishingIndex != undefined) {
                const distinguishingChar =
                    outOfBattleId[distinguishingIndex]?.toUpperCase() ??
                    outOfBattleId[0].toUpperCase()
                discriminators.set(outOfBattleId, {
                    label: twoCharLabel(outOfBattleId, distinguishingIndex),
                    letter: distinguishingChar,
                })
            } else {
                // No distinguishing character exists within either id (e.g. one is a prefix
                // of the other); fall back to a numbered label within the group.
                discriminators.set(outOfBattleId, {
                    label: `${outOfBattleId[0].toUpperCase()}${groupIndex + 1}`,
                    letter: outOfBattleId[0].toUpperCase(),
                })
            }
        })
    }

    return discriminators
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

    const archetypeGroups = new Map<string, SquaddiePair[]>()
    for (const pair of squaddiePairs) {
        if (!archetypeGroups.has(pair.outOfBattleId)) {
            archetypeGroups.set(pair.outOfBattleId, [])
        }
        archetypeGroups.get(pair.outOfBattleId)!.push(pair)
    }

    const discriminators = assignArchetypeDiscriminators([
        ...archetypeGroups.keys(),
    ])

    const labels = new Map<string, string>()
    for (const [outOfBattleId, pairs] of archetypeGroups) {
        const discriminator = discriminators.get(outOfBattleId)!
        if (pairs.length === 1) {
            labels.set(pairs[0].compositeKey, discriminator.label)
        } else {
            // Multiple instances of the same archetype: letter + 1-based instance number.
            pairs.forEach((pair, index) => {
                labels.set(pair.compositeKey, `${discriminator.letter}${index + 1}`)
            })
        }
    }

    return labels
}

export const renderGridLines = (
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

export const renderLegend = (): string[] => {
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
