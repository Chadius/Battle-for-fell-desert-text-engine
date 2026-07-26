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
