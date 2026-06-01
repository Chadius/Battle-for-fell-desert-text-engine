import { describe, it, expect } from "vitest"
import { join } from "node:path"
import { listAvailableMissions, loadMissionFromFolder } from "./campaignLoader.js"
import { MissionEngine } from "../logic/src/mission/missionEngine/missionEngine.js"

// campaignData/campaigns/main lives at the project root (one level above src/).
const campaignFolderPath = join(process.cwd(), "campaignData", "campaigns", "main")
const campaignMissionsPath = join(campaignFolderPath, "missions")

describe("campaignLoader", () => {
    describe("listAvailableMissions", () => {
        it("returns a sorted list of mission folder names", () => {
            const missions = listAvailableMissions(campaignMissionsPath)
            expect(missions.length).toBeGreaterThan(0)
            expect(missions).toEqual([...missions].sort())
        })

        it("returns an empty array when the path does not exist", () => {
            const missions = listAvailableMissions("/this/path/does/not/exist")
            expect(missions).toEqual([])
        })

        it("includes the testHarness mission", () => {
            const missions = listAvailableMissions(campaignMissionsPath)
            expect(missions).toContain("testHarness")
        })
    })

    describe("loadMissionFromFolder", () => {
        it("loads and validates the testHarness mission successfully", () => {
            const engine = new MissionEngine()
            const missionFolderPath = join(campaignMissionsPath, "testHarness")
            const result = loadMissionFromFolder(engine, campaignFolderPath, missionFolderPath)
            expect(result.errors).toEqual([])
            expect(result.isValid).toBe(true)
        })

        it("allows the engine to report phase info after loading", () => {
            const engine = new MissionEngine()
            const missionFolderPath = join(campaignMissionsPath, "testHarness")
            loadMissionFromFolder(engine, campaignFolderPath, missionFolderPath)
            expect(engine.getCurrentAffiliationTurn()).toBeDefined()
        })
    })
})
