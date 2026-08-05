// Splits a line into chunks no wider than `width`, so long lines wrap onto extra rows within a
// fixed-width pane instead of overflowing past its boundary into whatever is drawn next to it.
// Falls back to the original line if width is non-positive (a degenerately narrow terminal).
export const wrapLine = (line: string, width: number): string[] => {
    if (width <= 0 || line.length <= width) return [line]

    const chunks: string[] = []
    for (let i = 0; i < line.length; i += width) {
        chunks.push(line.slice(i, i + width))
    }
    return chunks
}

// Splits map text into lines that fit within availableRows, keeping the top of the content
// (the map grid) intact. When the content is taller than availableRows, the trailing lines
// (legend, squaddie list, objectives) are dropped and replaced with a single indicator line so
// the cut is visible instead of silently disappearing.
export const layoutLeftPane = (mapText: string, availableRows: number): string[] => {
    const mapLines = mapText.split("\n")
    if (mapLines.length <= availableRows || availableRows <= 0) return mapLines

    // The indicator itself occupies one of the available rows, so at least 2 lines are always
    // hidden whenever this branch is reached — "lines" is never grammatically singular here.
    const visibleCount = Math.max(availableRows - 1, 0)
    const visibleMapLines = mapLines.slice(0, visibleCount)
    const hiddenCount = mapLines.length - visibleCount
    const indicator = `... ${hiddenCount} more lines (resize terminal for full view)`
    return [...visibleMapLines, indicator]
}
