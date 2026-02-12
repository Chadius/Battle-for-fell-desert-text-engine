import { describe, it, expect } from "vitest"
import {
    conditionTypeName,
    formatCondition,
    formatSquaddieDetails,
} from "./squaddieDetailInspector.js"
import { SquaddieConditionService, SquaddieConditionType } from "../logic/src/proficiency/squaddieCondition.js"
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
    })

    describe("formatCondition", () => {
        it("formats a numerical condition with amount and duration", () => {
            const condition = SquaddieConditionService.new({
                type: SquaddieConditionType.ARMOR,
                amount: 3,
                duration: 2,
            })
            expect(formatCondition(condition)).toBe("Armor: 3 (2 turns remaining)")
        })

        it("formats a numerical condition with amount but no duration", () => {
            const condition = SquaddieConditionService.new({
                type: SquaddieConditionType.SLOWED,
                amount: 1,
                duration: undefined,
            })
            expect(formatCondition(condition)).toBe("Slowed: 1")
        })

        it("formats a binary condition with duration", () => {
            const condition = SquaddieConditionService.new({
                type: SquaddieConditionType.ELUSIVE,
                amount: undefined,
                duration: 2,
            })
            expect(formatCondition(condition)).toBe("Elusive (2 turns remaining)")
        })

        it("formats a binary condition without duration", () => {
            const condition = SquaddieConditionService.new({
                type: SquaddieConditionType.HUSTLE,
                amount: undefined,
                duration: undefined,
            })
            expect(formatCondition(condition)).toBe("Hustle")
        })

        it("formats ABSORB with amount and duration", () => {
            const condition = SquaddieConditionService.new({
                type: SquaddieConditionType.ABSORB,
                amount: 5,
                duration: 3,
            })
            expect(formatCondition(condition)).toBe("Absorb: 5 (3 turns remaining)")
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
                    amount: 2,
                    duration: 3,
                }),
            ]
            const result = formatSquaddieDetails(conditions)
            expect(result).toBe("Conditions:\n  Armor: 2 (3 turns remaining)")
        })

        it("shows conditions section with multiple conditions", () => {
            const conditions: SquaddieCondition[] = [
                SquaddieConditionService.new({
                    type: SquaddieConditionType.ARMOR,
                    amount: 2,
                    duration: 3,
                }),
                SquaddieConditionService.new({
                    type: SquaddieConditionType.ELUSIVE,
                    amount: undefined,
                    duration: undefined,
                }),
                SquaddieConditionService.new({
                    type: SquaddieConditionType.SLOWED,
                    amount: 1,
                    duration: undefined,
                }),
            ]
            const result = formatSquaddieDetails(conditions)
            expect(result).toBe(
                "Conditions:\n  Armor: 2 (3 turns remaining)\n  Elusive\n  Slowed: 1"
            )
        })
    })
})
