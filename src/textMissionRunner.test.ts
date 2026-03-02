import { describe, it, expect } from "vitest"
import { TextMissionRunner } from "./textMissionRunner.js"
import { MissionEngineTestHarness } from "../logic/src/testUtils/mission/missionEngineTestHarness.js"
import {
    SquaddieConditionDecaysAt,
    SquaddieConditionService,
    SquaddieConditionType,
} from "../logic/src/proficiency/squaddieCondition.js"

describe("TextMissionRunner", () => {
    describe("getWelcomeText", () => {
        it("returns a string containing the game title", () => {
            const engine = new MissionEngineTestHarness()
            const runner = new TextMissionRunner(engine)
            expect(runner.getWelcomeText()).toContain("Battle of Fell Desert CLI")
        })

        it("includes objective text when the engine has objectives", () => {
            const engine = new MissionEngineTestHarness()
            const runner = new TextMissionRunner(engine)
            expect(runner.getWelcomeText()).toContain("Objective:")
        })
    })

    describe("processInput", () => {
        it("returns shouldQuit true with goodbye text for Q", () => {
            const engine = new MissionEngineTestHarness()
            const runner = new TextMissionRunner(engine)
            const result = runner.processInput("Q")
            expect(result.shouldQuit).toBe(true)
            expect(result.text).toBe("Goodbye!")
        })

        it("returns shouldQuit false with map text for M", () => {
            const engine = new MissionEngineTestHarness()
            const runner = new TextMissionRunner(engine)
            const result = runner.processInput("M")
            expect(result.shouldQuit).toBe(false)
            expect(result.text).toContain("Map:")
        })

        it("updates internal context when a coordinate with a squaddie is inspected, allowing L to show details", () => {
            const engine = new MissionEngineTestHarness()
            const runner = new TextMissionRunner(engine)

            runner.processInput("0, 0")

            const lookResult = runner.processInput("L")
            expect(lookResult.shouldQuit).toBe(false)
            expect(lookResult.text).toContain("Lini")
        })
    })

    describe("AM movement integration", () => {
        it("shows AP cost digits on movement map after AM command", () => {
            const engine = new MissionEngineTestHarness()
            const runner = new TextMissionRunner(engine)

            runner.processInput("0, 0")
            const result = runner.processInput("AM")
            expect(result.text).toMatch(/[123]/)
        })

        it("shows moves to message and route map after entering a valid destination", () => {
            const engine = new MissionEngineTestHarness()
            const runner = new TextMissionRunner(engine)

            runner.processInput("0, 0")
            runner.processInput("AM")
            const result = runner.processInput("0, 1")
            expect(result.text).toContain("moves to")
        })
    })

    describe("condition expiration messages", () => {
        it("announces when a TURN_END condition expires after ending the squaddie turn", () => {
            const engine = new MissionEngineTestHarness()
            const runner = new TextMissionRunner(engine)

            const liniId = engine.getLiniSquaddieId()
            engine.missionManager!.inBattleSquaddieManager!.addConditionsToSquaddie(
                {
                    ...liniId,
                    conditions: [
                        SquaddieConditionService.new({
                            type: SquaddieConditionType.ARMOR,
                            amount: 2,
                            duration: {
                                duration: 1,
                                decaysAt: SquaddieConditionDecaysAt.TURN_END,
                            },
                        }),
                    ],
                }
            )

            runner.processInput("0, 0")
            const result = runner.processInput("AE")

            expect(result.text).toContain("Lini")
            expect(result.text).toContain("Armor")
            expect(result.text).toContain("expired")
        })
    })

    describe("phase announcements", () => {
        describe("getWelcomeText", () => {
            it("contains the turn start announcement for the initial turn", () => {
                const engine = new MissionEngineTestHarness()
                const runner = new TextMissionRunner(engine)
                expect(runner.getWelcomeText()).toContain("Turn 0 start")
            })

            it("contains the player turn announcement after advancing through startup phases", () => {
                const engine = new MissionEngineTestHarness()
                const runner = new TextMissionRunner(engine)
                expect(runner.getWelcomeText()).toContain("Player Turn")
            })
        })

        describe("processInput", () => {
            it("announces enemy turn after Lini ends her turn", () => {
                const engine = new MissionEngineTestHarness()
                const runner = new TextMissionRunner(engine)

                runner.processInput("0, 0")
                const result = runner.processInput("AE")

                expect(result.text).toContain("Enemy Turn")
            })
        })
    })
})
