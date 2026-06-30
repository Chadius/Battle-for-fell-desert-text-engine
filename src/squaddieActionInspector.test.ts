import {describe, expect, it} from "vitest"
import {SquaddieActionInspector,} from "./squaddieActionInspector.js"
import type {
    SquaddieActionValidity
} from "../logic/src/squaddieAction/calculate/validity/squaddieActionValidationService.js"
import {DegreeOfSuccess} from "../logic/src/degreesOfSuccess/degreeOfSuccess.js"
import type {SerializedForecastedActionResult} from "../logic/src/squaddieAction/calculate/result/squaddieActionResultCalculator.js"
import {RollGenerator} from "../logic/src/squaddieAction/calculate/roll/rollGenerator.js"
import {MissionAffiliationTurn} from "../logic/src/mission/missionTurn.js"
import { createSimplePlayerVsEnemyMission, SimpleTestMissionIds } from "./testUtils/simpleTestMission.js"
import { combatActionIndex } from "./actionKeyIndex.js"
import {
    SquaddieConditionDecaysAt,
    SquaddieConditionService,
    SquaddieConditionSource,
    SquaddieConditionType,
} from "../logic/src/proficiency/squaddieCondition.js"
import {
    CoordinateMovePathMoveType,
    CoordinateMovePathService,
} from "../logic/src/coordinateMap/path/path.js"
import type { MissionEngine } from "../logic/src/mission/missionEngine/missionEngine.js"

const emptyBattleSquaddieId = {
    inBattleSquaddieId: 0,
    outOfBattleSquaddieId: "test",
}

describe("squaddieActionInspector", () => {

    describe("actionCostSuffix", () => {
        it("returns AP cost suffix for numeric cost", () => {
            expect(SquaddieActionInspector.actionCostSuffix(1)).toBe(" (1 AP)")
        })

        it("returns all AP suffix for 'all' cost", () => {
            expect(SquaddieActionInspector.actionCostSuffix("all")).toBe(" (all AP)")
        })

        it("returns empty string for cost 0", () => {
            expect(SquaddieActionInspector.actionCostSuffix(0)).toBe("")
        })

        it("returns empty string for undefined cost", () => {
            expect(SquaddieActionInspector.actionCostSuffix(undefined)).toBe("")
        })

        it("appends cooldown turns after AP cost", () => {
            expect(SquaddieActionInspector.actionCostSuffix(1, 2)).toBe(" (1 AP, 2-turn cooldown)")
        })

        it("formats a single cooldown turn as '1-turn cooldown'", () => {
            expect(SquaddieActionInspector.actionCostSuffix(1, 1)).toBe(" (1 AP, 1-turn cooldown)")
        })

        it("shows only cooldown when AP cost is 0", () => {
            expect(SquaddieActionInspector.actionCostSuffix(0, 2)).toBe(" (2-turn cooldown)")
        })

        it("when an action has an AP cost and a use limit, both appear in the suffix", () => {
            expect(SquaddieActionInspector.actionCostSuffix(1, undefined, 2)).toBe(" (1 AP, 2x/turn)")
        })

        it("shows usesPerTurn of 1 as '1x/turn'", () => {
            expect(SquaddieActionInspector.actionCostSuffix(1, undefined, 1)).toBe(" (1 AP, 1x/turn)")
        })

        it("shows all three parts together when AP cost, cooldown, and usesPerTurn are set", () => {
            expect(SquaddieActionInspector.actionCostSuffix(1, 2, 3)).toBe(" (1 AP, 2-turn cooldown, 3x/turn)")
        })

        it("shows only usesPerTurn when AP cost is 0", () => {
            expect(SquaddieActionInspector.actionCostSuffix(0, undefined, 1)).toBe(" (1x/turn)")
        })
    })

    describe("formatSquaddieActions", () => {
        it("returns empty string when both lists are empty", () => {
            const validity: SquaddieActionValidity = {
                battleSquaddieId: emptyBattleSquaddieId,
                invalidActions: [],
                validActions: [],
            }
            expect(SquaddieActionInspector.squaddieActionsText(validity)).toBe("")
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
            const result = SquaddieActionInspector.squaddieActionsText(validity)
            expect(result).toContain("Actions:")
            expect(result).toContain("  Invalid:")
            expect(result).toContain("    Sword - No applicable targets in range")
            expect(result).not.toContain("  Valid:")
        })

        it("shows valid actions with AP costs", () => {
            const validity: SquaddieActionValidity = {
                battleSquaddieId: emptyBattleSquaddieId,
                invalidActions: [],
                validActions: [
                    {
                        actionId: "heal",
                        actionName: "Heal",
                        apCost: 1,
                        reachableCoordinates: [],
                        aimCoordinateResults: [],
                    },
                ],
            }

            const result = SquaddieActionInspector.squaddieActionsText(validity)
            expect(result).toContain("Actions:")
            expect(result).toContain("  Valid:")
            expect(result).toContain("    Heal (1 AP)")
            expect(result).not.toContain("  Invalid:")
        })

        it("shows End Turn with all AP suffix", () => {
            const validity: SquaddieActionValidity = {
                battleSquaddieId: emptyBattleSquaddieId,
                invalidActions: [],
                validActions: [
                    {
                        actionId: "default-end-turn",
                        actionName: "End Turn",
                        apCost: "all",
                        reachableCoordinates: [],
                        aimCoordinateResults: [],
                    },
                ],
            }

            const result = SquaddieActionInspector.squaddieActionsText(validity)
            expect(result).toContain("    End Turn (all AP)")
        })

        it("shows Move without AP cost suffix", () => {
            const validity: SquaddieActionValidity = {
                battleSquaddieId: emptyBattleSquaddieId,
                invalidActions: [],
                validActions: [
                    {
                        actionId: "default-move",
                        actionName: "Move",
                        reachableCoordinates: [],
                        aimCoordinateResults: [],
                    },
                ],
            }

            const result = SquaddieActionInspector.squaddieActionsText(validity)
            expect(result).toContain("    Move")
            expect(result).not.toContain("    Move (")
        })

        it("shows both invalid and valid sections", () => {
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
                        apCost: "all",
                        reachableCoordinates: [],
                        aimCoordinateResults: [],
                    },
                ],
            }

            const result = SquaddieActionInspector.squaddieActionsText(validity)
            expect(result).toContain("  Invalid:")
            expect(result).toContain("  Valid:")

            const invalidIndex = result.indexOf("  Invalid:")
            const validIndex = result.indexOf("  Valid:")
            expect(invalidIndex).toBeLessThan(validIndex)
        })

        it("shows cooldown turns alongside AP cost for valid actions with cooldown", () => {
            const validity: SquaddieActionValidity = {
                battleSquaddieId: emptyBattleSquaddieId,
                validActions: [{
                    actionId: "attack",
                    actionName: "Attack",
                    apCost: 1,
                    cooldownTurns: 2,
                    reachableCoordinates: [],
                    aimCoordinateResults: [],
                }],
                invalidActions: [],
            }

            const result = SquaddieActionInspector.squaddieActionsText(validity)
            expect(result).toContain("    Attack (1 AP, 2-turn cooldown)")
        })

        it("shows usesPerTurn alongside AP cost for valid limited-use actions", () => {
            const validity = validityWithValidAction({ actionName: "Blast", apCost: 1, usesPerTurn: 2 })

            const result = SquaddieActionInspector.squaddieActionsText(validity)
            expect(result).toContain("    Blast (1 AP, 2x/turn)")
        })

        it("shows the invalid reason for an action that has exceeded its use limit", () => {
            const validity = validityWithInvalidAction({
                actionName: "Blast",
                apCost: 1,
                usesPerTurn: 1,
                reason: "Already used 1 of 1 time this turn",
            })

            const result = SquaddieActionInspector.squaddieActionsText(validity)
            expect(result).toContain("    Blast - Already used 1 of 1 time this turn")
        })

        it("shows Limited Blast with its use limit in Lini's action list at the start of her turn", () => {
            const { engine, playerSquaddieId: liniId } = createSimplePlayerVsEnemyMission()
            const validity = engine.getSquaddieActionValidity(liniId)

            const result = SquaddieActionInspector.squaddieActionsText(validity)
            expect(result).toContain("Limited Blast (1 AP, 1x/turn)")
        })

        it("shows Move and End Turn in Lini's action list at the start of her turn", () => {
            const { engine, playerSquaddieId: liniSquaddieId } = createSimplePlayerVsEnemyMission()
            const validity = engine.getSquaddieActionValidity(liniSquaddieId)

            const result = SquaddieActionInspector.squaddieActionsText(validity)
            expect(result).toContain("Actions:")
            expect(result).toContain("End Turn (all AP)")
            expect(result).toContain("Move")
        })
    })

    describe("combatActionIndex", () => {
        it("excludes default-move and default-end-turn from the index", () => {
            const validity: SquaddieActionValidity = {
                battleSquaddieId: emptyBattleSquaddieId,
                validActions: [
                    {
                        actionId: "default-move",
                        actionName: "Move",
                        reachableCoordinates: [],
                        aimCoordinateResults: [],
                    },
                    {
                        actionId: "default-end-turn",
                        actionName: "End Turn",
                        reachableCoordinates: [],
                        aimCoordinateResults: [],
                    },
                    {
                        actionId: "attack",
                        actionName: "Attack",
                        reachableCoordinates: [],
                        aimCoordinateResults: [],
                    },
                ],
                invalidActions: [],
            }

            const index = combatActionIndex(validity)
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
                        reachableCoordinates: [],
                        aimCoordinateResults: [],
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
                combatActionIndex(validValidity)
            const invalidIndex =
                combatActionIndex(invalidValidity)

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
                        reachableCoordinates: [],
                        aimCoordinateResults: [],
                    },
                    {
                        actionId: "apple-action",
                        actionName: "Apple",
                        reachableCoordinates: [],
                        aimCoordinateResults: [],
                    },
                ],
                invalidActions: [],
            }

            const index = combatActionIndex(validity)
            expect(index.indexOf("apple-action")).toBeLessThan(index.indexOf("zebra-action"))
        })
    })

    describe("formatSquaddieActionsWithKeys", () => {
        it("shows A1 and A2 for two combat actions in alphabetical order", () => {
            const validity: SquaddieActionValidity = {
                battleSquaddieId: emptyBattleSquaddieId,
                validActions: [
                    {
                        actionId: "heal",
                        actionName: "Heal",
                        apCost: 2,
                        reachableCoordinates: [],
                        aimCoordinateResults: [],
                    },
                    {
                        actionId: "attack",
                        actionName: "Attack",
                        apCost: 1,
                        reachableCoordinates: [],
                        aimCoordinateResults: [],
                    },
                ],
                invalidActions: [],
            }

            const result = SquaddieActionInspector.squaddieActionsWithKeysText(validity)

            expect(result).toContain("A1 - Attack")
            expect(result).toContain("A2 - Heal")
        })

        it("shows AE for End Turn and AM for Move", () => {
            const validity: SquaddieActionValidity = {
                battleSquaddieId: emptyBattleSquaddieId,
                validActions: [
                    {
                        actionId: "default-end-turn",
                        actionName: "End Turn",
                        apCost: "all",
                        reachableCoordinates: [],
                        aimCoordinateResults: [],
                    },
                    {
                        actionId: "default-move",
                        actionName: "Move",
                        reachableCoordinates: [],
                        aimCoordinateResults: [],
                    },
                ],
                invalidActions: [],
            }

            const result = SquaddieActionInspector.squaddieActionsWithKeysText(validity)
            expect(result).toContain("AE - End Turn")
            expect(result).toContain("AM - Move")
        })

        it("shows invalid actions inline with reason in brackets", () => {
            const validity: SquaddieActionValidity = {
                battleSquaddieId: emptyBattleSquaddieId,
                validActions: [],
                invalidActions: [
                    {
                        actionId: "attack",
                        actionName: "Attack",
                        apCost: 1,
                        reason: "No enemies in range",
                    },
                ],
            }

            const result = SquaddieActionInspector.squaddieActionsWithKeysText(validity)
            expect(result).toContain("A1 - Attack")
            expect(result).toContain("[No enemies in range]")
        })

        it("shows cooldown turns alongside AP cost in the keyed action list", () => {
            const validity: SquaddieActionValidity = {
                battleSquaddieId: emptyBattleSquaddieId,
                validActions: [{
                    actionId: "attack",
                    actionName: "Attack",
                    apCost: 1,
                    cooldownTurns: 2,
                    reachableCoordinates: [],
                    aimCoordinateResults: [],
                }],
                invalidActions: [],
            }

            const result = SquaddieActionInspector.squaddieActionsWithKeysText(validity)
            expect(result).toContain("A1 - Attack (1 AP, 2-turn cooldown)")
        })

        it("shows cooldown cost and invalid reason when action is on cooldown", () => {
            const validity: SquaddieActionValidity = {
                battleSquaddieId: emptyBattleSquaddieId,
                validActions: [],
                invalidActions: [{
                    actionId: "attack",
                    actionName: "Attack",
                    apCost: 1,
                    cooldownTurns: 2,
                    reason: "Cannot be used for 1 turn",
                }],
            }

            const result = SquaddieActionInspector.squaddieActionsWithKeysText(validity)
            expect(result).toContain("A1 - Attack (1 AP, 2-turn cooldown)")
            expect(result).toContain("[Cannot be used for 1 turn]")
        })

        it("shows usesPerTurn alongside AP cost in the keyed action list for limited-use actions", () => {
            const validity = validityWithValidAction({ actionName: "Blast", apCost: 1, usesPerTurn: 2 })

            const result = SquaddieActionInspector.squaddieActionsWithKeysText(validity)
            expect(result).toContain("A1 - Blast (1 AP, 2x/turn)")
        })

        it("shows usesPerTurn and invalid reason when action exceeds its use limit", () => {
            const validity = validityWithInvalidAction({
                actionName: "Blast",
                apCost: 1,
                usesPerTurn: 1,
                reason: "Already used 1 of 1 time this turn",
            })

            const result = SquaddieActionInspector.squaddieActionsWithKeysText(validity)
            expect(result).toContain("A1 - Blast (1 AP, 1x/turn)")
            expect(result).toContain("[Already used 1 of 1 time this turn]")
        })

        it("labels Lini's five combat actions A1-A5 and assigns AE and AM to End Turn and Move", () => {
            const { engine, playerSquaddieId: liniId } = createSimplePlayerVsEnemyMission()
            const validity = engine.getSquaddieActionValidity(liniId)

            const result = SquaddieActionInspector.squaddieActionsWithKeysText(validity)

            expect(result).toContain(`A1 - Blessing`)
            expect(result).toContain(`A2 - Heal`)
            expect(result).toContain(`A3 - Limited Blast`)
            expect(result).toContain(`A4 - Scimitar`)
            expect(result).toContain(`A5 - Solar Sphere`)
            expect(result).toContain("AE - End Turn")
            expect(result).toContain("AM - Move")
        })
    })

    describe("formatForecast", () => {
        it("shows condition added in forecast effect description", () => {
            const { playerSquaddieId: liniId } = createSimplePlayerVsEnemyMission()

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
                                    amount: { amount: 1 },
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

            const result = SquaddieActionInspector.forecastText(forecasts, "Lini")
            expect(result).toContain("gains ARMOR 1 for 2 turns")
            expect(result).not.toContain("no effect")
        })

        it("shows no modifier breakdown when modifierBreakdown is absent", () => {
            const { playerSquaddieId: liniId } = createSimplePlayerVsEnemyMission()

            const forecasts: SerializedForecastedActionResult[] = [
                {
                    battleSquaddieId: liniId,
                    degreeOfSuccess: DegreeOfSuccess.SUCCESS,
                    chanceOutOf36: 21,
                    squaddieActionResults: [],
                },
            ]

            const result = SquaddieActionInspector.forecastText(forecasts, "Lini")
            expect(result).not.toContain("Attack modifier")
        })

        it("engine populates modifierBreakdown and does not show modifier line when MAP is 0", () => {
            const allFours = Array<number>(40).fill(4)
            const { engine, playerSquaddieId: liniId, enemySquaddieId: slitherDemonId } = createSimplePlayerVsEnemyMission(new RollGenerator(allFours))

            engine.transitionToNextPhase()
            engine.transitionToNextPhase()

            engine.readyAction({
                actor: liniId,
                targets: [liniId],
                action: {
                    id: "default-move",
                    decisions: { targetDestination: { row: 2, col: 2 } },
                },
            })
            engine.useActionAndGetResults()
            engine.endSquaddieTurn(liniId)

            drainNonPlayerTurns(engine)

            engine.readyAction({
                actor: liniId,
                targets: [slitherDemonId],
                action: { id: SimpleTestMissionIds.player.meleeActionId },
            })

            const forecasts = engine.previewReadiedActionAndForecastResults()
            expect(forecasts.some((f) => f.modifierBreakdown != undefined)).toBe(true)

            const result = SquaddieActionInspector.forecastText(forecasts, "Slither Demon")
            expect(result).not.toContain("Attack modifier:")
        })

        it("formatter shows MAP -3 when multipleAttackPenalty is 3", () => {
            const { playerSquaddieId: liniId } = createSimplePlayerVsEnemyMission()

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

            const result = SquaddieActionInspector.forecastText(forecasts, "Slither Demon")
            expect(result).toContain("MAP -3")
            expect(result).toContain("Attack modifier:")
        })

        it("formatter shows MAP -6 when multipleAttackPenalty is 6", () => {
            const { playerSquaddieId: liniId } = createSimplePlayerVsEnemyMission()

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

            const result = SquaddieActionInspector.forecastText(forecasts, "Slither Demon")
            expect(result).toContain("MAP -6")
            expect(result).toContain("Attack modifier:")
        })

        it("shows actor frightened penalty in modifier breakdown", () => {
            const { playerSquaddieId: liniId } = createSimplePlayerVsEnemyMission()

            const forecasts: SerializedForecastedActionResult[] = [
                {
                    battleSquaddieId: liniId,
                    degreeOfSuccess: DegreeOfSuccess.SUCCESS,
                    chanceOutOf36: 15,
                    squaddieActionResults: [],
                    modifierBreakdown: {
                        actorProficiencyBonus: 3,
                        targetDefensiveBonus: 1,
                        multipleAttackPenalty: 0,
                        netModifier: 0,
                        actorFrightenedPenalty: 2,
                    },
                },
            ]

            const result = SquaddieActionInspector.forecastText(forecasts, "Slither Demon")
            expect(result).toContain("actor frightened -2")
            expect(result).toContain("Attack modifier:")
        })

        it("shows target frightened penalty in modifier breakdown", () => {
            const { playerSquaddieId: liniId } = createSimplePlayerVsEnemyMission()

            const forecasts: SerializedForecastedActionResult[] = [
                {
                    battleSquaddieId: liniId,
                    degreeOfSuccess: DegreeOfSuccess.SUCCESS,
                    chanceOutOf36: 21,
                    squaddieActionResults: [],
                    modifierBreakdown: {
                        actorProficiencyBonus: 3,
                        targetDefensiveBonus: 1,
                        multipleAttackPenalty: 0,
                        netModifier: 1,
                        targetFrightenedPenalty: 1,
                    },
                },
            ]

            const result = SquaddieActionInspector.forecastText(forecasts, "Slither Demon")
            expect(result).toContain("target frightened +1")
            expect(result).toContain("Attack modifier:")
        })

        it("shows tiles pulled toward actor for forced movement outcomes", () => {
            const { playerSquaddieId: liniId } = createSimplePlayerVsEnemyMission()

            // 2 steps walked after the start = pulled 2 tiles
            const forecasts: SerializedForecastedActionResult[] = [
                {
                    battleSquaddieId: liniId,
                    degreeOfSuccess: DegreeOfSuccess.FAILURE,
                    chanceOutOf36: 15,
                    squaddieActionResults: [
                        {
                            inBattleSquaddieId: liniId.inBattleSquaddieId,
                            outOfBattleSquaddieId: liniId.outOfBattleSquaddieId,
                            movement: {
                                expectedPath: CoordinateMovePathService.new({
                                    steps: [
                                        { row: 4, col: 4, moveType: CoordinateMovePathMoveType.START, moveCost: 0 },
                                        { row: 4, col: 3, moveType: CoordinateMovePathMoveType.WALK, moveCost: 1 },
                                        { row: 4, col: 2, moveType: CoordinateMovePathMoveType.WALK, moveCost: 1 },
                                    ],
                                }),
                            },
                        },
                    ],
                },
            ]

            const result = SquaddieActionInspector.forecastText(forecasts, "Slither Demon")
            expect(result).toContain("pulled 2 tiles toward actor")
            expect(result).not.toContain("no effect")
        })

        it("shows teleport destination for teleport outcomes", () => {
            const { playerSquaddieId: liniId } = createSimplePlayerVsEnemyMission()

            const forecasts: SerializedForecastedActionResult[] = [
                {
                    battleSquaddieId: liniId,
                    degreeOfSuccess: DegreeOfSuccess.SUCCESS,
                    chanceOutOf36: 36,
                    squaddieActionResults: [
                        {
                            inBattleSquaddieId: liniId.inBattleSquaddieId,
                            outOfBattleSquaddieId: liniId.outOfBattleSquaddieId,
                            movement: {
                                expectedPath: CoordinateMovePathService.new({
                                    steps: [
                                        { row: 4, col: 1, moveType: CoordinateMovePathMoveType.START, moveCost: 0 },
                                    ],
                                }),
                            },
                        },
                    ],
                },
            ]

            const result = SquaddieActionInspector.forecastText(forecasts, "Fracta")
            expect(result).toContain("teleported to (4, 1)")
            expect(result).not.toContain("pulled")
            expect(result).not.toContain("no effect")
        })
    })
})

function validityWithValidAction(opts: {
    actionName: string
    apCost: number
    usesPerTurn?: number
}): SquaddieActionValidity {
    return {
        battleSquaddieId: emptyBattleSquaddieId,
        validActions: [{
            actionId: opts.actionName.toLowerCase(),
            actionName: opts.actionName,
            apCost: opts.apCost,
            usesPerTurn: opts.usesPerTurn,
            reachableCoordinates: [],
            aimCoordinateResults: [],
        }],
        invalidActions: [],
    }
}

function validityWithInvalidAction(opts: {
    actionName: string
    apCost: number
    usesPerTurn?: number
    reason: string
}): SquaddieActionValidity {
    return {
        battleSquaddieId: emptyBattleSquaddieId,
        validActions: [],
        invalidActions: [{
            actionId: opts.actionName.toLowerCase(),
            actionName: opts.actionName,
            apCost: opts.apCost,
            usesPerTurn: opts.usesPerTurn,
            reason: opts.reason,
        }],
    }
}

function drainNonPlayerTurns(engine: MissionEngine) {
    const maxIterations = 100
    for (let i = 0; i < maxIterations; i++) {
        if (engine.getCurrentAffiliationTurn() === MissionAffiliationTurn.PLAYER_TURN) return
        if (engine.getReadiedAction() != undefined) {
            engine.useActionAndGetResults()
        } else {
            engine.transitionToNextPhase()
        }
    }
    throw new Error("[drainNonPlayerTurns] PLAYER_TURN was not reached within the iteration limit")
}
