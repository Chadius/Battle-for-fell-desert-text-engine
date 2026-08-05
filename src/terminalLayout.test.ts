import { describe, it, expect } from "vitest"
import { layoutLeftPane, wrapLine } from "./terminalLayout.js"

describe("wrapLine", () => {
    it("returns the line unchanged when it fits within the width", () => {
        expect(wrapLine("short", 10)).toEqual(["short"])
    })

    it("returns the line unchanged when it exactly fills the width", () => {
        expect(wrapLine("12345", 5)).toEqual(["12345"])
    })

    it("splits a line longer than the width into multiple chunks", () => {
        expect(wrapLine("abcdefghij", 4)).toEqual(["abcd", "efgh", "ij"])
    })

    it("falls back to the original line when width is zero or negative", () => {
        expect(wrapLine("a line that would otherwise wrap", 0)).toEqual([
            "a line that would otherwise wrap",
        ])
        expect(wrapLine("a line that would otherwise wrap", -5)).toEqual([
            "a line that would otherwise wrap",
        ])
    })

    it("treats an empty line as fitting within any positive width", () => {
        expect(wrapLine("", 10)).toEqual([""])
    })
})

describe("layoutLeftPane", () => {
    it("returns all lines unchanged when the content fits within availableRows", () => {
        const mapText = "line1\nline2\nline3"
        expect(layoutLeftPane(mapText, 3)).toEqual(["line1", "line2", "line3"])
        expect(layoutLeftPane(mapText, 5)).toEqual(["line1", "line2", "line3"])
    })

    it("truncates and appends an indicator line when content overflows availableRows", () => {
        const mapText = "line1\nline2\nline3\nline4\nline5"

        const result = layoutLeftPane(mapText, 3)

        expect(result).toEqual([
            "line1",
            "line2",
            "... 3 more lines (resize terminal for full view)",
        ])
    })

    it("returns the content unchanged when availableRows is zero or negative", () => {
        const mapText = "line1\nline2"
        expect(layoutLeftPane(mapText, 0)).toEqual(["line1", "line2"])
        expect(layoutLeftPane(mapText, -1)).toEqual(["line1", "line2"])
    })
})
