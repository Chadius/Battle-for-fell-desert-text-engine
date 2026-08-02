import { describe, it, expect } from "vitest"
import { GlossaryInspector } from "./glossaryInspector.js"
import { createLineActionMission } from "./testUtils/simpleTestMission.js"
import { glossaryManagerWith } from "./testUtils/glossaryFixture.js"
import { GlossaryManager } from "../logic/src/campaign/glossary/glossaryManager.js"
import {
    SquaddieConditionService,
    SquaddieConditionSource,
    SquaddieConditionType,
} from "../logic/src/proficiency/squaddieCondition.js"
import type { SquaddieActionValidity } from "../logic/src/squaddieAction/calculate/validity/squaddieActionValidationService.js"

describe("GlossaryInspector", () => {
    describe("conditionTermIds", () => {
        it("maps each condition to a condition.<TYPE> termId", () => {
            const conditions = [
                SquaddieConditionService.new({
                    type: SquaddieConditionType.ARMOR,
                    source: SquaddieConditionSource.UNKNOWN,
                    duration: undefined,
                    amount: undefined,
                }),
                SquaddieConditionService.new({
                    type: SquaddieConditionType.HUSTLE,
                    source: SquaddieConditionSource.UNKNOWN,
                    duration: undefined,
                    amount: undefined,
                }),
            ]
            expect(GlossaryInspector.conditionTermIds(conditions)).toEqual([
                "condition.ARMOR",
                "condition.HUSTLE",
            ])
        })

        it("returns an empty array when there are no conditions", () => {
            expect(GlossaryInspector.conditionTermIds([])).toEqual([])
        })
    })

    describe("actionTermIds", () => {
        it("collects glossaryTermIds from both valid and invalid actions", () => {
            const validity: SquaddieActionValidity = {
                battleSquaddieId: { inBattleSquaddieId: 0, outOfBattleSquaddieId: "lini" },
                validActions: [
                    {
                        actionId: "scimitar",
                        actionName: "Scimitar",
                        reachableCoordinates: [],
                        aimCoordinateResults: [],
                        glossaryTermIds: ["actionRange.MELEE"],
                    },
                ],
                invalidActions: [
                    {
                        actionId: "heal",
                        actionName: "Heal",
                        reason: "Not enough AP",
                        glossaryTermIds: ["proficiencyType.SKILL_SOUL"],
                    },
                ],
            }
            expect(GlossaryInspector.actionTermIds(validity)).toEqual([
                "actionRange.MELEE",
                "proficiencyType.SKILL_SOUL",
            ])
        })

        it("returns an empty array when no action carries glossaryTermIds", () => {
            const validity: SquaddieActionValidity = {
                battleSquaddieId: { inBattleSquaddieId: 0, outOfBattleSquaddieId: "lini" },
                validActions: [
                    {
                        actionId: "scimitar",
                        actionName: "Scimitar",
                        reachableCoordinates: [],
                        aimCoordinateResults: [],
                    },
                ],
                invalidActions: [],
            }
            expect(GlossaryInspector.actionTermIds(validity)).toEqual([])
        })
    })

    describe("itemTermIds", () => {
        it("collects glossaryTermIds from every consumable item", () => {
            const consumableItems = new Map([
                [
                    "healing-potion",
                    { numberOfUses: 1, glossaryTermIds: ["item.HEALING_POTION"] },
                ],
                ["throwing-knife", { numberOfUses: 3, glossaryTermIds: undefined }],
            ])
            expect(GlossaryInspector.itemTermIds(consumableItems)).toEqual([
                "item.HEALING_POTION",
            ])
        })

        it("returns an empty array when there are no consumable items", () => {
            expect(GlossaryInspector.itemTermIds(new Map())).toEqual([])
        })
    })

    describe("reachableTermIds", () => {
        it("includes condition.HUSTLE for Vale, who starts with a permanent Hustle condition", () => {
            const { engine, actorId } = createLineActionMission()

            const termIds = GlossaryInspector.reachableTermIds(engine, actorId)
            expect(termIds).toContain("condition.HUSTLE")
        })

        it("deduplicates termIds shared by multiple actions or conditions", () => {
            const { engine, actorId } = createLineActionMission()

            const termIds = GlossaryInspector.reachableTermIds(engine, actorId)
            expect(new Set(termIds).size).toBe(termIds.length)
        })
    })

    describe("termIdsListingText", () => {
        it("returns a resolved line per termId in en-us", () => {
            const glossaryManager = glossaryManagerWith([
                {
                    termId: "condition.ARMOR",
                    type: "SQUADDIE_CONDITION_TYPE",
                    name: "Armor",
                    definition: "Reduces the chance you get hit.",
                },
            ])

            const message = GlossaryInspector.termIdsListingText(glossaryManager, [
                "condition.ARMOR",
            ])
            expect(message).toBe(
                "Glossary:\n  Armor - Reduces the chance you get hit."
            )
        })

        it("skips termIds the glossary has no entry for", () => {
            const glossaryManager = glossaryManagerWith([])
            const message = GlossaryInspector.termIdsListingText(glossaryManager, [
                "condition.ARMOR",
            ])
            expect(message).toBe("No glossary terms apply here.")
        })

        it("returns the no-terms message for an empty termId list", () => {
            const glossaryManager = glossaryManagerWith([])
            const message = GlossaryInspector.termIdsListingText(glossaryManager, [])
            expect(message).toBe("No glossary terms apply here.")
        })
    })

    describe("allTermsListingText", () => {
        it("lists every term the glossary knows about, sorted by termId", () => {
            const glossaryManager = glossaryManagerWith([
                {
                    termId: "condition.HUSTLE",
                    type: "SQUADDIE_CONDITION_TYPE",
                    name: "Hustle",
                    definition: "Reduces movement costs to a minimum of 1.",
                },
                {
                    termId: "condition.ARMOR",
                    type: "SQUADDIE_CONDITION_TYPE",
                    name: "Armor",
                    definition: "Reduces the chance you get hit.",
                },
            ])

            const message = GlossaryInspector.allTermsListingText(glossaryManager)
            const armorIndex = message.indexOf("Armor")
            const hustleIndex = message.indexOf("Hustle")
            expect(armorIndex).toBeGreaterThan(-1)
            expect(hustleIndex).toBeGreaterThan(-1)
            expect(armorIndex).toBeLessThan(hustleIndex)
        })

        it("returns the no-terms message when the glossary is empty", () => {
            const glossaryManager = glossaryManagerWith([])
            expect(GlossaryInspector.allTermsListingText(glossaryManager)).toBe(
                "No glossary terms apply here."
            )
        })

        it("returns the no-terms message when the manager has no collection", () => {
            const glossaryManager = new GlossaryManager()
            expect(GlossaryInspector.allTermsListingText(glossaryManager)).toBe(
                "No glossary terms apply here."
            )
        })
    })
})
