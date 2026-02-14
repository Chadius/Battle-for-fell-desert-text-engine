import {describe, expect, it} from "vitest"
import {SquaddieActionInspector,} from "./squaddieActionInspector.js"
import type {
    SquaddieActionValidity
} from "../logic/src/squaddieAction/calculate/validity/squaddieActionValidationService.js"
import type {SquaddieAction} from "../logic/src/squaddieAction/squaddieAction.js"
import {SquaddieActionService} from "../logic/src/squaddieAction/squaddieAction.js"
import {MissionEngineTestHarness} from "../logic/src/testUtils/mission/missionEngineTestHarness.js"
import {DegreeOfSuccess} from "../logic/src/degreesOfSuccess/degreeOfSuccess.js"

describe("squaddieActionInspector", () => {
    describe("formatActionPointCost", () => {
        it("returns AP cost suffix for numeric cost", () => {
            expect(SquaddieActionInspector.formatActionPointCost(1)).toBe(" (1 AP)")
        })

        it("returns all AP suffix for 'all' cost", () => {
            expect(SquaddieActionInspector.formatActionPointCost("all")).toBe(" (all AP)")
        })

        it("returns empty string for cost 0", () => {
            expect(SquaddieActionInspector.formatActionPointCost(0)).toBe("")
        })

        it("returns empty string for undefined cost", () => {
            expect(SquaddieActionInspector.formatActionPointCost(undefined)).toBe("")
        })
    })

    describe("formatSquaddieActions", () => {
        const emptyBattleSquaddieId = {
            inBattleSquaddieId: 0,
            outOfBattleSquaddieId: "test",
        }

        it("returns empty string when both lists are empty", () => {
            const validity: SquaddieActionValidity = {
                battleSquaddieId: emptyBattleSquaddieId,
                invalidActions: [],
                validActions: [],
            }
            const result = SquaddieActionInspector.formatSquaddieActions(
                validity,
                new Map<string, SquaddieAction>()
            )
            expect(result).toBe("")
        })

        it("shows invalid actions with reasons", () => {
            const validity: SquaddieActionValidity = {
                battleSquaddieId: emptyBattleSquaddieId,
                invalidActions: [
                    {
                        actionId: "sword",
                        actionName: "Sword",
                        reason: "No applicable targets in range",
                    },
                ],
                validActions: [],
            }
            const result = SquaddieActionInspector.formatSquaddieActions(
                validity,
                new Map<string, SquaddieAction>()
            )
            expect(result).toContain("Actions:")
            expect(result).toContain("  Invalid:")
            expect(result).toContain(
                "    Sword - No applicable targets in range"
            )
            expect(result).not.toContain("  Valid:")
        })

        it("shows valid actions with AP costs", () => {
            const healAction = SquaddieActionService.new({
                id: "heal",
                name: "Heal",
                effectOnActor: {
                    [DegreeOfSuccess.SUCCESS]: {
                        actionPoints: {spent: 1},
                    },
                },
            })

            const validity: SquaddieActionValidity = {
                battleSquaddieId: emptyBattleSquaddieId,
                invalidActions: [],
                validActions: [
                    {
                        actionId: "heal",
                        actionName: "Heal",
                        targetCoordinates: [],
                        targetBattleSquaddieIds: [],
                    },
                ],
            }

            const actionsById = new Map<string, SquaddieAction>()
            actionsById.set("heal", healAction)

            const result = SquaddieActionInspector.formatSquaddieActions(validity, actionsById)
            expect(result).toContain("Actions:")
            expect(result).toContain("  Valid:")
            expect(result).toContain("    Heal (1 AP)")
            expect(result).not.toContain("  Invalid:")
        })

        it("shows End Turn with all AP suffix", () => {
            const endTurnAction = SquaddieActionService.defaultEndTurn()

            const validity: SquaddieActionValidity = {
                battleSquaddieId: emptyBattleSquaddieId,
                invalidActions: [],
                validActions: [
                    {
                        actionId: "default-end-turn",
                        actionName: "End Turn",
                        targetCoordinates: [],
                        targetBattleSquaddieIds: [],
                    },
                ],
            }

            const actionsById = new Map<string, SquaddieAction>()
            actionsById.set("default-end-turn", endTurnAction)

            const result = SquaddieActionInspector.formatSquaddieActions(validity, actionsById)
            expect(result).toContain("    End Turn (all AP)")
        })

        it("shows Move without AP cost suffix", () => {
            const moveAction = SquaddieActionService.defaultMove()

            const validity: SquaddieActionValidity = {
                battleSquaddieId: emptyBattleSquaddieId,
                invalidActions: [],
                validActions: [
                    {
                        actionId: "default-move",
                        actionName: "Move",
                        targetCoordinates: [],
                        targetBattleSquaddieIds: [],
                    },
                ],
            }

            const actionsById = new Map<string, SquaddieAction>()
            actionsById.set("default-move", moveAction)

            const result = SquaddieActionInspector.formatSquaddieActions(validity, actionsById)
            expect(result).toContain("    Move")
            expect(result).not.toContain("    Move (")
        })

        it("shows both invalid and valid sections", () => {
            const endTurnAction = SquaddieActionService.defaultEndTurn()

            const validity: SquaddieActionValidity = {
                battleSquaddieId: emptyBattleSquaddieId,
                invalidActions: [
                    {
                        actionId: "sword",
                        actionName: "Sword",
                        reason: "No applicable targets in range",
                    },
                ],
                validActions: [
                    {
                        actionId: "default-end-turn",
                        actionName: "End Turn",
                        targetCoordinates: [],
                        targetBattleSquaddieIds: [],
                    },
                ],
            }

            const actionsById = new Map<string, SquaddieAction>()
            actionsById.set("default-end-turn", endTurnAction)

            const result = SquaddieActionInspector.formatSquaddieActions(validity, actionsById)
            expect(result).toContain("  Invalid:")
            expect(result).toContain("  Valid:")

            const invalidIndex = result.indexOf("  Invalid:")
            const validIndex = result.indexOf("  Valid:")
            expect(invalidIndex).toBeLessThan(validIndex)
        })

        it("formats actions from the test harness engine", () => {
            const engine = new MissionEngineTestHarness()
            const liniSquaddieId = engine.getLiniSquaddieId()
            const validity =
                engine.getSquaddieActionValidity(liniSquaddieId)

            const actionsById = new Map<string, SquaddieAction>()
            for (const validAction of validity.validActions) {
                actionsById.set(
                    validAction.actionId,
                    engine.getActionById(validAction.actionId)
                )
            }

            const result = SquaddieActionInspector.formatSquaddieActions(validity, actionsById)
            expect(result).toContain("Actions:")
            expect(result).toContain("End Turn (all AP)")
            expect(result).toContain("Move")
        })
    })
})
