import { describe, it, expect, afterEach, vi } from "vitest"
import { join } from "node:path"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import {
    listAvailableCampaigns,
    listAvailableMissions,
    loadArmyFromFolder,
    loadCampaignDisplayName,
    loadGlossaryFromFolder,
    loadMissionFromFolder,
    loadMoviesFromFolder,
} from "./campaignLoader.js"
import { MissionEngine } from "../logic/src/mission/missionEngine/missionEngine.js"
import { TargetPracticeCampaignSquaddieIds } from "./testUtils/deploymentFixture.js"

// campaignData/campaigns lives at the project root (one level above src/).
const campaignsPath = join(process.cwd(), "campaignData", "campaigns")
const campaignFolderPath = join(campaignsPath, "test")
const campaignMissionsPath = join(campaignFolderPath, "missions")

describe("campaignLoader", () => {
    describe("listAvailableCampaigns", () => {
        it("returns a sorted list of campaign folder names", () => {
            const campaigns = listAvailableCampaigns(campaignsPath)
            expect(campaigns).toEqual([...campaigns].sort())
        })

        it("returns an empty array when the path does not exist", () => {
            const campaigns = listAvailableCampaigns("/this/path/does/not/exist")
            expect(campaigns).toEqual([])
        })

        it("includes the test and templeDefense campaigns", () => {
            const campaigns = listAvailableCampaigns(campaignsPath)
            expect(campaigns).toContain("test")
            expect(campaigns).toContain("templeDefense")
        })
    })

    describe("loadCampaignDisplayName", () => {
        it("reads the en-US displayName from campaign.json", () => {
            const displayName = loadCampaignDisplayName(campaignFolderPath, "test")
            expect(displayName).toEqual("Main Campaign")
        })

        it("falls back to the folder name when campaign.json does not exist", () => {
            const displayName = loadCampaignDisplayName("/this/path/does/not/exist", "test")
            expect(displayName).toEqual("test")
        })
    })

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

    describe("loadArmyFromFolder", () => {
        it("builds an ArmyManager containing every campaign squaddie in army.json", () => {
            const armyManager = loadArmyFromFolder(campaignFolderPath)

            expect(armyManager.has(TargetPracticeCampaignSquaddieIds.teros)).toBe(true)
            expect(armyManager.has(TargetPracticeCampaignSquaddieIds.vale)).toBe(true)
            expect(armyManager.has(TargetPracticeCampaignSquaddieIds.gloria)).toBe(true)
        })

        it("marks Wimp as the leader", () => {
            const armyManager = loadArmyFromFolder(campaignFolderPath)
            const wimp = armyManager.get(TargetPracticeCampaignSquaddieIds.wimp)
            expect(wimp.isLeader).toBe(true)
        })

        it("returns an empty ArmyManager when army.json does not exist", () => {
            const armyManager = loadArmyFromFolder("/this/path/does/not/exist")
            expect(armyManager.getAll()).toEqual([])
        })
    })

    describe("loadMoviesFromFolder", () => {
        const templeDefenseFolderPath = join(campaignsPath, "templeDefense")
        const templeDefenseMissionFolderPath = join(templeDefenseFolderPath, "missions", "0000")

        it("reads movies defined at the campaign root", () => {
            const movies = loadMoviesFromFolder(campaignFolderPath)
            expect(movies.map((movie) => movie.id)).toContain("movie-testHarness-intro")
        })

        it("merges in movies defined in a mission's own movies.json", () => {
            const movies = loadMoviesFromFolder(templeDefenseFolderPath, templeDefenseMissionFolderPath)
            expect(movies.map((movie) => movie.id)).toContain("movie-temple-defense-introduction")
        })

        it("returns only campaign-root movies when no mission folder is given", () => {
            const movies = loadMoviesFromFolder(templeDefenseFolderPath)
            expect(movies.map((movie) => movie.id)).not.toContain("movie-temple-defense-introduction")
        })

        it("returns an empty array when neither movies.json exists", () => {
            const movies = loadMoviesFromFolder("/this/path/does/not/exist")
            expect(movies).toEqual([])
        })
    })

    describe("loadGlossaryFromFolder", () => {
        let tempFolderPath: string | undefined

        afterEach(() => {
            if (tempFolderPath != undefined) {
                rmSync(tempFolderPath, { recursive: true, force: true })
                tempFolderPath = undefined
            }
        })

        it("builds a GlossaryManager that resolves terms from glossary.json", () => {
            const glossaryManager = loadGlossaryFromFolder(campaignFolderPath)

            const resolved = glossaryManager.resolveTerm("condition.ARMOR", "en-us")
            expect(resolved).toEqual({
                name: "Armor",
                definition:
                    "Increases your armor, reducing the chance you will get hit by armor based attacks",
            })
        })

        it("returns an empty GlossaryManager when glossary.json does not exist", () => {
            const glossaryManager = loadGlossaryFromFolder("/this/path/does/not/exist")
            expect(glossaryManager.has("condition.ARMOR")).toBe(false)
        })

        it("resolves terms from a glossary.json with no data envelope", () => {
            tempFolderPath = mkdtempSync(join(tmpdir(), "glossary-loader-"))
            writeFileSync(
                join(tempFolderPath, "glossary.json"),
                JSON.stringify({
                    terms: [
                        {
                            termId: "condition.ARMOR",
                            type: "SQUADDIE_CONDITION_TYPE",
                            name: { "en-us": { text: "Armor" } },
                            definition: { "en-us": { text: "Reduces the chance you get hit." } },
                        },
                    ],
                })
            )

            const glossaryManager = loadGlossaryFromFolder(tempFolderPath)

            expect(glossaryManager.resolveTerm("condition.ARMOR", "en-us")).toEqual({
                name: "Armor",
                definition: "Reduces the chance you get hit.",
            })
        })

        it("warns and returns a manager without the malformed terms when glossary.json fails validation", () => {
            tempFolderPath = mkdtempSync(join(tmpdir(), "glossary-loader-"))
            writeFileSync(
                join(tempFolderPath, "glossary.json"),
                JSON.stringify({ data: { terms: [{ termId: "condition.ARMOR" }] } })
            )
            const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

            const glossaryManager = loadGlossaryFromFolder(tempFolderPath)

            expect(warnSpy).toHaveBeenCalled()
            expect(glossaryManager.has("condition.ARMOR")).toBe(false)

            warnSpy.mockRestore()
        })
    })
})
