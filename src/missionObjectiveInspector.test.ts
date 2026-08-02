import { describe, it, expect } from "vitest"
import { isObjectiveVisible, MissionObjectiveInspector } from "./missionObjectiveInspector.js"
import { MissionEngineTestHarness } from "../logic/src/testUtils/mission/missionEngineTestHarness.js"
import type { MissionObjectiveDisplayEntry } from "./missionObjectiveInspector.js"
import { MissionObjectiveService } from "../logic/src/mission/missionObjective.js"
import { MissionObjectiveRewardService } from "../logic/src/mission/missionObjectiveReward.js"
import { MissionObjectiveCriteriaService } from "../logic/src/mission/missionObjectiveCriteria.js"
import type { MissionObjectiveCriteria } from "../logic/src/mission/missionObjectiveCriteria.js"
import { MissionAffiliationTurn } from "../logic/src/mission/missionTurn.js"

const newObjective = (hidden?: boolean) =>
    MissionObjectiveService.new({
        id: "test-objective",
        rewards: [MissionObjectiveRewardService.newMissionEndsReward()],
        criteria: [
            MissionObjectiveCriteriaService.newSpecificSquaddiesDefeatedCriteria(
                { outOfBattleSquaddieIds: ["target"] }
            ),
        ],
        hidden,
    })

describe("MissionObjectiveInspector", () => {
    describe("gatherEntries", () => {
        it("identifies non-failure objectives from ALL_SQUADDIES_DEFEATED criteria with ENEMY affiliation", () => {
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

        it("identifies failure objectives from ALL_SQUADDIES_DEFEATED criteria with PLAYER affiliation", () => {
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

        it("shows an objective to defeat the enemy's army leader", () => {
            const engine = new MissionEngineTestHarness()
            addCriteriaObjective(engine, [
                MissionObjectiveCriteriaService.newArmyLeaderDefeatedCriteria(),
            ])

            const entries = MissionObjectiveInspector.gatherEntries(engine)

            const leaderEntry = entries.find((e) =>
                e.description.includes("army leader")
            )
            expect(leaderEntry).toBeDefined()
            expect(leaderEntry!.description).toContain("Defeat the army leader")
        })

        it("shows an objective to reach turn 5 during the player's turn", () => {
            const engine = new MissionEngineTestHarness()
            addCriteriaObjective(engine, [
                MissionObjectiveCriteriaService.newPhaseReachedCriteria({
                    turnCount: 5,
                    missionAffiliationTurn: MissionAffiliationTurn.PLAYER_TURN,
                }),
            ])

            const entries = MissionObjectiveInspector.gatherEntries(engine)

            const phaseEntry = entries.find((e) =>
                e.description.includes("Reach turn")
            )
            expect(phaseEntry).toBeDefined()
            expect(phaseEntry!.description).toContain(
                "Reach turn 5 (Player Turn)"
            )
        })

        it("still shows ordinary (non-hidden) objectives when revealHiddenMissionObjectives is on", () => {
            const engine = new MissionEngineTestHarness()
            engine.setDebugFlag("revealHiddenMissionObjectives", true)
            const entries = MissionObjectiveInspector.gatherEntries(engine)

            expect(
                entries.some((e) => e.description.includes("slither-demon"))
            ).toBe(true)
        })
    })

    // Adds an objective with the given criteria to the engine, using placeholder
    // id/reward values that are incidental to the tests exercising criteria descriptions.
    function addCriteriaObjective(
        engine: MissionEngineTestHarness,
        criteria: MissionObjectiveCriteria[]
    ) {
        engine.addObjective(
            MissionObjectiveService.new({
                id: "test-added-objective",
                rewards: [MissionObjectiveRewardService.newMissionEndsReward()],
                criteria,
            })
        )
    }

    describe("isObjectiveVisible", () => {
        it("hides a hidden objective when revealHiddenMissionObjectives is off", () => {
            expect(isObjectiveVisible(newObjective(true), false)).toBe(false)
        })

        it("shows a hidden objective when revealHiddenMissionObjectives is on", () => {
            expect(isObjectiveVisible(newObjective(true), true)).toBe(true)
        })

        it("shows a non-hidden objective regardless of the debug flag", () => {
            expect(isObjectiveVisible(newObjective(false), false)).toBe(true)
            expect(isObjectiveVisible(newObjective(undefined), false)).toBe(
                true
            )
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

        it("formats SPECIFIC_SQUADDIES_INJURED description under Objective header", () => {
            const entries: MissionObjectiveDisplayEntry[] = [
                {
                    description: "Injure: slither-demon-v2",
                    isCompleted: false,
                    isFailureCondition: false,
                },
            ]

            const result = MissionObjectiveInspector.formatEntries(entries)
            expect(result).toContain("Objective:")
            expect(result).toContain("- Injure: slither-demon-v2")
        })

        it("formats SPECIFIC_SQUADDIES_DEFEATED description under Objective header", () => {
            const entries: MissionObjectiveDisplayEntry[] = [
                {
                    description: "Defeat specific: slither-demon-v2",
                    isCompleted: false,
                    isFailureCondition: false,
                },
            ]

            const result = MissionObjectiveInspector.formatEntries(entries)
            expect(result).toContain("Objective:")
            expect(result).toContain("- Defeat specific: slither-demon-v2")
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
