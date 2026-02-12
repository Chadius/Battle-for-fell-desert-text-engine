import type { MapOverview } from "../logic/src/mission/missionEngine/missionEngine.js"
import {
    SquaddieAffiliation,
    type TSquaddieAffiliation,
} from "../logic/src/affiliation/affiliation.js"

export interface MapRenderInfo {
    turnNumber: number
    currentAffiliation: TSquaddieAffiliation | undefined
    squaddieAffiliations: Map<string, TSquaddieAffiliation>
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

export const buildSquaddieLabels = (
    overview: MapOverview
): Map<string, string> => {
    const squaddieIds: string[] = []

    for (const row of overview.tiles) {
        for (const tile of row) {
            if (tile.squaddieId != undefined) {
                squaddieIds.push(tile.squaddieId.outOfBattleSquaddieId)
            }
        }
    }

    const labels = new Map<string, string>()

    const firstCharGroups = new Map<string, string[]>()
    for (const id of squaddieIds) {
        const firstChar = id[0].toUpperCase()
        if (!firstCharGroups.has(firstChar)) {
            firstCharGroups.set(firstChar, [])
        }
        firstCharGroups.get(firstChar)!.push(id)
    }

    for (const [firstChar, ids] of firstCharGroups) {
        if (ids.length === 1) {
            labels.set(ids[0], firstChar)
        } else {
            assignDisambiguatedLabels(ids, labels)
        }
    }

    return labels
}

const assignDisambiguatedLabels = (
    ids: string[],
    labels: Map<string, string>
): void => {
    for (let charIndex = 1; charIndex < 20; charIndex++) {
        const candidateLabels = ids.map((id) => {
            const char = id[charIndex] ?? id[0]
            return char.toUpperCase()
        })

        const allUnique =
            new Set(candidateLabels).size === candidateLabels.length
        if (allUnique) {
            for (let i = 0; i < ids.length; i++) {
                labels.set(ids[i], candidateLabels[i])
            }
            return
        }
    }

    for (let i = 0; i < ids.length; i++) {
        labels.set(ids[i], ids[i][0].toUpperCase() + i)
    }
}

const renderGridLines = (
    overview: MapOverview,
    squaddieLabels: Map<string, string>
): string[] => {
    const lines: string[] = []

    for (let row = 0; row < overview.height; row++) {
        const indent = row % 2 === 1 ? " " : ""
        const tileCells = overview.tiles[row].map((tile) => {
            if (tile.squaddieId != undefined) {
                return squaddieLabels.get(
                    tile.squaddieId.outOfBattleSquaddieId
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
): { id: string; label: string; row: number; col: number }[] => {
    const entries: { id: string; label: string; row: number; col: number }[] =
        []
    for (const row of overview.tiles) {
        for (const tile of row) {
            if (tile.squaddieId != undefined) {
                const id = tile.squaddieId.outOfBattleSquaddieId
                const label = squaddieLabels.get(id)!
                entries.push({ id, label, row: tile.row, col: tile.col })
            }
        }
    }
    return entries
}

const renderFlatSquaddieList = (
    entries: { id: string; label: string; row: number; col: number }[]
): string[] => {
    return entries.map(
        (entry) => `  ${entry.label} = ${entry.id} (${entry.row},${entry.col})`
    )
}

const renderGroupedSquaddieList = (
    entries: { id: string; label: string; row: number; col: number }[],
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
            (entry) => squaddieAffiliations.get(entry.id) === affiliation
        )
        if (groupEntries.length === 0) continue

        lines.push(`  ${affiliationDisplayName(affiliation)}:`)
        for (const entry of groupEntries) {
            lines.push(
                `    ${entry.label} = ${entry.id} (${entry.row},${entry.col})`
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

    const header = `Map: ${overview.width} columns x ${overview.height} rows`
    const gridLines = renderGridLines(overview, squaddieLabels)
    const legend = renderLegend()
    const squaddieList = renderSquaddieList(overview, squaddieLabels, renderInfo)

    allLines.push(header, ...gridLines, ...legend, ...squaddieList)
    return allLines.join("\n")
}
