import { describe, it, expect } from "vitest"
import { processCommand } from "./commandProcessor.js"
import { MissionEngineTestHarness } from "../logic/src/testUtils/mission/missionEngineTestHarness.js"

describe("processCommand", () => {
    describe("quit action", () => {
        it("returns quit when input is Q", () => {
            const result = processCommand("Q")
            expect(result.action).toBe("quit")
            expect(result.message).toBe("Goodbye!")
        })

        it("returns quit when input is lowercase q", () => {
            const result = processCommand("q")
            expect(result.action).toBe("quit")
            expect(result.message).toBe("Goodbye!")
        })

        it("returns quit when input has surrounding whitespace", () => {
            const result = processCommand("  Q  ")
            expect(result.action).toBe("quit")
            expect(result.message).toBe("Goodbye!")
        })
    })

    describe("echo action", () => {
        it("returns echo with the original input for normal text", () => {
            const result = processCommand("hello world")
            expect(result.action).toBe("echo")
            expect(result.message).toBe("You entered: hello world")
        })

        it("returns echo for empty input", () => {
            const result = processCommand("")
            expect(result.action).toBe("echo")
            expect(result.message).toBe("You entered: ")
        })
    })

    describe("showCommands action", () => {
        it("returns showCommands with all command descriptions when input is ?", () => {
            const result = processCommand("?")
            expect(result.action).toBe("showCommands")
            expect(result.message).toContain("M - Show the map")
            expect(result.message).toContain("Q - Quit the game")
            expect(result.message).toContain("? - Show all commands")
        })

        it("returns showCommands when input has surrounding whitespace", () => {
            const result = processCommand(" ? ")
            expect(result.action).toBe("showCommands")
            expect(result.message).toContain("M - Show the map")
        })
    })

    describe("showMap action", () => {
        it("returns showMap when input is M", () => {
            const engine = new MissionEngineTestHarness()
            const result = processCommand("M", engine)
            expect(result.action).toBe("showMap")
            expect(result.message).toContain("Map:")
        })

        it("returns showMap when input is lowercase m", () => {
            const engine = new MissionEngineTestHarness()
            const result = processCommand("m", engine)
            expect(result.action).toBe("showMap")
            expect(result.message).toContain("Map:")
        })

        it("returns showMap when input has surrounding whitespace", () => {
            const engine = new MissionEngineTestHarness()
            const result = processCommand("  M  ", engine)
            expect(result.action).toBe("showMap")
            expect(result.message).toContain("Map:")
        })

        it("returns an error message when engine is undefined", () => {
            const result = processCommand("M")
            expect(result.action).toBe("showMap")
            expect(result.message).toBe(
                "No engine available to display the map."
            )
        })

        it("renders the test harness map with squaddies", () => {
            const engine = new MissionEngineTestHarness()
            const result = processCommand("M", engine)
            expect(result.message).toContain("5 columns x 4 rows")
            expect(result.message).toContain("lini")
            expect(result.message).toContain("slither-demon")
        })
    })
})
