import { describe, it, expect } from "vitest"
import { ControllableSquaddieInspector } from "./controllableSquaddieInspector.js"
import type { ControllableSquaddieEntry } from "./controllableSquaddieInspector.js"
import { MissionEngineTestHarness } from "../logic/src/testUtils/mission/missionEngineTestHarness.js"

describe("ControllableSquaddieInspector", () => {
    describe("formatEntries", () => {
        it("returns no squaddies message when entries is empty", () => {
            const result =
                ControllableSquaddieInspector.formatEntries([])
            expect(result).toBe("No squaddies can act this phase.")
        })

        it("formats a single squaddie with name, position, and AP", () => {
            const entries: ControllableSquaddieEntry[] = [
                {
                    squaddieId: {
                        inBattleSquaddieId: 0,
                        outOfBattleSquaddieId: "lini",
                    },
                    name: "Lini",
                    currentActionPoints: 3,
                    maximumActionPoints: 3,
                    coordinate: { row: 0, col: 0 },
                },
            ]
            const result =
                ControllableSquaddieInspector.formatEntries(entries)
            expect(result).toContain("Squaddies who can act:")
            expect(result).toContain("Lini (0,0) - AP: 3/3")
        })

        it("formats multiple squaddies each on their own line", () => {
            const entries: ControllableSquaddieEntry[] = [
                {
                    squaddieId: {
                        inBattleSquaddieId: 0,
                        outOfBattleSquaddieId: "lini",
                    },
                    name: "Lini",
                    currentActionPoints: 3,
                    maximumActionPoints: 3,
                    coordinate: { row: 0, col: 0 },
                },
                {
                    squaddieId: {
                        inBattleSquaddieId: 1,
                        outOfBattleSquaddieId: "sir-camil",
                    },
                    name: "Sir Camil",
                    currentActionPoints: 2,
                    maximumActionPoints: 4,
                    coordinate: { row: 1, col: 2 },
                },
            ]
            const result =
                ControllableSquaddieInspector.formatEntries(entries)
            expect(result).toContain("Lini (0,0) - AP: 3/3")
            expect(result).toContain("Sir Camil (1,2) - AP: 2/4")
        })

        it("shows off map when coordinate is undefined", () => {
            const entries: ControllableSquaddieEntry[] = [
                {
                    squaddieId: {
                        inBattleSquaddieId: 0,
                        outOfBattleSquaddieId: "lini",
                    },
                    name: "Lini",
                    currentActionPoints: 3,
                    maximumActionPoints: 3,
                    coordinate: undefined,
                },
            ]
            const result =
                ControllableSquaddieInspector.formatEntries(entries)
            expect(result).toContain("Lini (off map) - AP: 3/3")
        })

        it("shows off map when coordinate has undefined row and col", () => {
            const entries: ControllableSquaddieEntry[] = [
                {
                    squaddieId: {
                        inBattleSquaddieId: 0,
                        outOfBattleSquaddieId: "lini",
                    },
                    name: "Lini",
                    currentActionPoints: 3,
                    maximumActionPoints: 3,
                    coordinate: { row: undefined, col: undefined },
                },
            ]
            const result =
                ControllableSquaddieInspector.formatEntries(entries)
            expect(result).toContain("Lini (off map) - AP: 3/3")
        })
    })

    describe("gatherEntries", () => {
        it("returns entries for squaddies who can act during PLAYER_TURN", () => {
            const engine = new MissionEngineTestHarness()
            engine.transitionToNextPhase()
            engine.transitionToNextPhase()

            const entries =
                ControllableSquaddieInspector.gatherEntries(engine)
            expect(entries.length).toBeGreaterThan(0)

            const liniEntry = entries.find(
                (e) => e.name === "Lini"
            )
            expect(liniEntry).toBeDefined()
            expect(liniEntry!.coordinate).toBeDefined()
            expect(liniEntry!.coordinate!.row).toBe(0)
            expect(liniEntry!.coordinate!.col).toBe(0)
            expect(liniEntry!.currentActionPoints).toBeGreaterThan(0)
        })

        it("returns empty array during TURN_START", () => {
            const engine = new MissionEngineTestHarness()
            const entries =
                ControllableSquaddieInspector.gatherEntries(engine)
            expect(entries).toEqual([])
        })
    })
})
