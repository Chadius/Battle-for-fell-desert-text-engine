import {describe, expect, it} from "vitest"
import {SquaddieActionInspector,} from "./squaddieActionInspector.js"
import type {
    SquaddieActionValidity
} from "../logic/src/squaddieAction/calculate/validity/squaddieActionValidationService.js"
import type {SquaddieAction} from "../logic/src/squaddieAction/squaddieAction.js"
import {SquaddieActionService} from "../logic/src/squaddieAction/squaddieAction.js"
import {MissionEngineTestHarness} from "../logic/src/testUtils/mission/missionEngineTestHarness.js"
import {DegreeOfSuccess} from "../logic/src/degreesOfSuccess/degreeOfSuccess.js"
import type {SerializedForecastedActionResult} from "../logic/src/squaddieAction/calculate/result/squaddieActionResultCalculator.js"
import {RollGenerator} from "../logic/src/squaddieAction/calculate/roll/rollGenerator.js"
import {MissionAffiliationTurn} from "../logic/src/mission/missionTurn.js"
import {MissionEngineTestHarnessIds} from "../logic/src/testUtils/mission/missionEngineTestHarness.js"
import {
    SquaddieConditionDecaysAt,
    SquaddieConditionService,
    SquaddieConditionSource,
    SquaddieConditionType,
} from "../logic/src/proficiency/squaddieCondition.js"

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

    describe("buildCombatActionIndex", () => {
        const emptyBattleSquaddieId = {
            inBattleSquaddieId: 0,
            outOfBattleSquaddieId: "test",
        }

        it("excludes default-move and default-end-turn from the index", () => {
            const validity: SquaddieActionValidity = {
                battleSquaddieId: emptyBattleSquaddieId,
                validActions: [
                    {
                        actionId: "default-move",
                        actionName: "Move",
                        targetCoordinates: [],
                        targetBattleSquaddieIds: [],
                    },
                    {
                        actionId: "default-end-turn",
                        actionName: "End Turn",
                        targetCoordinates: [],
                        targetBattleSquaddieIds: [],
                    },
                    {
                        actionId: "attack",
                        actionName: "Attack",
                        targetCoordinates: [],
                        targetBattleSquaddieIds: [],
                    },
                ],
                invalidActions: [],
            }

            const index = SquaddieActionInspector.buildCombatActionIndex(validity)
            expect(index).not.toContain("default-move")
            expect(index).not.toContain("default-end-turn")
            expect(index).toContain("attack")
        })

        it("assigns the same number to an action whether it is valid or invalid", () => {
            const validValidity: SquaddieActionValidity = {
                battleSquaddieId: emptyBattleSquaddieId,
                validActions: [
                    {
                        actionId: "attack",
                        actionName: "Attack",
                        targetCoordinates: [],
                        targetBattleSquaddieIds: [],
                    },
                ],
                invalidActions: [
                    {actionId: "heal", actionName: "Heal", reason: "No allies"},
                ],
            }

            const invalidValidity: SquaddieActionValidity = {
                battleSquaddieId: emptyBattleSquaddieId,
                validActions: [],
                invalidActions: [
                    {
                        actionId: "attack",
                        actionName: "Attack",
                        reason: "No enemies",
                    },
                    {actionId: "heal", actionName: "Heal", reason: "No allies"},
                ],
            }

            const validIndex =
                SquaddieActionInspector.buildCombatActionIndex(validValidity)
            const invalidIndex =
                SquaddieActionInspector.buildCombatActionIndex(invalidValidity)

            expect(validIndex).toEqual(invalidIndex)
            expect(validIndex.indexOf("attack")).toBe(
                invalidIndex.indexOf("attack")
            )
        })

        it("returns actions in alphabetical order", () => {
            const validity: SquaddieActionValidity = {
                battleSquaddieId: emptyBattleSquaddieId,
                validActions: [
                    {
                        actionId: "zebra-action",
                        actionName: "Zebra",
                        targetCoordinates: [],
                        targetBattleSquaddieIds: [],
                    },
                    {
                        actionId: "apple-action",
                        actionName: "Apple",
                        targetCoordinates: [],
                        targetBattleSquaddieIds: [],
                    },
                ],
                invalidActions: [],
            }

            const index = SquaddieActionInspector.buildCombatActionIndex(validity)
            expect(index[0]).toBe("apple-action")
            expect(index[1]).toBe("zebra-action")
        })
    })

    describe("formatSquaddieActionsWithKeys", () => {
        const emptyBattleSquaddieId = {
            inBattleSquaddieId: 0,
            outOfBattleSquaddieId: "test",
        }

        it("shows A1 and A2 for two combat actions in alphabetical order", () => {
            const healAction = SquaddieActionService.new({
                id: "heal",
                name: "Heal",
                effectOnActor: {
                    [DegreeOfSuccess.SUCCESS]: {actionPoints: {spent: 2}},
                },
            })
            const attackAction = SquaddieActionService.new({
                id: "attack",
                name: "Attack",
                effectOnActor: {
                    [DegreeOfSuccess.SUCCESS]: {actionPoints: {spent: 1}},
                },
            })

            const validity: SquaddieActionValidity = {
                battleSquaddieId: emptyBattleSquaddieId,
                validActions: [
                    {
                        actionId: "heal",
                        actionName: "Heal",
                        targetCoordinates: [],
                        targetBattleSquaddieIds: [],
                    },
                    {
                        actionId: "attack",
                        actionName: "Attack",
                        targetCoordinates: [],
                        targetBattleSquaddieIds: [],
                    },
                ],
                invalidActions: [],
            }

            const actionsById = new Map<string, SquaddieAction>()
            actionsById.set("heal", healAction)
            actionsById.set("attack", attackAction)

            const result = SquaddieActionInspector.formatSquaddieActionsWithKeys(
                validity,
                actionsById
            )

            expect(result).toContain("A1 - Attack")
            expect(result).toContain("A2 - Heal")
        })

        it("shows AE for End Turn and AM for Move", () => {
            const endTurnAction = SquaddieActionService.defaultEndTurn()
            const moveAction = SquaddieActionService.defaultMove()

            const validity: SquaddieActionValidity = {
                battleSquaddieId: emptyBattleSquaddieId,
                validActions: [
                    {
                        actionId: "default-end-turn",
                        actionName: "End Turn",
                        targetCoordinates: [],
                        targetBattleSquaddieIds: [],
                    },
                    {
                        actionId: "default-move",
                        actionName: "Move",
                        targetCoordinates: [],
                        targetBattleSquaddieIds: [],
                    },
                ],
                invalidActions: [],
            }

            const actionsById = new Map<string, SquaddieAction>()
            actionsById.set("default-end-turn", endTurnAction)
            actionsById.set("default-move", moveAction)

            const result = SquaddieActionInspector.formatSquaddieActionsWithKeys(
                validity,
                actionsById
            )
            expect(result).toContain("AE - End Turn")
            expect(result).toContain("AM - Move")
        })

        it("shows invalid actions inline with reason in brackets", () => {
            const attackAction = SquaddieActionService.new({
                id: "attack",
                name: "Attack",
                effectOnActor: {
                    [DegreeOfSuccess.SUCCESS]: {actionPoints: {spent: 1}},
                },
            })

            const validity: SquaddieActionValidity = {
                battleSquaddieId: emptyBattleSquaddieId,
                validActions: [],
                invalidActions: [
                    {
                        actionId: "attack",
                        actionName: "Attack",
                        reason: "No enemies in range",
                    },
                ],
            }

            const actionsById = new Map<string, SquaddieAction>()
            actionsById.set("attack", attackAction)

            const result = SquaddieActionInspector.formatSquaddieActionsWithKeys(
                validity,
                actionsById
            )
            expect(result).toContain("A1 - Attack")
            expect(result).toContain("[No enemies in range]")
        })

        it("uses the test harness engine to show Lini's actions with A1/A2 keys", () => {
            const engine = new MissionEngineTestHarness()
            const liniId = engine.getLiniSquaddieId()
            const validity = engine.getSquaddieActionValidity(liniId)

            const actionsById = new Map<string, SquaddieAction>()
            for (const action of [
                ...validity.validActions,
                ...validity.invalidActions,
            ]) {
                actionsById.set(
                    action.actionId,
                    engine.getActionById(action.actionId)
                )
            }

            const result = SquaddieActionInspector.formatSquaddieActionsWithKeys(
                validity,
                actionsById
            )

            expect(result).toContain(`A1 - Blessing`)
            expect(result).toContain(`A2 - Heal`)
            expect(result).toContain(`A3 - Scimitar`)
            expect(result).toContain("AE - End Turn")
            expect(result).toContain("AM - Move")
        })
    })

    describe("formatForecast", () => {
        it("shows condition added in forecast effect description", () => {
            const engine = new MissionEngineTestHarness()
            const liniId = engine.getLiniSquaddieId()

            const forecasts: SerializedForecastedActionResult[] = [
                {
                    battleSquaddieId: liniId,
                    degreeOfSuccess: DegreeOfSuccess.SUCCESS,
                    chanceOutOf36: 36,
                    squaddieActionResults: [
                        {
                            inBattleSquaddieId: liniId.inBattleSquaddieId,
                            outOfBattleSquaddieId: liniId.outOfBattleSquaddieId,
                            conditionsAdded: [
                                SquaddieConditionService.new({
                                    type: SquaddieConditionType.ARMOR,
                                    amount: 1,
                                    duration: {
                                        duration: 2,
                                        decaysAt: SquaddieConditionDecaysAt.TURN_END,
                                    },
                                    source: SquaddieConditionSource.PHYSICAL,
                                }),
                            ],
                        },
                    ],
                },
            ]

            const result = SquaddieActionInspector.formatForecast(forecasts, "Lini")
            expect(result).toContain("gains ARMOR 1 for 2 turns")
            expect(result).not.toContain("no effect")
        })

        it("shows no modifier breakdown when modifierBreakdown is absent", () => {
            const engine = new MissionEngineTestHarness()
            const liniId = engine.getLiniSquaddieId()

            const forecasts: SerializedForecastedActionResult[] = [
                {
                    battleSquaddieId: liniId,
                    degreeOfSuccess: DegreeOfSuccess.SUCCESS,
                    chanceOutOf36: 21,
                    squaddieActionResults: [],
                },
            ]

            const result = SquaddieActionInspector.formatForecast(forecasts, "Lini")
            expect(result).not.toContain("Attack modifier")
        })

        it("engine populates modifierBreakdown and does not show modifier line when MAP is 0", () => {
            const allFours = Array<number>(40).fill(4)
            const engine = new MissionEngineTestHarness(new RollGenerator(allFours))
            const liniId = engine.getLiniSquaddieId()
            const slitherDemonId = engine.getSlitherDemonSquaddieId()

            engine.transitionToNextPhase()
            engine.transitionToNextPhase()

            engine.readyAction({
                actor: liniId,
                targets: [liniId],
                action: {
                    id: "default-move",
                    decisions: { desiredMovementDestination: { row: 2, col: 2 } },
                },
            })
            engine.useActionAndGetResults()
            engine.endSquaddieTurn(liniId)

            for (let i = 0; i < 20; i++) {
                if (
                    engine.getCurrentAffiliationTurn() ===
                    MissionAffiliationTurn.PLAYER_TURN
                )
                    break
                if (engine.getReadiedAction() != undefined) {
                    engine.useActionAndGetResults()
                } else {
                    engine.transitionToNextPhase()
                }
            }

            engine.readyAction({
                actor: liniId,
                targets: [slitherDemonId],
                action: { id: MissionEngineTestHarnessIds.lini.scimitarActionId },
            })

            const forecasts = engine.previewReadiedActionAndForecastResults()
            expect(forecasts.some((f) => f.modifierBreakdown != undefined)).toBe(true)

            const result = SquaddieActionInspector.formatForecast(forecasts, "Slither Demon")
            expect(result).not.toContain("Attack modifier:")
        })

        it("formatter shows MAP -3 when multipleAttackPenalty is 3", () => {
            const engine = new MissionEngineTestHarness()
            const liniId = engine.getLiniSquaddieId()

            const forecasts: SerializedForecastedActionResult[] = [
                {
                    battleSquaddieId: liniId,
                    degreeOfSuccess: DegreeOfSuccess.SUCCESS,
                    chanceOutOf36: 15,
                    squaddieActionResults: [],
                    modifierBreakdown: {
                        actorProficiencyBonus: 3,
                        targetDefensiveBonus: 1,
                        multipleAttackPenalty: 3,
                        netModifier: -1,
                    },
                },
            ]

            const result = SquaddieActionInspector.formatForecast(forecasts, "Slither Demon")
            expect(result).toContain("MAP -3")
            expect(result).toContain("Attack modifier:")
        })

        it("formatter shows MAP -6 when multipleAttackPenalty is 6", () => {
            const engine = new MissionEngineTestHarness()
            const liniId = engine.getLiniSquaddieId()

            const forecasts: SerializedForecastedActionResult[] = [
                {
                    battleSquaddieId: liniId,
                    degreeOfSuccess: DegreeOfSuccess.SUCCESS,
                    chanceOutOf36: 10,
                    squaddieActionResults: [],
                    modifierBreakdown: {
                        actorProficiencyBonus: 3,
                        targetDefensiveBonus: 1,
                        multipleAttackPenalty: 6,
                        netModifier: -4,
                    },
                },
            ]

            const result = SquaddieActionInspector.formatForecast(forecasts, "Slither Demon")
            expect(result).toContain("MAP -6")
            expect(result).toContain("Attack modifier:")
        })
    })
})
