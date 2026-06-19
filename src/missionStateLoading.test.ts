import { describe, it, expect } from "vitest"
import { TextMissionRunner } from "./textMissionRunner.js"
import { MissionEngineTestHarness } from "../logic/src/testUtils/mission/missionEngineTestHarness.js"

describe("MissionStateLoading", () => {
    it("serializes and reloads test harness mission state without errors", () => {
        const engine = new MissionEngineTestHarness()
        const json = engine.serializeCurrentMissionState()
        const { isValid, errors } = engine.loadMissionStateFromJson(json)
        expect(isValid).toBe(true)
        expect(errors).toHaveLength(0)
    })

    it("runner accepts the reloaded engine and processes commands", () => {
        const engine = new MissionEngineTestHarness()
        const json = engine.serializeCurrentMissionState()
        engine.loadMissionStateFromJson(json)
        const runner = new TextMissionRunner(engine)
        const result = runner.processInput("P")
        expect(result.shouldQuit).toBe(false)
        expect(result.text).toContain("Turn")
    })
})
