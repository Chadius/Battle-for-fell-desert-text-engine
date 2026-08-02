import type { MissionEngine } from "../logic/src/mission/missionEngine/missionEngine.js"
import type { BattleSquaddieId } from "../logic/src/squaddie/inBattle/battleSquaddieId.js"
import type { SquaddieCondition } from "../logic/src/proficiency/squaddieCondition.js"
import type { SquaddieActionValidity } from "../logic/src/squaddieAction/calculate/validity/squaddieActionValidationService.js"
import type {
    GlossaryManager,
    ResolvedGlossaryTerm,
} from "../logic/src/campaign/glossary/glossaryManager.js"
import {
    GlossaryTermType,
    GlossaryTermTypeService,
} from "../logic/src/campaign/glossary/glossaryTermType.js"

const LANGUAGE_CODE = "en-us"

// Every active condition maps to a termId by convention: condition.<TYPE>.
const conditionTermIds = (conditions: SquaddieCondition[]): string[] =>
    conditions.map((condition) =>
        GlossaryTermTypeService.termIdFor(
            GlossaryTermType.SQUADDIE_CONDITION_TYPE,
            condition.type
        )
    )

// Actions carry author-attached glossaryTermIds directly; gather them from both valid and
// invalid actions so an unavailable action's jargon is still explained to the player.
const actionTermIds = (validity: SquaddieActionValidity): string[] =>
    [...validity.validActions, ...validity.invalidActions].flatMap(
        (action) => action.glossaryTermIds ?? []
    )

// Consumable items carry author-attached glossaryTermIds directly, same as actions.
const itemTermIds = (
    consumableItems: Map<string, { numberOfUses: number; glossaryTermIds?: string[] }>
): string[] =>
    Array.from(consumableItems.values()).flatMap((item) => item.glossaryTermIds ?? [])

// Collects every glossary termId reachable from what the player currently sees for a squaddie.
const reachableTermIds = (
    engine: MissionEngine,
    squaddieId: BattleSquaddieId
): string[] => {
    const squaddieInfo = engine.getSquaddieInfo(squaddieId)
    const validity = engine.getSquaddieActionValidity(squaddieId)
    const consumableItems = engine.getConsumableItems(squaddieId)

    return Array.from(
        new Set([
            ...conditionTermIds(squaddieInfo.conditions),
            ...actionTermIds(validity),
            ...itemTermIds(consumableItems),
        ])
    )
}

const termIdsListingText = (
    glossaryManager: GlossaryManager,
    termIds: string[]
): string => {
    const lines = termIds
        .map((termId) => glossaryManager.resolveTerm(termId, LANGUAGE_CODE))
        .filter((resolved): resolved is ResolvedGlossaryTerm => resolved != undefined)
        .map((resolved) => `  ${resolved.name} - ${resolved.definition}`)

    if (lines.length === 0) {
        return "No glossary terms apply here."
    }

    return ["Glossary:", ...lines].join("\n")
}

// Lists every term the glossary knows about, for browsing when no squaddie is selected.
const allTermsListingText = (glossaryManager: GlossaryManager): string => {
    const termIds =
        glossaryManager.collection == undefined
            ? []
            : glossaryManager.termIds().sort()
    return termIdsListingText(glossaryManager, termIds)
}

export const GlossaryInspector = {
    conditionTermIds: (conditions: SquaddieCondition[]) =>
        conditionTermIds(conditions),
    actionTermIds: (validity: SquaddieActionValidity) => actionTermIds(validity),
    itemTermIds: (
        consumableItems: Map<string, { numberOfUses: number; glossaryTermIds?: string[] }>
    ) => itemTermIds(consumableItems),
    reachableTermIds: (engine: MissionEngine, squaddieId: BattleSquaddieId) =>
        reachableTermIds(engine, squaddieId),
    termIdsListingText: (glossaryManager: GlossaryManager, termIds: string[]) =>
        termIdsListingText(glossaryManager, termIds),
    allTermsListingText: (glossaryManager: GlossaryManager) =>
        allTermsListingText(glossaryManager),
}
