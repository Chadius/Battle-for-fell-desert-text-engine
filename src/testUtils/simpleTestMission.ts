import { MissionEngine } from "../../logic/src/mission/missionEngine/missionEngine.js"
import { MissionManager } from "../../logic/src/mission/missionManager.js"
import { MissionStateService } from "../../logic/src/mission/missionState.js"
import { CoordinateMapCollectionManager } from "../../logic/src/coordinateMap/coordinateMapManager.js"
import { CoordinateMapCollectionService } from "../../logic/src/coordinateMap/coordinateMapCollection.js"
import { CoordinateMapService } from "../../logic/src/coordinateMap/coordinateMap.js"
import type { BattleSquaddieId } from "../../logic/src/squaddie/inBattle/battleSquaddieId.js"
import { InBattleSquaddieManager } from "../../logic/src/squaddie/inBattle/inBattleSquaddieManager.js"
import { InBattleSquaddieCollectionService } from "../../logic/src/squaddie/inBattle/inBattleSquaddieCollection.js"
import { OutOfBattleSquaddieManager } from "../../logic/src/squaddie/outOfBattle/outOfBattleSquaddieManager.js"
import { OutOfBattleSquaddieCollectionService } from "../../logic/src/squaddie/outOfBattle/outOfBattleSquaddieCollection.js"
import { OutOfBattleSquaddieAttributeSheetCollectionService } from "../../logic/src/squaddie/outOfBattle/outOfBattleSquaddieAttributeSheetCollection.js"
import { OutOfBattleSquaddieAttributeSheetService } from "../../logic/src/squaddie/outOfBattle/outOfBattleSquaddieAttributeSheet.js"
import { OutOfBattleSquaddieService } from "../../logic/src/squaddie/outOfBattle/outOfBattleSquaddie.js"
import { SquaddieActionManager } from "../../logic/src/squaddieAction/squaddieActionManager.js"
import { SquaddieActionCollectionService } from "../../logic/src/squaddieAction/squaddieActionCollection.js"
import { HowToDetermineDegreeOfSuccess, SquaddieActionService } from "../../logic/src/squaddieAction/squaddieAction.js"
import type { SquaddieAction } from "../../logic/src/squaddieAction/squaddieAction.js"
import { SquaddieAffiliation } from "../../logic/src/affiliation/affiliation.js"
import { AttributeScore } from "../../logic/src/proficiency/attributeScore.js"
import { ProficiencyLevel, ProficiencyType } from "../../logic/src/proficiency/proficiencyLevel.js"
import { ActionRange } from "../../logic/src/squaddieAction/actionRange.js"
import { DegreeOfSuccess } from "../../logic/src/degreesOfSuccess/degreeOfSuccess.js"
import { CoordinateGeneratorShape } from "../../logic/src/coordinateMap/shape.js"
import type { MissionObjective } from "../../logic/src/mission/missionObjective.js"
import { MissionObjectiveService } from "../../logic/src/mission/missionObjective.js"
import { MissionObjectiveRewardService } from "../../logic/src/mission/missionObjectiveReward.js"
import { MissionObjectiveCriteriaService } from "../../logic/src/mission/missionObjectiveCriteria.js"
import {
    SquaddieConditionDecaysAt,
    SquaddieConditionService,
    SquaddieConditionSource,
    SquaddieConditionType,
} from "../../logic/src/proficiency/squaddieCondition.js"
import type { RollGenerator } from "../../logic/src/squaddieAction/calculate/roll/rollGenerator.js"

// IDs used by both mission builders and test files. Action IDs intentionally
// match the logic harness IDs so tests that hardcode them (e.g. "lini-heal"
// in a CommandContext) continue to work.
export const SimpleTestMissionIds = {
    simpleMapId: "cli-simple-mission-map",
    lineMapId: "cli-line-action-map",
    player: {
        outOfBattleSquaddieId: "lini",
        attributeSheetId: "lini-attribute-sheet",
        meleeActionId: "lini-scimitar",
        blessingActionId: "lini-blessing",
        healActionId: "lini-heal",
        solarSphereActionId: "lini-solar-sphere",
        limitedBlastActionId: "lini-limited-blast",
    },
    enemy: {
        outOfBattleSquaddieId: "slither-demon",
        attributeSheetId: "slither-demon-attribute-sheet",
        meleeActionId: "slither-demon-claw",
    },
    lineActor: {
        outOfBattleSquaddieId: "vale",
        attributeSheetId: "vale-attribute-sheet",
        lineActionId: "vale-lightning-bolt",
        intimidatingGlareActionId: "vale-intimidating-glare",
    },
    lineFriendly: {
        outOfBattleSquaddieId: "gloria",
        attributeSheetId: "gloria-attribute-sheet",
        longswordActionId: "gloria-longsword",
        shieldActionId: "gloria-shield",
        sweepActionId: "gloria-sweep",
    },
    lineEnemy: {
        outOfBattleSquaddieId: "slither-demon-v2",
        attributeSheetId: "slither-demon-v2-attribute-sheet",
        biteActionId: "slither-demon-v2-bite",
    },
} as const

// Replicates MissionEngineTestHarness: Lini vs one Slither Demon on a 5×4 map.
export function createSimplePlayerVsEnemyMission(rollGenerator?: RollGenerator): {
    engine: MissionEngine
    playerSquaddieId: BattleSquaddieId
    enemySquaddieId: BattleSquaddieId
} {
    const coordinateMapCollectionManager = createSimpleCoordinateMapCollectionManager()
    const squaddieActionManager = createSimpleSquaddieActionManager()
    const outOfBattleSquaddieManager = createSimpleOutOfBattleSquaddieManager()
    const { inBattleSquaddieManager, playerSquaddieId, enemySquaddieId } =
        createSimpleInBattleSquaddieManager(outOfBattleSquaddieManager)

    // Place squaddies on the map before constructing the engine.
    coordinateMapCollectionManager.addSquaddie({
        mapId: SimpleTestMissionIds.simpleMapId,
        squaddieId: playerSquaddieId,
        coordinate: { row: 0, col: 0 },
    })
    coordinateMapCollectionManager.addSquaddie({
        mapId: SimpleTestMissionIds.simpleMapId,
        squaddieId: enemySquaddieId,
        coordinate: { row: 3, col: 4 },
    })

    const missionState = MissionStateService.new({
        id: "cli-simple-mission",
        mapId: SimpleTestMissionIds.simpleMapId,
        objectives: createSimpleMissionObjectives(),
    })

    const missionManager = new MissionManager({
        missionState,
        inBattleSquaddieManager,
        coordinateMapCollectionManager,
        squaddieActionManager,
    })

    const engine = new MissionEngine(missionManager, rollGenerator)
    return { engine, playerSquaddieId, enemySquaddieId }
}

// Replicates createTargetPracticeMission: Vale + Gloria vs 4 Slither Demons on a 5×10 map.
// Vale starts with HUSTLE and a LINE ranged attack. Used to test line-of-fire overlays.
export function createLineActionMission(rollGenerator?: RollGenerator): {
    engine: MissionEngine
    actorId: BattleSquaddieId
    friendlyId: BattleSquaddieId
    enemyIds: BattleSquaddieId[]
} {
    const coordinateMapCollectionManager = createLineCoordinateMapCollectionManager()
    const squaddieActionManager = createLineSquaddieActionManager()
    const outOfBattleSquaddieManager = createLineOutOfBattleSquaddieManager()
    const { inBattleSquaddieManager, actorId, friendlyId, enemyIds } =
        createLineInBattleSquaddieManager(outOfBattleSquaddieManager)

    // Place squaddies on the map before constructing the engine.
    coordinateMapCollectionManager.addSquaddie({
        mapId: SimpleTestMissionIds.lineMapId,
        squaddieId: actorId,
        coordinate: { row: 2, col: 3 },
    })
    coordinateMapCollectionManager.addSquaddie({
        mapId: SimpleTestMissionIds.lineMapId,
        squaddieId: friendlyId,
        coordinate: { row: 3, col: 0 },
    })

    const demonCoordinates = [
        { row: 2, col: 6 },
        { row: 2, col: 7 },
        { row: 2, col: 8 },
        { row: 2, col: 9 },
    ]
    for (let i = 0; i < enemyIds.length; i++) {
        coordinateMapCollectionManager.addSquaddie({
            mapId: SimpleTestMissionIds.lineMapId,
            squaddieId: enemyIds[i],
            coordinate: demonCoordinates[i],
        })
    }

    const missionState = MissionStateService.new({
        id: "cli-line-action-mission",
        mapId: SimpleTestMissionIds.lineMapId,
        objectives: createLineMissionObjectives(),
    })

    const missionManager = new MissionManager({
        missionState,
        inBattleSquaddieManager,
        coordinateMapCollectionManager,
        squaddieActionManager,
    })

    const engine = new MissionEngine(missionManager, rollGenerator)
    return { engine, actorId, friendlyId, enemyIds }
}

// --- Simple mission builders (Lini vs Slither Demon) ---

function createSimpleCoordinateMapCollectionManager(): CoordinateMapCollectionManager {
    // 5 columns × 4 rows; mirrors the MissionEngineTestHarness grid exactly.
    const movementProperties = [
        "1 1 2 1 1",
        " 1 - 1 X 1",
        "1 1 1 1 2",
        " 2 1 - 1 1",
    ]

    const coordinateMap = CoordinateMapService.new({
        id: SimpleTestMissionIds.simpleMapId,
        name: "Test Harness Map",
        movementProperties,
    })

    const manager = new CoordinateMapCollectionManager(
        CoordinateMapCollectionService.new()
    )
    manager.addOrUpdate({ map: coordinateMap })
    return manager
}

function createSimpleSquaddieActionManager(): SquaddieActionManager {
    const manager = new SquaddieActionManager(
        SquaddieActionCollectionService.new()
    )

    manager.addOrUpdate(createScimitarAction())
    manager.addOrUpdate(createBlessingAction())
    manager.addOrUpdate(createHealAction())
    manager.addOrUpdate(createSolarSphereAction())
    manager.addOrUpdate(createLimitedBlastAction())
    manager.addOrUpdate(createClawAction())
    manager.addOrUpdate(SquaddieActionService.defaultMove())
    manager.addOrUpdate(SquaddieActionService.defaultEndTurn())

    return manager
}

function createSimpleOutOfBattleSquaddieManager(): OutOfBattleSquaddieManager {
    const manager = new OutOfBattleSquaddieManager(
        OutOfBattleSquaddieCollectionService.new(),
        OutOfBattleSquaddieAttributeSheetCollectionService.new()
    )

    const liniAttributeSheet = OutOfBattleSquaddieAttributeSheetService.new({
        id: SimpleTestMissionIds.player.attributeSheetId,
        maxHitPoints: 5,
        movement: { movementPointsPerAction: 2 },
        attributeScores: {
            [AttributeScore.BODY]: 1,
            [AttributeScore.MIND]: 0,
            [AttributeScore.SOUL]: 1,
        },
        rank: 1,
    })
    manager.addOrUpdateAttributeSheet(liniAttributeSheet)

    const liniSquaddie = OutOfBattleSquaddieService.new({
        id: SimpleTestMissionIds.player.outOfBattleSquaddieId,
        name: "Lini",
        attributeSheetId: SimpleTestMissionIds.player.attributeSheetId,
        actionIds: [
            SimpleTestMissionIds.player.meleeActionId,
            SimpleTestMissionIds.player.blessingActionId,
            SimpleTestMissionIds.player.healActionId,
            SimpleTestMissionIds.player.solarSphereActionId,
            SimpleTestMissionIds.player.limitedBlastActionId,
        ],
        affiliation: SquaddieAffiliation.PLAYER,
    })
    manager.addOrUpdateSquaddie(liniSquaddie)

    const slitherDemonAttributeSheet = OutOfBattleSquaddieAttributeSheetService.new({
        id: SimpleTestMissionIds.enemy.attributeSheetId,
        maxHitPoints: 3,
        movement: { movementPointsPerAction: 2 },
        attributeScores: {
            [AttributeScore.BODY]: 0,
            [AttributeScore.MIND]: -1,
            [AttributeScore.SOUL]: -1,
        },
        rank: 0,
    })
    manager.addOrUpdateAttributeSheet(slitherDemonAttributeSheet)

    const slitherDemonSquaddie = OutOfBattleSquaddieService.new({
        id: SimpleTestMissionIds.enemy.outOfBattleSquaddieId,
        name: "Slither Demon",
        attributeSheetId: SimpleTestMissionIds.enemy.attributeSheetId,
        actionIds: [SimpleTestMissionIds.enemy.meleeActionId],
        affiliation: SquaddieAffiliation.ENEMY,
    })
    manager.addOrUpdateSquaddie(slitherDemonSquaddie)

    return manager
}

function createSimpleInBattleSquaddieManager(
    outOfBattleSquaddieManager: OutOfBattleSquaddieManager
): {
    inBattleSquaddieManager: InBattleSquaddieManager
    playerSquaddieId: BattleSquaddieId
    enemySquaddieId: BattleSquaddieId
} {
    const manager = new InBattleSquaddieManager(
        InBattleSquaddieCollectionService.new(),
        outOfBattleSquaddieManager
    )

    const playerSquaddieId = manager.createNewSquaddie({
        outOfBattleSquaddieId: SimpleTestMissionIds.player.outOfBattleSquaddieId,
    })

    const enemySquaddieId = manager.createNewSquaddie({
        outOfBattleSquaddieId: SimpleTestMissionIds.enemy.outOfBattleSquaddieId,
    })

    return { inBattleSquaddieManager: manager, playerSquaddieId, enemySquaddieId }
}

function createSimpleMissionObjectives(): MissionObjective[] {
    const defeatAllEnemies = MissionObjectiveService.new({
        id: "cli-simple-defeat-all-enemies",
        rewards: [MissionObjectiveRewardService.newMissionEndsReward()],
        criteria: [
            MissionObjectiveCriteriaService.newSquaddiesDefeatedCriteria({
                affiliations: [SquaddieAffiliation.ENEMY],
            }),
        ],
    })

    const defeatAllPlayers = MissionObjectiveService.new({
        id: "cli-simple-defeat-all-players",
        rewards: [MissionObjectiveRewardService.newMissionFailureReward()],
        criteria: [
            MissionObjectiveCriteriaService.newSquaddiesDefeatedCriteria({
                affiliations: [SquaddieAffiliation.PLAYER],
            }),
        ],
    })

    return [defeatAllEnemies, defeatAllPlayers]
}

// --- Action factories shared by the simple mission ---

function createScimitarAction(): SquaddieAction {
    return SquaddieActionService.new({
        id: SimpleTestMissionIds.player.meleeActionId,
        name: "Scimitar",
        attribute: AttributeScore.BODY,
        proficiency: ProficiencyType.WEAPON_MARTIAL,
        range: ActionRange.MELEE,
        shape: CoordinateGeneratorShape.BLOOM,
        affiliationRelationship: {
            self: false,
            foe: true,
            friend: false,
        },
        effectOnActor: {
            [DegreeOfSuccess.SUCCESS]: {
                actionPoints: { spent: 1 },
            },
        },
        effectOnTarget: {
            [DegreeOfSuccess.FAILURE]: {},
            [DegreeOfSuccess.SUCCESS]: {
                damage: {
                    raw: 2,
                    targetProficiency: ProficiencyType.ARMOR,
                },
            },
            [DegreeOfSuccess.CRITICAL]: {
                damage: {
                    raw: 4,
                    targetProficiency: ProficiencyType.ARMOR,
                },
            },
        },
    })
}

function createBlessingAction(): SquaddieAction {
    return SquaddieActionService.new({
        id: SimpleTestMissionIds.player.blessingActionId,
        name: "Blessing",
        attribute: AttributeScore.SOUL,
        proficiency: ProficiencyType.SKILL_SOUL,
        range: ActionRange.SHORT,
        shape: CoordinateGeneratorShape.BLOOM,
        affiliationRelationship: {
            self: true,
            foe: false,
            friend: true,
        },
        effectOnActor: {
            [DegreeOfSuccess.SUCCESS]: {
                actionPoints: { spent: 2 },
            },
        },
        effectOnTarget: {
            [DegreeOfSuccess.SUCCESS]: {
                conditions: {
                    add: [
                        SquaddieConditionService.new({
                            type: SquaddieConditionType.ARMOR,
                            amount: { amount: 1 },
                            duration: {
                                duration: 2,
                                decaysAt: SquaddieConditionDecaysAt.TURN_END,
                            },
                            source: SquaddieConditionSource.SPIRITUAL,
                        }),
                    ],
                },
            },
        },
    })
}

function createHealAction(): SquaddieAction {
    return SquaddieActionService.new({
        id: SimpleTestMissionIds.player.healActionId,
        name: "Heal",
        attribute: AttributeScore.SOUL,
        proficiency: ProficiencyType.SKILL_SOUL,
        range: ActionRange.MELEE,
        shape: CoordinateGeneratorShape.BLOOM,
        affiliationRelationship: {
            self: true,
            foe: false,
            friend: true,
        },
        howToDetermineDegreeOfSuccess: HowToDetermineDegreeOfSuccess.AUTOMATIC_SUCCESS,
        effectOnActor: {
            [DegreeOfSuccess.SUCCESS]: {
                actionPoints: { spent: 1 },
            },
        },
        effectOnTarget: {
            [DegreeOfSuccess.SUCCESS]: {
                healing: {
                    raw: 2,
                },
            },
        },
    })
}

function createSolarSphereAction(): SquaddieAction {
    return SquaddieActionService.new({
        id: SimpleTestMissionIds.player.solarSphereActionId,
        name: "Solar Sphere",
        attribute: AttributeScore.SOUL,
        proficiency: ProficiencyType.SKILL_SOUL,
        range: ActionRange.MEDIUM,
        shape: CoordinateGeneratorShape.BLOOM,
        areaOfEffectSize: 0,
        aimCoordinateRequiresTarget: true,
        affiliationRelationship: {
            self: false,
            foe: true,
            friend: false,
        },
        howToDetermineDegreeOfSuccess:
            HowToDetermineDegreeOfSuccess.TARGETS_ROLL_TO_RESIST,
        multipleAttackPenalty: { applies: false, contribution: 0 },
        effectOnActor: {
            [DegreeOfSuccess.SUCCESS]: {
                actionPoints: { spent: 2 },
            },
        },
        effectOnTarget: {
            [DegreeOfSuccess.CRITICAL]: {},
            [DegreeOfSuccess.SUCCESS]: {
                damage: {
                    raw: 1,
                    targetProficiency: ProficiencyType.SKILL_SOUL,
                },
            },
            [DegreeOfSuccess.FAILURE]: {
                damage: {
                    raw: 2,
                    targetProficiency: ProficiencyType.SKILL_SOUL,
                },
                conditions: {
                    add: [
                        SquaddieConditionService.new({
                            type: SquaddieConditionType.SLOWED,
                            amount: { amount: 1 },
                            duration: {
                                duration: 1,
                                decaysAt:
                                SquaddieConditionDecaysAt.TURN_END,
                            },
                            source: SquaddieConditionSource.SPIRITUAL,
                        }),
                    ],
                },
            },
            [DegreeOfSuccess.BOTCH]: {
                damage: {
                    raw: 4,
                    targetProficiency: ProficiencyType.SKILL_SOUL,
                },
                conditions: {
                    add: [
                        SquaddieConditionService.new({
                            type: SquaddieConditionType.SLOWED,
                            amount: { amount: 3 },
                            duration: {
                                duration: 1,
                                decaysAt:
                                SquaddieConditionDecaysAt.TURN_END,
                            },
                            source: SquaddieConditionSource.SPIRITUAL,
                        }),
                    ],
                },
            }
        },
    })
}

function createLimitedBlastAction(): SquaddieAction {
    return SquaddieActionService.new({
        id: SimpleTestMissionIds.player.limitedBlastActionId,
        name: "Limited Blast",
        usesPerTurn: 1,
        range: ActionRange.MELEE,
        shape: CoordinateGeneratorShape.BLOOM,
        affiliationRelationship: {
            self: true,
            foe: false,
            friend: false,
        },
        effectOnActor: {
            [DegreeOfSuccess.SUCCESS]: {
                actionPoints: { spent: 1 },
            },
        },
        effectOnTarget: {
            [DegreeOfSuccess.SUCCESS]: {
                conditions: {
                    add: [
                        SquaddieConditionService.new({
                            type: SquaddieConditionType.ARMOR,
                            amount: { amount: 1 },
                            source: SquaddieConditionSource.SPIRITUAL,
                        }),
                    ],
                },
            },
        },
    })
}

function createClawAction(): SquaddieAction {
    return SquaddieActionService.new({
        id: SimpleTestMissionIds.enemy.meleeActionId,
        name: "Claw",
        attribute: AttributeScore.BODY,
        proficiency: ProficiencyType.WEAPON_NATURAL,
        range: ActionRange.MELEE,
        shape: CoordinateGeneratorShape.BLOOM,
        affiliationRelationship: {
            self: false,
            foe: true,
            friend: false,
        },
        effectOnActor: {
            [DegreeOfSuccess.SUCCESS]: {
                actionPoints: { spent: 1 },
            },
        },
        effectOnTarget: {
            [DegreeOfSuccess.FAILURE]: {},
            [DegreeOfSuccess.SUCCESS]: {
                damage: {
                    raw: 1,
                    targetProficiency: ProficiencyType.ARMOR,
                },
            },
            [DegreeOfSuccess.CRITICAL]: {
                damage: {
                    raw: 2,
                    targetProficiency: ProficiencyType.ARMOR,
                },
            },
        },
    })
}

// --- Line action mission builders (Vale + Gloria vs 4 Slither Demons) ---

function createLineCoordinateMapCollectionManager(): CoordinateMapCollectionManager {
    // 5 rows × 10 cols; mirrors the targetPracticeMission grid exactly.
    const movementProperties = [
        "1 1 1 1 1 1 2 2 2 2",
        " 1 1 1 X X 2 2 2 2 2",
        "1 1 1 1 - 1 2 2 2 2",
        " 1 1 1 X X 2 2 2 2 2",
        "1 1 1 1 1 1 2 2 2 2",
    ]

    const coordinateMap = CoordinateMapService.new({
        id: SimpleTestMissionIds.lineMapId,
        name: "Target Practice",
        movementProperties,
    })

    const manager = new CoordinateMapCollectionManager(
        CoordinateMapCollectionService.new()
    )
    manager.addOrUpdate({ map: coordinateMap })
    return manager
}

function createLineSquaddieActionManager(): SquaddieActionManager {
    const manager = new SquaddieActionManager(
        SquaddieActionCollectionService.new()
    )

    manager.addOrUpdate(createLightningBoltAction())
    manager.addOrUpdate(createIntimidatingGlareAction())
    manager.addOrUpdate(createLongswordAction())
    manager.addOrUpdate(createShieldAction())
    manager.addOrUpdate(createSweepAction())
    manager.addOrUpdate(createDemonBiteAction())
    manager.addOrUpdate(SquaddieActionService.defaultMove())
    manager.addOrUpdate(SquaddieActionService.defaultEndTurn())

    return manager
}

function createLineOutOfBattleSquaddieManager(): OutOfBattleSquaddieManager {
    const manager = new OutOfBattleSquaddieManager(
        OutOfBattleSquaddieCollectionService.new(),
        OutOfBattleSquaddieAttributeSheetCollectionService.new()
    )

    const valeAttributeSheet = OutOfBattleSquaddieAttributeSheetService.new({
        id: SimpleTestMissionIds.lineActor.attributeSheetId,
        maxHitPoints: 4,
        movement: { movementPointsPerAction: 2, skipOverPits: true },
        attributeScores: {
            [AttributeScore.BODY]: -1,
            [AttributeScore.MIND]: 2,
            [AttributeScore.SOUL]: 1,
        },
        proficiencyLevels: {
            [ProficiencyType.SKILL_MIND]: ProficiencyLevel.EXPERT,
        },
        rank: 1,
    })
    manager.addOrUpdateAttributeSheet(valeAttributeSheet)

    const valeSquaddie = OutOfBattleSquaddieService.new({
        id: SimpleTestMissionIds.lineActor.outOfBattleSquaddieId,
        name: "Vale",
        attributeSheetId: SimpleTestMissionIds.lineActor.attributeSheetId,
        actionIds: [
            SimpleTestMissionIds.lineActor.lineActionId,
            SimpleTestMissionIds.lineActor.intimidatingGlareActionId,
        ],
        affiliation: SquaddieAffiliation.PLAYER,
    })
    manager.addOrUpdateSquaddie(valeSquaddie)

    const gloriaAttributeSheet = OutOfBattleSquaddieAttributeSheetService.new({
        id: SimpleTestMissionIds.lineFriendly.attributeSheetId,
        maxHitPoints: 6,
        movement: { movementPointsPerAction: 2 },
        attributeScores: {
            [AttributeScore.BODY]: 2,
            [AttributeScore.MIND]: -1,
            [AttributeScore.SOUL]: 1,
        },
        proficiencyLevels: {
            [ProficiencyType.WEAPON_MARTIAL]: ProficiencyLevel.EXPERT,
            [ProficiencyType.ARMOR]: ProficiencyLevel.EXPERT,
        },
        rank: 1,
    })
    manager.addOrUpdateAttributeSheet(gloriaAttributeSheet)

    const gloriaSquaddie = OutOfBattleSquaddieService.new({
        id: SimpleTestMissionIds.lineFriendly.outOfBattleSquaddieId,
        name: "Gloria",
        attributeSheetId: SimpleTestMissionIds.lineFriendly.attributeSheetId,
        actionIds: [
            SimpleTestMissionIds.lineFriendly.longswordActionId,
            SimpleTestMissionIds.lineFriendly.shieldActionId,
            SimpleTestMissionIds.lineFriendly.sweepActionId,
        ],
        affiliation: SquaddieAffiliation.PLAYER,
    })
    manager.addOrUpdateSquaddie(gloriaSquaddie)

    const demonAttributeSheet = OutOfBattleSquaddieAttributeSheetService.new({
        id: SimpleTestMissionIds.lineEnemy.attributeSheetId,
        maxHitPoints: 3,
        movement: { movementPointsPerAction: 2 },
        attributeScores: {
            [AttributeScore.BODY]: 0,
            [AttributeScore.MIND]: -1,
            [AttributeScore.SOUL]: -1,
        },
        rank: 0,
    })
    manager.addOrUpdateAttributeSheet(demonAttributeSheet)

    const demonSquaddie = OutOfBattleSquaddieService.new({
        id: SimpleTestMissionIds.lineEnemy.outOfBattleSquaddieId,
        name: "Slither Demon",
        attributeSheetId: SimpleTestMissionIds.lineEnemy.attributeSheetId,
        actionIds: [SimpleTestMissionIds.lineEnemy.biteActionId],
        affiliation: SquaddieAffiliation.ENEMY,
    })
    manager.addOrUpdateSquaddie(demonSquaddie)

    return manager
}

function createLineInBattleSquaddieManager(
    outOfBattleSquaddieManager: OutOfBattleSquaddieManager
): {
    inBattleSquaddieManager: InBattleSquaddieManager
    actorId: BattleSquaddieId
    friendlyId: BattleSquaddieId
    enemyIds: BattleSquaddieId[]
} {
    const manager = new InBattleSquaddieManager(
        InBattleSquaddieCollectionService.new(),
        outOfBattleSquaddieManager
    )

    const actorId = manager.createNewSquaddie({
        outOfBattleSquaddieId: SimpleTestMissionIds.lineActor.outOfBattleSquaddieId,
    })

    // Vale starts with permanent HUSTLE, reducing movement costs to minimum 1.
    manager.addConditionsToSquaddie({
        ...actorId,
        conditions: [
            SquaddieConditionService.new({
                type: SquaddieConditionType.HUSTLE,
                amount: undefined,
                duration: undefined,
                source: SquaddieConditionSource.ELEMENTAL,
            }),
        ],
    })

    const friendlyId = manager.createNewSquaddie({
        outOfBattleSquaddieId: SimpleTestMissionIds.lineFriendly.outOfBattleSquaddieId,
    })

    const enemyIds: BattleSquaddieId[] = []
    for (let i = 0; i < 4; i++) {
        const demonId = manager.createNewSquaddie({
            outOfBattleSquaddieId: SimpleTestMissionIds.lineEnemy.outOfBattleSquaddieId,
        })
        enemyIds.push(demonId)
    }

    return { inBattleSquaddieManager: manager, actorId, friendlyId, enemyIds }
}

function createLineMissionObjectives(): MissionObjective[] {
    const defeatAllEnemies = MissionObjectiveService.new({
        id: "cli-line-defeat-all-enemies",
        rewards: [MissionObjectiveRewardService.newMissionEndsReward()],
        criteria: [
            MissionObjectiveCriteriaService.newSquaddiesDefeatedCriteria({
                affiliations: [SquaddieAffiliation.ENEMY],
            }),
        ],
    })

    const defeatAllPlayers = MissionObjectiveService.new({
        id: "cli-line-defeat-all-players",
        rewards: [MissionObjectiveRewardService.newMissionFailureReward()],
        criteria: [
            MissionObjectiveCriteriaService.newSquaddiesDefeatedCriteria({
                affiliations: [SquaddieAffiliation.PLAYER],
            }),
        ],
    })

    return [defeatAllEnemies, defeatAllPlayers]
}

// --- Line action factories ---

function createLightningBoltAction(): SquaddieAction {
    return SquaddieActionService.new({
        id: SimpleTestMissionIds.lineActor.lineActionId,
        name: "Lightning Bolt",
        attribute: AttributeScore.MIND,
        proficiency: ProficiencyType.SKILL_MIND,
        range: ActionRange.LONG,
        shape: CoordinateGeneratorShape.LINE,
        areaOfEffectSize: 0,
        aimCoordinateRequiresTarget: true,
        affiliationRelationship: {
            self: false,
            foe: true,
            friend: false,
        },
        howToDetermineDegreeOfSuccess: HowToDetermineDegreeOfSuccess.ACTOR_ROLLS_TO_HIT,
        degreesOfSuccess: [DegreeOfSuccess.SUCCESS, DegreeOfSuccess.FAILURE],
        effectOnActor: {
            [DegreeOfSuccess.SUCCESS]: {
                actionPoints: { spent: 2 },
            },
        },
        effectOnTarget: {
            [DegreeOfSuccess.SUCCESS]: {
                damage: {
                    raw: 2,
                    targetProficiency: ProficiencyType.ARMOR,
                },
            },
            [DegreeOfSuccess.FAILURE]: {},
        },
    })
}

function createIntimidatingGlareAction(): SquaddieAction {
    return SquaddieActionService.new({
        id: SimpleTestMissionIds.lineActor.intimidatingGlareActionId,
        name: "Intimidating Glare",
        attribute: AttributeScore.MIND,
        proficiency: ProficiencyType.SKILL_MIND,
        range: ActionRange.SHORT,
        shape: CoordinateGeneratorShape.BLOOM,
        affiliationRelationship: {
            self: false,
            foe: true,
            friend: false,
        },
        howToDetermineDegreeOfSuccess: HowToDetermineDegreeOfSuccess.ACTOR_ROLLS_TO_HIT,
        effectOnActor: {
            [DegreeOfSuccess.SUCCESS]: {
                actionPoints: { spent: 1 },
            },
        },
        effectOnTarget: {
            [DegreeOfSuccess.SUCCESS]: {
                conditions: {
                    add: [
                        SquaddieConditionService.new({
                            type: SquaddieConditionType.SLOWED,
                            amount: { amount: 1 },
                            duration: {
                                duration: 1,
                                decaysAt: SquaddieConditionDecaysAt.TURN_END,
                            },
                            source: SquaddieConditionSource.SPIRITUAL,
                        }),
                    ],
                },
            },
            [DegreeOfSuccess.FAILURE]: {},
        },
    })
}

function createLongswordAction(): SquaddieAction {
    return SquaddieActionService.new({
        id: SimpleTestMissionIds.lineFriendly.longswordActionId,
        name: "Longsword",
        attribute: AttributeScore.BODY,
        proficiency: ProficiencyType.WEAPON_MARTIAL,
        range: ActionRange.MELEE,
        shape: CoordinateGeneratorShape.BLOOM,
        affiliationRelationship: {
            self: false,
            foe: true,
            friend: false,
        },
        effectOnActor: {
            [DegreeOfSuccess.SUCCESS]: {
                actionPoints: { spent: 1 },
            },
        },
        effectOnTarget: {
            [DegreeOfSuccess.FAILURE]: {},
            [DegreeOfSuccess.SUCCESS]: {
                damage: {
                    raw: 2,
                    targetProficiency: ProficiencyType.ARMOR,
                },
            },
            [DegreeOfSuccess.CRITICAL]: {
                damage: {
                    raw: 4,
                    targetProficiency: ProficiencyType.ARMOR,
                },
            },
        },
    })
}

function createShieldAction(): SquaddieAction {
    return SquaddieActionService.new({
        id: SimpleTestMissionIds.lineFriendly.shieldActionId,
        name: "Shield",
        attribute: AttributeScore.BODY,
        proficiency: ProficiencyType.SKILL_BODY,
        range: ActionRange.SELF,
        shape: CoordinateGeneratorShape.BLOOM,
        affiliationRelationship: {
            self: true,
            foe: false,
            friend: false,
        },
        howToDetermineDegreeOfSuccess: HowToDetermineDegreeOfSuccess.AUTOMATIC_SUCCESS,
        effectOnActor: {
            [DegreeOfSuccess.SUCCESS]: {
                actionPoints: { spent: 1 },
            },
        },
        effectOnTarget: {
            [DegreeOfSuccess.SUCCESS]: {
                conditions: {
                    add: [
                        SquaddieConditionService.new({
                            type: SquaddieConditionType.ARMOR,
                            amount: { amount: 1 },
                            duration: {
                                duration: 1,
                                decaysAt: SquaddieConditionDecaysAt.TURN_START,
                            },
                            source: SquaddieConditionSource.ITEM,
                        }),
                        SquaddieConditionService.new({
                            type: SquaddieConditionType.ABSORB,
                            amount: { amount: 1 },
                            duration: {
                                duration: 1,
                                decaysAt: SquaddieConditionDecaysAt.TURN_START,
                            },
                            source: SquaddieConditionSource.ITEM,
                        }),
                    ],
                },
            },
        },
    })
}

function createSweepAction(): SquaddieAction {
    return SquaddieActionService.new({
        id: SimpleTestMissionIds.lineFriendly.sweepActionId,
        name: "Sweep",
        attribute: AttributeScore.BODY,
        proficiency: ProficiencyType.WEAPON_MARTIAL,
        range: ActionRange.MELEE,
        shape: CoordinateGeneratorShape.LINE,
        areaOfEffectSize: 1,
        aimCoordinateRequiresTarget: false,
        affiliationRelationship: {
            self: false,
            foe: true,
            friend: false,
        },
        effectOnActor: {
            [DegreeOfSuccess.SUCCESS]: {
                actionPoints: { spent: 2 },
            },
        },
        effectOnTarget: {
            [DegreeOfSuccess.FAILURE]: {},
            [DegreeOfSuccess.SUCCESS]: {
                damage: {
                    raw: 2,
                    targetProficiency: ProficiencyType.ARMOR,
                },
            },
            [DegreeOfSuccess.CRITICAL]: {
                damage: {
                    raw: 4,
                    targetProficiency: ProficiencyType.ARMOR,
                },
            },
        },
    })
}

function createDemonBiteAction(): SquaddieAction {
    return SquaddieActionService.new({
        id: SimpleTestMissionIds.lineEnemy.biteActionId,
        name: "Bite",
        attribute: AttributeScore.BODY,
        proficiency: ProficiencyType.WEAPON_NATURAL,
        range: ActionRange.MELEE,
        shape: CoordinateGeneratorShape.BLOOM,
        affiliationRelationship: {
            self: false,
            foe: true,
            friend: false,
        },
        effectOnActor: {
            [DegreeOfSuccess.SUCCESS]: {
                actionPoints: { spent: 1 },
            },
        },
        effectOnTarget: {
            [DegreeOfSuccess.FAILURE]: {},
            [DegreeOfSuccess.SUCCESS]: {
                damage: {
                    raw: 2,
                    targetProficiency: ProficiencyType.ARMOR,
                },
            },
            [DegreeOfSuccess.CRITICAL]: {
                damage: {
                    raw: 3,
                    targetProficiency: ProficiencyType.ARMOR,
                },
            },
        },
    })
}
