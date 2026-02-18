import { describe, it, expect } from "vitest"
import { TextMissionRunner } from "./textMissionRunner.js"
import { MissionEngineTestHarness } from "../logic/src/testUtils/mission/missionEngineTestHarness.js"

describe("TextMissionRunner", () => {
    describe("getWelcomeText", () => {
        it("returns a string containing the game title", () => {
            const engine = new MissionEngineTestHarness()
            const runner = new TextMissionRunner(engine)
            expect(runner.getWelcomeText()).toContain("Battle of Fell Desert CLI")
        })

        it("includes objective text when the engine has objectives", () => {
            const engine = new MissionEngineTestHarness()
            const runner = new TextMissionRunner(engine)
            expect(runner.getWelcomeText()).toContain("Objective:")
        })
    })

    describe("processInput", () => {
        it("returns shouldQuit true with goodbye text for Q", () => {
            const engine = new MissionEngineTestHarness()
            const runner = new TextMissionRunner(engine)
            const result = runner.processInput("Q")
            expect(result.shouldQuit).toBe(true)
            expect(result.text).toBe("Goodbye!")
        })

        it("returns shouldQuit false with map text for M", () => {
            const engine = new MissionEngineTestHarness()
            const runner = new TextMissionRunner(engine)
            const result = runner.processInput("M")
            expect(result.shouldQuit).toBe(false)
            expect(result.text).toContain("Map:")
        })

        it("updates internal context when a coordinate with a squaddie is inspected, allowing L to show details", () => {
            const engine = new MissionEngineTestHarness()
            const runner = new TextMissionRunner(engine)

            runner.processInput("0, 0")

            const lookResult = runner.processInput("L")
            expect(lookResult.shouldQuit).toBe(false)
            expect(lookResult.text).toContain("Lini")
        })
    })
})
