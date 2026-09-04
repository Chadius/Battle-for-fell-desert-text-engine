import { describe, it, expect } from "vitest"
import { CliPresenter } from "./cliPresenter.js"
import { MissionEngineTestHarness } from "../logic/src/testUtils/mission/missionEngineTestHarness.js"

describe("CliPresenter", () => {
    describe("the welcome screen", () => {
        it("shows the game title and the map name from the engine", () => {
            const text = welcomeText()
            expect(text).toContain("Battle of Fell Desert CLI")
            expect(text).toContain("Map: Test Harness Map")
        })

        it("lists the in-progress mission objectives", () => {
            const engine = new MissionEngineTestHarness()
            expect(engine.getInProgressMissionObjectives().length).toBeGreaterThan(0)

            expect(new CliPresenter(engine).welcomeText([], 0)).toContain("Objective:")
        })

        it("appends the supplied initial phase messages", () => {
            expect(welcomeText({ phaseMessages: ["Turn 0 start"] })).toContain("Turn 0 start")
        })
    })

    describe("the map panel", () => {
        it("renders the plain map when no overlay is active", () => {
            expect(mapText()).toContain("Test Harness Map")
        })

        it("returns the overlay map verbatim when one is active", () => {
            expect(mapText("OVERLAY")).toBe("OVERLAY")
        })
    })
})

function welcomeText({ phaseMessages = [] }: { phaseMessages?: string[] } = {}): string {
    return new CliPresenter(new MissionEngineTestHarness()).welcomeText(phaseMessages, 0)
}

function mapText(overlayMap?: string): string {
    return new CliPresenter(new MissionEngineTestHarness()).mapText(overlayMap)
}
