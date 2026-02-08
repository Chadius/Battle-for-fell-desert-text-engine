import type { MapOverview } from "../logic/src/mission/missionEngine/missionEngine.js"

// Converts terrain properties into a display symbol
export const terrainToSymbol = (
    movementCost: number | undefined,
    canStop: boolean
): string => {
    if (canStop && movementCost === 1) return "."
    if (canStop && movementCost !== undefined) return "~"
    if (!canStop && movementCost !== undefined) return "_"
    return "#"
}

// Assigns a unique single-character label to each squaddie on the map
export const buildSquaddieLabels = (
    overview: MapOverview
): Map<string, string> => {
    const squaddieIds: string[] = []

    // Collect all squaddie outOfBattleSquaddieIds in row-major order
    for (const row of overview.tiles) {
        for (const tile of row) {
            if (tile.squaddieId != undefined) {
                squaddieIds.push(tile.squaddieId.outOfBattleSquaddieId)
            }
        }
    }

    const labels = new Map<string, string>()

    // Group squaddies by their first character
    const firstCharGroups = new Map<string, string[]>()
    for (const id of squaddieIds) {
        const firstChar = id[0].toUpperCase()
        if (!firstCharGroups.has(firstChar)) {
            firstCharGroups.set(firstChar, [])
        }
        firstCharGroups.get(firstChar)!.push(id)
    }

    // Assign labels: unique first char or disambiguate with subsequent chars
    for (const [firstChar, ids] of firstCharGroups) {
        if (ids.length === 1) {
            labels.set(ids[0], firstChar)
        } else {
            assignDisambiguatedLabels(ids, labels)
        }
    }

    return labels
}

// Uses subsequent characters to create unique labels when first characters collide
const assignDisambiguatedLabels = (
    ids: string[],
    labels: Map<string, string>
): void => {
    // Try increasing character positions until we find unique labels
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

    // Fallback: use first char + index
    for (let i = 0; i < ids.length; i++) {
        labels.set(ids[i], ids[i][0].toUpperCase() + i)
    }
}

// Builds the grid lines with hex offset indentation
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

// Builds the terrain legend
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

// Builds the squaddie listing with positions
const renderSquaddieList = (
    overview: MapOverview,
    squaddieLabels: Map<string, string>
): string[] => {
    if (squaddieLabels.size === 0) return []

    const lines: string[] = ["Squaddies:"]

    for (const row of overview.tiles) {
        for (const tile of row) {
            if (tile.squaddieId != undefined) {
                const id = tile.squaddieId.outOfBattleSquaddieId
                const label = squaddieLabels.get(id)!
                lines.push(`  ${label} = ${id} (${tile.row},${tile.col})`)
            }
        }
    }

    return lines
}

// Renders the full map as a text string
export const renderMap = (overview: MapOverview): string => {
    const squaddieLabels = buildSquaddieLabels(overview)

    const header = `Map: ${overview.width} columns x ${overview.height} rows`
    const gridLines = renderGridLines(overview, squaddieLabels)
    const legend = renderLegend()
    const squaddieList = renderSquaddieList(overview, squaddieLabels)

    return [header, ...gridLines, ...legend, ...squaddieList].join("\n")
}
