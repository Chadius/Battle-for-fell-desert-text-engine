import { describe, it, expect } from "vitest"
import {
    conditionTypeName,
    formatCondition,
    formatSquaddieDetails,
} from "./squaddieDetailInspector.js"
import {
    SquaddieConditionDecaysAt,
    SquaddieConditionService,
    SquaddieConditionSource,
    SquaddieConditionType,
} from "../logic/src/proficiency/squaddieCondition.js"
import type { SquaddieCondition } from "../logic/src/proficiency/squaddieCondition.js"

describe("squaddieDetailInspector", () => {
    describe("conditionTypeName", () => {
        it("maps UNKNOWN to Unknown", () => {
            expect(conditionTypeName(SquaddieConditionType.UNKNOWN)).toBe("Unknown")
        })

        it("maps ABSORB to Absorb", () => {
            expect(conditionTypeName(SquaddieConditionType.ABSORB)).toBe("Absorb")
        })

        it("maps ARMOR to Armor", () => {
            expect(conditionTypeName(SquaddieConditionType.ARMOR)).toBe("Armor")
        })

        it("maps ELUSIVE to Elusive", () => {
            expect(conditionTypeName(SquaddieConditionType.ELUSIVE)).toBe("Elusive")
        })

        it("maps SLOWED to Slowed", () => {
            expect(conditionTypeName(SquaddieConditionType.SLOWED)).toBe("Slowed")
        })

        it("maps HUSTLE to Hustle", () => {
            expect(conditionTypeName(SquaddieConditionType.HUSTLE)).toBe("Hustle")
        })

        it("maps FRIGHTENED to Frightened", () => {
            expect(conditionTypeName(SquaddieConditionType.FRIGHTENED)).toBe("Frightened")
        })
    })

    describe("formatCondition", () => {
        it("formats a numerical condition with amount and duration", () => {
            const condition = SquaddieConditionService.new({
                type: SquaddieConditionType.ARMOR,
                amount: { amount: 3 },
                duration: { duration: 2, decaysAt: SquaddieConditionDecaysAt.TURN_END },
                source: SquaddieConditionSource.UNKNOWN,
            })
            expect(formatCondition(condition)).toBe("Armor: 3 (2 turns remaining)")
        })

        it("formats a numerical condition with amount but no duration", () => {
            const condition = SquaddieConditionService.new({
                type: SquaddieConditionType.SLOWED,
                amount: { amount: 1 },
                duration: undefined,
                source: SquaddieConditionSource.UNKNOWN,
            })
            expect(formatCondition(condition)).toBe("Slowed: 1")
        })

        it("formats a binary condition with duration", () => {
            const condition = SquaddieConditionService.new({
                type: SquaddieConditionType.ELUSIVE,
                amount: undefined,
                duration: { duration: 2, decaysAt: SquaddieConditionDecaysAt.TURN_END },
                source: SquaddieConditionSource.UNKNOWN,
            })
            expect(formatCondition(condition)).toBe("Elusive (2 turns remaining)")
        })

        it("formats a binary condition without duration", () => {
            const condition = SquaddieConditionService.new({
                type: SquaddieConditionType.HUSTLE,
                amount: undefined,
                duration: undefined,
                source: SquaddieConditionSource.UNKNOWN,
            })
            expect(formatCondition(condition)).toBe("Hustle")
        })

        it("formats ABSORB with amount and duration", () => {
            const condition = SquaddieConditionService.new({
                type: SquaddieConditionType.ABSORB,
                amount: { amount: 5 },
                duration: { duration: 3, decaysAt: SquaddieConditionDecaysAt.TURN_END },
                source: SquaddieConditionSource.UNKNOWN,
            })
            expect(formatCondition(condition)).toBe("Absorb: 5 (3 turns remaining)")
        })

        it("formats FRIGHTENED with amount and duration", () => {
            const condition = SquaddieConditionService.new({
                type: SquaddieConditionType.FRIGHTENED,
                amount: { amount: 1 },
                duration: { duration: 1, decaysAt: SquaddieConditionDecaysAt.TURN_END },
                source: SquaddieConditionSource.SPIRITUAL,
            })
            expect(formatCondition(condition)).toBe("Frightened: 1 (1 turns remaining)")
        })
    })

    describe("formatSquaddieDetails", () => {
        it("returns an empty string when there are no conditions", () => {
            const conditions: SquaddieCondition[] = []
            expect(formatSquaddieDetails(conditions)).toBe("")
        })

        it("shows conditions section with a single condition", () => {
            const conditions: SquaddieCondition[] = [
                SquaddieConditionService.new({
                    type: SquaddieConditionType.ARMOR,
                    amount: { amount: 2 },
                    duration: { duration: 3, decaysAt: SquaddieConditionDecaysAt.TURN_END },
                    source: SquaddieConditionSource.UNKNOWN,
                }),
            ]
            const result = formatSquaddieDetails(conditions)
            expect(result).toBe("Conditions:\n  Armor: 2 (3 turns remaining)")
        })

        it("shows conditions section with multiple conditions", () => {
            const conditions: SquaddieCondition[] = [
                SquaddieConditionService.new({
                    type: SquaddieConditionType.ARMOR,
                    amount: { amount: 2 },
                    duration: { duration: 3, decaysAt: SquaddieConditionDecaysAt.TURN_END },
                    source: SquaddieConditionSource.UNKNOWN,
                }),
                SquaddieConditionService.new({
                    type: SquaddieConditionType.ELUSIVE,
                    amount: undefined,
                    duration: undefined,
                    source: SquaddieConditionSource.UNKNOWN,
                }),
                SquaddieConditionService.new({
                    type: SquaddieConditionType.SLOWED,
                    amount: { amount: 1 },
                    duration: undefined,
                    source: SquaddieConditionSource.UNKNOWN,
                }),
            ]
            const result = formatSquaddieDetails(conditions)
            expect(result).toBe(
                "Conditions:\n  Armor: 2 (3 turns remaining)\n  Elusive\n  Slowed: 1"
            )
        })
    })
})
