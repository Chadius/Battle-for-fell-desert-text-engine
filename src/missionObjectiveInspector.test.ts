import { describe, it, expect } from "vitest"
import { MissionObjectiveInspector } from "./missionObjectiveInspector.js"
import { MissionEngineTestHarness } from "../logic/src/testUtils/mission/missionEngineTestHarness.js"
import type { MissionObjectiveDisplayEntry } from "./missionObjectiveInspector.js"

describe("MissionObjectiveInspector", () => {
    describe("gatherEntries", () => {
        it("identifies non-failure objectives from SQUADDIES_DEFEATED criteria with ENEMY affiliation", () => {
            const engine = new MissionEngineTestHarness()
            const entries = MissionObjectiveInspector.gatherEntries(engine)

            const defeatEnemyEntry = entries.find(
                (e) => e.description.includes("enemy")
            )
            expect(defeatEnemyEntry).toBeDefined()
            expect(defeatEnemyEntry!.description).toContain("Defeat enemy:")
            expect(defeatEnemyEntry!.description).toContain("slither-demon")
            expect(defeatEnemyEntry!.isFailureCondition).toBe(false)
            expect(defeatEnemyEntry!.isCompleted).toBe(false)
        })

        it("identifies failure objectives from SQUADDIES_DEFEATED criteria with PLAYER affiliation", () => {
            const engine = new MissionEngineTestHarness()
            const entries = MissionObjectiveInspector.gatherEntries(engine)

            const defeatPlayerEntry = entries.find(
                (e) => e.description.includes("players")
            )
            expect(defeatPlayerEntry).toBeDefined()
            expect(defeatPlayerEntry!.description).toContain("Defeat players:")
            expect(defeatPlayerEntry!.description).toContain("lini")
            expect(defeatPlayerEntry!.isFailureCondition).toBe(true)
            expect(defeatPlayerEntry!.isCompleted).toBe(false)
        })
    })

    describe("formatEntries", () => {
        it("formats objectives under 'Objective:' header and failures under 'Failure:' header", () => {
            const entries: MissionObjectiveDisplayEntry[] = [
                {
                    description: "Defeat enemy: slither-demon",
                    isCompleted: false,
                    isFailureCondition: false,
                },
                {
                    description: "Defeat players: lini",
                    isCompleted: false,
                    isFailureCondition: true,
                },
            ]

            const result = MissionObjectiveInspector.formatEntries(entries)
            expect(result).toContain("Objective:")
            expect(result).toContain("- Defeat enemy: slither-demon")
            expect(result).toContain("Failure:")
            expect(result).toContain("- Defeat players: lini")
        })

        it("shows completed objectives before incomplete ones within each section", () => {
            const entries: MissionObjectiveDisplayEntry[] = [
                {
                    description: "Defeat enemy: goblin",
                    isCompleted: false,
                    isFailureCondition: false,
                },
                {
                    description: "Defeat enemy: slither-demon",
                    isCompleted: true,
                    isFailureCondition: false,
                },
            ]

            const result = MissionObjectiveInspector.formatEntries(entries)
            const lines = result.split("\n")
            const slitherIndex = lines.findIndex((l) =>
                l.includes("slither-demon")
            )
            const goblinIndex = lines.findIndex((l) => l.includes("goblin"))
            expect(slitherIndex).toBeLessThan(goblinIndex)
        })

        it("marks completed entries with [DONE]", () => {
            const entries: MissionObjectiveDisplayEntry[] = [
                {
                    description: "Defeat enemy: slither-demon",
                    isCompleted: true,
                    isFailureCondition: false,
                },
            ]

            const result = MissionObjectiveInspector.formatEntries(entries)
            expect(result).toContain("[DONE]")
        })

        it("returns empty string for empty entries", () => {
            const result = MissionObjectiveInspector.formatEntries([])
            expect(result).toBe("")
        })

        it("omits Failure section when no failure entries exist", () => {
            const entries: MissionObjectiveDisplayEntry[] = [
                {
                    description: "Defeat enemy: slither-demon",
                    isCompleted: false,
                    isFailureCondition: false,
                },
            ]

            const result = MissionObjectiveInspector.formatEntries(entries)
            expect(result).toContain("Objective:")
            expect(result).not.toContain("Failure:")
        })

        it("omits Objective section when no objective entries exist", () => {
            const entries: MissionObjectiveDisplayEntry[] = [
                {
                    description: "Defeat players: lini",
                    isCompleted: false,
                    isFailureCondition: true,
                },
            ]

            const result = MissionObjectiveInspector.formatEntries(entries)
            expect(result).not.toContain("Objective:")
            expect(result).toContain("Failure:")
        })
    })

    describe("integration with test harness", () => {
        it("produces formatted output with both objectives and failures", () => {
            const engine = new MissionEngineTestHarness()
            const entries = MissionObjectiveInspector.gatherEntries(engine)
            const result = MissionObjectiveInspector.formatEntries(entries)

            expect(result).toContain("Objective:")
            expect(result).toContain("- Defeat enemy:")
            expect(result).toContain("Failure:")
            expect(result).toContain("- Defeat players:")
        })
    })
})
