import type { MissionEngine } from "../logic/src/mission/missionEngine/missionEngine.js"
import type { MissionObjective } from "../logic/src/mission/missionObjective.js"
import { MissionObjectiveRewardType } from "../logic/src/mission/missionObjectiveReward.js"
import { MissionObjectiveCriteriaType } from "../logic/src/mission/missionObjectiveCriteria.js"
import type {
    AllSquaddiesDefeatedCriteria,
    SpecificSquaddiesInjuredCriteria,
    SpecificSquaddiesDefeatedCriteria,
} from "../logic/src/mission/missionObjectiveCriteria.js"
import {
    SquaddieAffiliation,
    type TSquaddieAffiliation,
} from "../logic/src/affiliation/affiliation.js"

export interface MissionObjectiveDisplayEntry {
    description: string
    isCompleted: boolean
    isFailureCondition: boolean
}

const affiliationDisplayNames: Record<TSquaddieAffiliation, string> = {
    [SquaddieAffiliation.ENEMY]: "enemy",
    [SquaddieAffiliation.PLAYER]: "players",
    [SquaddieAffiliation.ALLY]: "allies",
    [SquaddieAffiliation.NONE]: "neutrals",
}

export const isFailureObjective = (objective: MissionObjective): boolean => {
    return objective.rewards.some(
        (reward) => reward.type === MissionObjectiveRewardType.MISSION_FAILURE
    )
}

export const isObjectiveVisible = (
    objective: MissionObjective,
    revealHiddenMissionObjectives: boolean
): boolean => {
    return revealHiddenMissionObjectives || objective.hidden !== true
}

const findSquaddieNamesByAffiliation = (
    engine: MissionEngine,
    affiliations: Set<TSquaddieAffiliation>
): string[] => {
    const overview = engine.getMapOverview()
    const matchingNames: string[] = []

    for (const row of overview.tiles) {
        for (const tile of row) {
            if (tile.squaddieId != undefined) {
                const info = engine.getSquaddieInfo(tile.squaddieId)
                if (affiliations.has(info.affiliation)) {
                    matchingNames.push(
                        tile.squaddieId.outOfBattleSquaddieId
                    )
                }
            }
        }
    }

    return matchingNames
}

const buildCriteriaDescription = (
    engine: MissionEngine,
    criteria: AllSquaddiesDefeatedCriteria
): string => {
    if (criteria.affiliations != undefined && criteria.affiliations.size > 0) {
        const firstAffiliation = [...criteria.affiliations][0]
        const displayName = affiliationDisplayNames[firstAffiliation]
        const squaddieNames = findSquaddieNamesByAffiliation(
            engine,
            criteria.affiliations
        )
        return `Defeat ${displayName}: ${squaddieNames.join(", ")}`
    }

    if (
        criteria.outOfBattleSquaddieIds != undefined &&
        criteria.outOfBattleSquaddieIds.size > 0
    ) {
        const names = [...criteria.outOfBattleSquaddieIds]
        return `Defeat: ${names.join(", ")}`
    }

    return "Defeat squaddies"
}

const injuredCriteriaDescription = (
    criteria: SpecificSquaddiesInjuredCriteria
): string => {
    const ids = [...(criteria.outOfBattleSquaddieIds ?? [])]
    return ids.length > 0 ? `Injure: ${ids.join(", ")}` : "Injure a squaddie"
}

const specificDefeatedCriteriaDescription = (
    criteria: SpecificSquaddiesDefeatedCriteria
): string => {
    const ids = [...(criteria.outOfBattleSquaddieIds ?? [])]
    return ids.length > 0 ? `Defeat specific: ${ids.join(", ")}` : "Defeat a specific squaddie"
}

const objectiveToEntry = (
    engine: MissionEngine,
    objective: MissionObjective,
    isCompleted: boolean
): MissionObjectiveDisplayEntry => {
    const descriptions: string[] = []

    for (const criterion of objective.criteria) {
        if (criterion.type === MissionObjectiveCriteriaType.ALL_SQUADDIES_DEFEATED) {
            descriptions.push(buildCriteriaDescription(engine, criterion))
        }
        if (criterion.type === MissionObjectiveCriteriaType.SPECIFIC_SQUADDIES_INJURED) {
            descriptions.push(injuredCriteriaDescription(criterion))
        }
        if (criterion.type === MissionObjectiveCriteriaType.SPECIFIC_SQUADDIES_DEFEATED) {
            descriptions.push(specificDefeatedCriteriaDescription(criterion))
        }
    }

    return {
        description: descriptions.join("; "),
        isCompleted,
        isFailureCondition: isFailureObjective(objective),
    }
}

const gatherEntries = (
    engine: MissionEngine
): MissionObjectiveDisplayEntry[] => {
    const entries: MissionObjectiveDisplayEntry[] = []
    const revealHiddenMissionObjectives =
        engine.getDebugFlags()?.revealHiddenMissionObjectives === true

    const inProgress = engine
        .getInProgressMissionObjectives()
        .filter((objective) =>
            isObjectiveVisible(objective, revealHiddenMissionObjectives)
        )
    for (const objective of inProgress) {
        entries.push(objectiveToEntry(engine, objective, false))
    }

    const completedNotRewarded = engine
        .getCompletedButNotRewardedMissionObjectives()
        .filter((objective) =>
            isObjectiveVisible(objective, revealHiddenMissionObjectives)
        )
    for (const objective of completedNotRewarded) {
        entries.push(objectiveToEntry(engine, objective, true))
    }

    const completedAndRewarded = engine
        .getCompletedAndRewardedMissionObjectives()
        .filter((objective) =>
            isObjectiveVisible(objective, revealHiddenMissionObjectives)
        )
    for (const objective of completedAndRewarded) {
        entries.push(objectiveToEntry(engine, objective, true))
    }

    return entries
}

const sortEntries = (
    entries: MissionObjectiveDisplayEntry[]
): MissionObjectiveDisplayEntry[] => {
    return [...entries].sort((a, b) => {
        if (a.isCompleted && !b.isCompleted) return -1
        if (!a.isCompleted && b.isCompleted) return 1
        return 0
    })
}

const formatEntryLine = (entry: MissionObjectiveDisplayEntry): string => {
    const doneMarker = entry.isCompleted ? " [DONE]" : ""
    return `- ${entry.description}${doneMarker}`
}

const formatEntries = (
    entries: MissionObjectiveDisplayEntry[]
): string => {
    if (entries.length === 0) return ""

    const objectives = entries.filter((e) => !e.isFailureCondition)
    const failures = entries.filter((e) => e.isFailureCondition)

    const lines: string[] = []

    if (objectives.length > 0) {
        lines.push("Objective:")
        const sorted = sortEntries(objectives)
        for (const entry of sorted) {
            lines.push(formatEntryLine(entry))
        }
    }

    if (failures.length > 0) {
        lines.push("Failure:")
        const sorted = sortEntries(failures)
        for (const entry of sorted) {
            lines.push(formatEntryLine(entry))
        }
    }

    return lines.join("\n")
}

export const MissionObjectiveInspector = {
    gatherEntries: (engine: MissionEngine) => gatherEntries(engine),
    formatEntries: (entries: MissionObjectiveDisplayEntry[]) =>
        formatEntries(entries),
}
