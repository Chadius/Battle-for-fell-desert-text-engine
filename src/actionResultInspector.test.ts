import { describe, it, expect } from "vitest"
import { ActionResultInspector } from "./actionResultInspector.js"
import type { ActionResult } from "../logic/src/mission/actionResult.js"
import { MissionEngineTestHarness } from "../logic/src/testUtils/mission/missionEngineTestHarness.js"
import { DegreeOfSuccess } from "../logic/src/degreesOfSuccess/degreeOfSuccess.js"
import {
    SquaddieConditionDecaysAt,
    SquaddieConditionService, SquaddieConditionSource,
    SquaddieConditionType,
} from "../logic/src/proficiency/squaddieCondition.js"

describe("ActionResultInspector", () => {
    describe("formatActionResults", () => {
        it("shows degree of success for a target result", () => {
            const engine = new MissionEngineTestHarness()
            const liniId = engine.getLiniSquaddieId()

            const actionResult: ActionResult = {
                targetResults: {
                    "lini-key": {
                        degreeOfSuccess: DegreeOfSuccess.SUCCESS,
                        squaddieActionResults: [
                            {
                                inBattleSquaddieId: liniId.inBattleSquaddieId,
                                outOfBattleSquaddieId:
                                    liniId.outOfBattleSquaddieId,
                                healing: { net: 2, raw: 2 },
                            },
                        ],
                    },
                },
            }

            const result = ActionResultInspector.formatActionResults(
                actionResult,
                engine
            )
            expect(result).toContain("Result: Success")
        })

        it("shows actor roll when present", () => {
            const engine = new MissionEngineTestHarness()
            const slitherDemonId = engine.getSlitherDemonSquaddieId()

            const actionResult: ActionResult = {
                actorRoll: [3, 4],
                targetResults: {
                    "slither-key": {
                        degreeOfSuccess: DegreeOfSuccess.SUCCESS,
                        squaddieActionResults: [
                            {
                                inBattleSquaddieId:
                                    slitherDemonId.inBattleSquaddieId,
                                outOfBattleSquaddieId:
                                    slitherDemonId.outOfBattleSquaddieId,
                                damage: {
                                    net: 2,
                                    raw: 2,
                                    absorbed: 0,
                                    willKo: false,
                                    type: undefined,
                                },
                            },
                        ],
                    },
                },
            }

            const result = ActionResultInspector.formatActionResults(
                actionResult,
                engine
            )
            expect(result).toContain("Roll: [3, 4]")
        })

        it("shows damage with net amount without absorbed if 0", () => {
            const engine = new MissionEngineTestHarness()
            const slitherDemonId = engine.getSlitherDemonSquaddieId()

            const actionResult: ActionResult = {
                targetResults: {
                    "slither-key": {
                        degreeOfSuccess: DegreeOfSuccess.SUCCESS,
                        squaddieActionResults: [
                            {
                                inBattleSquaddieId:
                                    slitherDemonId.inBattleSquaddieId,
                                outOfBattleSquaddieId:
                                    slitherDemonId.outOfBattleSquaddieId,
                                damage: {
                                    net: 2,
                                    raw: 2,
                                    absorbed: 0,
                                    willKo: false,
                                    type: undefined,
                                },
                            },
                        ],
                    },
                },
            }

            const result = ActionResultInspector.formatActionResults(
                actionResult,
                engine
            )
            expect(result).toContain("takes 2 damage")
            expect(result).not.toContain("absorbed 0")
        })

        it("shows damage with net and absorbed amount", () => {
            const engine = new MissionEngineTestHarness()
            const slitherDemonId = engine.getSlitherDemonSquaddieId()

            const actionResult: ActionResult = {
                targetResults: {
                    "slither-key": {
                        degreeOfSuccess: DegreeOfSuccess.SUCCESS,
                        squaddieActionResults: [
                            {
                                inBattleSquaddieId:
                                    slitherDemonId.inBattleSquaddieId,
                                outOfBattleSquaddieId:
                                    slitherDemonId.outOfBattleSquaddieId,
                                damage: {
                                    net: 2,
                                    raw: 2,
                                    absorbed: 3,
                                    willKo: false,
                                    type: undefined,
                                },
                            },
                        ],
                    },
                },
            }

            const result = ActionResultInspector.formatActionResults(
                actionResult,
                engine
            )
            expect(result).toContain("takes 2 damage")
            expect(result).toContain("absorbed 3")
        })

        it("shows KO message when willKo is true", () => {
            const engine = new MissionEngineTestHarness()
            const slitherDemonId = engine.getSlitherDemonSquaddieId()

            const actionResult: ActionResult = {
                targetResults: {
                    "slither-key": {
                        degreeOfSuccess: DegreeOfSuccess.SUCCESS,
                        squaddieActionResults: [
                            {
                                inBattleSquaddieId:
                                    slitherDemonId.inBattleSquaddieId,
                                outOfBattleSquaddieId:
                                    slitherDemonId.outOfBattleSquaddieId,
                                damage: {
                                    net: 2,
                                    raw: 2,
                                    absorbed: 0,
                                    willKo: true,
                                    type: undefined,
                                },
                            },
                        ],
                    },
                },
            }

            const result = ActionResultInspector.formatActionResults(
                actionResult,
                engine
            )
            expect(result).toContain("knocked out")
        })

        it("shows healing with net HP restored", () => {
            const engine = new MissionEngineTestHarness()
            const liniId = engine.getLiniSquaddieId()

            const actionResult: ActionResult = {
                targetResults: {
                    "lini-key": {
                        degreeOfSuccess: DegreeOfSuccess.SUCCESS,
                        squaddieActionResults: [
                            {
                                inBattleSquaddieId: liniId.inBattleSquaddieId,
                                outOfBattleSquaddieId:
                                    liniId.outOfBattleSquaddieId,
                                healing: { net: 2, raw: 2 },
                            },
                        ],
                    },
                },
            }

            const result = ActionResultInspector.formatActionResults(
                actionResult,
                engine
            )
            expect(result).toContain("heals 2 HP")
        })

        it("shows conditions added to a target", () => {
            const engine = new MissionEngineTestHarness()
            const slitherDemonId = engine.getSlitherDemonSquaddieId()

            const actionResult: ActionResult = {
                targetResults: {
                    "slither-key": {
                        degreeOfSuccess: DegreeOfSuccess.SUCCESS,
                        squaddieActionResults: [
                            {
                                inBattleSquaddieId:
                                    slitherDemonId.inBattleSquaddieId,
                                outOfBattleSquaddieId:
                                    slitherDemonId.outOfBattleSquaddieId,
                                conditionsAdded: [
                                    SquaddieConditionService.new({
                                        type: SquaddieConditionType.SLOWED,
                                        duration: {
                                            duration: 1,
                                            decaysAt: SquaddieConditionDecaysAt.TURN_START,
                                        },
                                        amount: 1,
                                        source: SquaddieConditionSource.PHYSICAL,
                                    }),
                                ],
                            },
                        ],
                    },
                },
            }

            const result = ActionResultInspector.formatActionResults(
                actionResult,
                engine
            )
            expect(result).toContain(`gains ${SquaddieConditionType.SLOWED} 1 for 1 turn`)
        })

        it("skips results that only contain action point spending", () => {
            const engine = new MissionEngineTestHarness()
            const liniId = engine.getLiniSquaddieId()

            const actionResult: ActionResult = {
                targetResults: {
                    "lini-key": {
                        degreeOfSuccess: DegreeOfSuccess.SUCCESS,
                        squaddieActionResults: [
                            {
                                inBattleSquaddieId: liniId.inBattleSquaddieId,
                                outOfBattleSquaddieId:
                                    liniId.outOfBattleSquaddieId,
                                actionPoints: { spent: 1 },
                            },
                        ],
                    },
                },
            }

            const result = ActionResultInspector.formatActionResults(
                actionResult,
                engine
            )

            expect(result).toContain("Result: Success")
            expect(result).not.toContain("Lini takes")
            expect(result).not.toContain("Lini heals")
        })

        it("includes squaddie name in damage line", () => {
            const engine = new MissionEngineTestHarness()
            const slitherDemonId = engine.getSlitherDemonSquaddieId()

            const actionResult: ActionResult = {
                targetResults: {
                    "slither-key": {
                        degreeOfSuccess: DegreeOfSuccess.SUCCESS,
                        squaddieActionResults: [
                            {
                                inBattleSquaddieId:
                                    slitherDemonId.inBattleSquaddieId,
                                outOfBattleSquaddieId:
                                    slitherDemonId.outOfBattleSquaddieId,
                                damage: {
                                    net: 1,
                                    raw: 1,
                                    absorbed: 0,
                                    willKo: false,
                                    type: undefined,
                                },
                            },
                        ],
                    },
                },
            }

            const result = ActionResultInspector.formatActionResults(
                actionResult,
                engine
            )

            const info = engine.getSquaddieInfo(slitherDemonId)
            expect(result).toContain(info.name)
        })
    })
})
