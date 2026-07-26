import { describe, it, expect } from "vitest"
import { wrapLine } from "./terminalLayout.js"

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
