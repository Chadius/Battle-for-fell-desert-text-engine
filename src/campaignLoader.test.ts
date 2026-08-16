import { describe, it, expect, afterEach, beforeEach, vi } from "vitest"
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
import { MissionEngineTestHarness } from "../logic/src/testUtils/mission/missionEngineTestHarness.js"

// This fixture is owned by fell-desert-cli (not the external campaignData/campaigns submodule,
// which is separate content that can be renamed/reshuffled independently of these tests).
const campaignsPath = join(process.cwd(), "src", "testUtils", "fixtures", "campaignLoader", "campaigns")
const campaignFolderPath = join(campaignsPath, "minimalCampaign")
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

        it("includes the minimalCampaign and otherCampaign fixtures", () => {
            const campaigns = listAvailableCampaigns(campaignsPath)
            expect(campaigns).toContain("minimalCampaign")
            expect(campaigns).toContain("otherCampaign")
        })
    })

    describe("loadCampaignDisplayName", () => {
        it("reads the en-US displayName from campaign.json", () => {
            const displayName = loadCampaignDisplayName(campaignFolderPath, "minimalCampaign")
            expect(displayName).toEqual("Minimal Campaign")
        })

        it("falls back to the folder name when campaign.json does not exist", () => {
            const displayName = loadCampaignDisplayName("/this/path/does/not/exist", "minimalCampaign")
            expect(displayName).toEqual("minimalCampaign")
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

        it("includes the movieMission mission", () => {
            const missions = listAvailableMissions(campaignMissionsPath)
            expect(missions).toContain("movieMission")
        })
    })

    describe("loadMissionFromFolder", () => {
        // Generated fresh per test from MissionEngineTestHarness (the logic submodule's own
        // stable, versioned test scenario) rather than hand-authored JSON, so this fixture can
        // never drift out of sync with the engine's validation schema.
        let missionFolderPath: string

        beforeEach(() => {
            missionFolderPath = mkdtempSync(join(tmpdir(), "campaign-loader-mission-"))
            writeFileSync(
                join(missionFolderPath, "squaddies.json"),
                JSON.stringify(MissionEngineTestHarness.serializeSquaddies())
            )
            writeFileSync(
                join(missionFolderPath, "attributeSheets.json"),
                JSON.stringify(MissionEngineTestHarness.serializeAttributeSheets())
            )
            writeFileSync(join(missionFolderPath, "items.json"), JSON.stringify([]))
            writeFileSync(
                join(missionFolderPath, "maps.json"),
                JSON.stringify(MissionEngineTestHarness.serializeMaps())
            )
            writeFileSync(
                join(missionFolderPath, "actions.json"),
                JSON.stringify(MissionEngineTestHarness.serializeActions())
            )
            writeFileSync(
                join(missionFolderPath, "missionState.json"),
                JSON.stringify(MissionEngineTestHarness.serializeMissionState())
            )
        })

        afterEach(() => {
            rmSync(missionFolderPath, { recursive: true, force: true })
        })

        it("loads and validates the generated mission successfully", () => {
            const engine = new MissionEngine()
            const result = loadMissionFromFolder(engine, campaignFolderPath, missionFolderPath)
            expect(result.errors).toEqual([])
        })

        it("allows the engine to report phase info after loading", () => {
            const engine = new MissionEngine()
            loadMissionFromFolder(engine, campaignFolderPath, missionFolderPath)
            expect(engine.getCurrentAffiliationTurn()).toBeDefined()
        })
    })

    describe("loadArmyFromFolder", () => {
        const MinimalCampaignSquaddieIds = {
            teros: "campaign-squaddie-teros",
            vale: "campaign-squaddie-vale",
            gloria: "campaign-squaddie-gloria",
            wimp: "campaign-squaddie-wimp",
        } as const

        it("builds an ArmyManager containing every campaign squaddie in army.json", () => {
            const armyManager = loadArmyFromFolder(campaignFolderPath)

            expect(armyManager.has(MinimalCampaignSquaddieIds.teros)).toBe(true)
            expect(armyManager.has(MinimalCampaignSquaddieIds.vale)).toBe(true)
            expect(armyManager.has(MinimalCampaignSquaddieIds.gloria)).toBe(true)
        })

        it("marks Wimp as the leader", () => {
            const armyManager = loadArmyFromFolder(campaignFolderPath)
            const wimp = armyManager.get(MinimalCampaignSquaddieIds.wimp)
            expect(wimp.isLeader).toBe(true)
        })

        it("returns an empty ArmyManager when army.json does not exist", () => {
            const armyManager = loadArmyFromFolder("/this/path/does/not/exist")
            expect(armyManager.getAll()).toEqual([])
        })
    })

    describe("loadMoviesFromFolder", () => {
        const movieMissionFolderPath = join(campaignMissionsPath, "movieMission")

        it("reads movies defined at the campaign root", () => {
            const movies = loadMoviesFromFolder(campaignFolderPath)
            expect(movies.map((movie) => movie.id)).toContain("movie-campaign-intro")
        })

        it("merges in movies defined in a mission's own movies.json", () => {
            const movies = loadMoviesFromFolder(campaignFolderPath, movieMissionFolderPath)
            expect(movies.map((movie) => movie.id)).toContain("movie-mission-specific")
        })

        it("returns only campaign-root movies when no mission folder is given", () => {
            const movies = loadMoviesFromFolder(campaignFolderPath)
            expect(movies.map((movie) => movie.id)).not.toContain("movie-mission-specific")
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
