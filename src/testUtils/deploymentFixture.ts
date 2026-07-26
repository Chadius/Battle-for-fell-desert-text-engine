import { join } from "node:path"
import { MissionEngine } from "../../logic/src/mission/missionEngine/missionEngine.js"
import { MissionManager } from "../../logic/src/mission/missionManager.js"
import { MissionStateService } from "../../logic/src/mission/missionState.js"
import { ArmyManager } from "../../logic/src/campaign/army/armyManager.js"
import { ArmyService } from "../../logic/src/campaign/army/army.js"
import { CampaignSquaddieService } from "../../logic/src/campaign/army/campaignSquaddie.js"
import { CampaignSquaddieDeploymentCoordinateCollectionService } from "../../logic/src/mission/campaignSquaddieDeploymentCoordinateCollection.js"
import { CampaignSquaddieDeploymentCoordinateService } from "../../logic/src/mission/campaignSquaddieDeploymentCoordinate.js"
import { OutOfBattleSquaddieManager } from "../../logic/src/squaddie/outOfBattle/outOfBattleSquaddieManager.js"
import { OutOfBattleSquaddieCollectionService } from "../../logic/src/squaddie/outOfBattle/outOfBattleSquaddieCollection.js"
import { OutOfBattleSquaddieAttributeSheetCollectionService } from "../../logic/src/squaddie/outOfBattle/outOfBattleSquaddieAttributeSheetCollection.js"
import { OutOfBattleSquaddieAttributeSheetService } from "../../logic/src/squaddie/outOfBattle/outOfBattleSquaddieAttributeSheet.js"
import { OutOfBattleSquaddieService } from "../../logic/src/squaddie/outOfBattle/outOfBattleSquaddie.js"
import { InBattleSquaddieManager } from "../../logic/src/squaddie/inBattle/inBattleSquaddieManager.js"
import { InBattleSquaddieCollectionService } from "../../logic/src/squaddie/inBattle/inBattleSquaddieCollection.js"
import { CoordinateMapCollectionManager } from "../../logic/src/coordinateMap/coordinateMapManager.js"
import { CoordinateMapCollectionService } from "../../logic/src/coordinateMap/coordinateMapCollection.js"
import { CoordinateMapService } from "../../logic/src/coordinateMap/coordinateMap.js"
import { SquaddieActionManager } from "../../logic/src/squaddieAction/squaddieActionManager.js"
import { SquaddieActionCollectionService } from "../../logic/src/squaddieAction/squaddieActionCollection.js"
import { AttributeScore } from "../../logic/src/proficiency/attributeScore.js"
import { SquaddieAffiliation } from "../../logic/src/affiliation/affiliation.js"
import { loadArmyFromFolder, loadMissionFromFolder } from "../campaignLoader.js"

export const targetPracticeCampaignFolderPath = join(
    process.cwd(),
    "campaignData",
    "campaigns",
    "test"
)
export const targetPracticeMissionFolderPath = join(
    targetPracticeCampaignFolderPath,
    "missions",
    "targetPractice"
)

// IDs from campaignData/campaigns/test/army.json.
export const TargetPracticeCampaignSquaddieIds = {
    teros: "squaddie-99w1ci",
    vale: "squaddie-0qog1e",
    gloria: "squaddie-u8r9fn",
} as const

// IDs from campaignData/campaigns/test/missions/targetPractice/missionState.json's
// campaignSquaddieDeploymentCoordinates: Teros is locked to a LEADER-type coordinate, Vale is
// locked to a SPECIFIC_SQUADDIE coordinate, and one NONE-type coordinate is left open --
// Gloria is the only unplaced eligible squaddie left in the roster for it.
export const TargetPracticeDeploymentCoordinateIds = {
    terosLeaderSlot: "deployment-d289l6",
    valeSpecificSlot: "deployment-6av0v8",
    openSlot: "deployment-roov7f",
} as const

// Builds the targetPractice MissionEngine with its campaign army wired in, exactly as
// index.ts does for folder-based missions.
export const buildTargetPracticeEngine = (): MissionEngine => {
    const armyManager = loadArmyFromFolder(targetPracticeCampaignFolderPath)
    const engine = new MissionEngine(new MissionManager({ armyManager }))
    const result = loadMissionFromFolder(
        engine,
        targetPracticeCampaignFolderPath,
        targetPracticeMissionFolderPath
    )
    if (!result.isValid) {
        throw new Error(
            `[buildTargetPracticeEngine] fixture failed to load: ${result.errors.join("; ")}`
        )
    }
    return engine
}

export const TwoOpenCoordinatesIds = {
    alice: "sq-alice",
    bob: "sq-bob",
    slotA: "slot-a",
    slotB: "slot-b",
    slotC: "slot-c",
} as const

// Builds a MissionEngine with three unlocked, NONE-request deployment coordinates: slotA and
// slotB already occupied (Alice and Bob), slotC left open. targetPractice's coordinates are all
// either locked-and-satisfied or still open, so a fixture with independently-movable occupied
// coordinates plus a genuinely open one is needed to exercise move/swap without a lock rejecting
// the mutation.
export const buildEngineWithTwoOpenCoordinates = (): MissionEngine => {
    const armyManager = new ArmyManager(ArmyService.new())
    armyManager.addOrUpdate(
        CampaignSquaddieService.new({
            id: TwoOpenCoordinatesIds.alice,
            outOfBattleAttributeSheetId: "alice-attribute-sheet",
            outOfBattleSquaddieId: "alice-out-of-battle",
            name: "Alice",
        })
    )
    armyManager.addOrUpdate(
        CampaignSquaddieService.new({
            id: TwoOpenCoordinatesIds.bob,
            outOfBattleAttributeSheetId: "bob-attribute-sheet",
            outOfBattleSquaddieId: "bob-out-of-battle",
            name: "Bob",
        })
    )

    let coordinateCollection = CampaignSquaddieDeploymentCoordinateCollectionService.new()
    coordinateCollection = CampaignSquaddieDeploymentCoordinateCollectionService.addOrUpdate({
        collection: coordinateCollection,
        campaignSquaddieDeploymentCoordinate: CampaignSquaddieDeploymentCoordinateService.new({
            id: TwoOpenCoordinatesIds.slotA,
            coordinate: { row: 0, col: 0 },
            request: { type: "NONE" },
        }),
    })
    coordinateCollection = CampaignSquaddieDeploymentCoordinateCollectionService.addOrUpdate({
        collection: coordinateCollection,
        campaignSquaddieDeploymentCoordinate: CampaignSquaddieDeploymentCoordinateService.new({
            id: TwoOpenCoordinatesIds.slotB,
            coordinate: { row: 0, col: 1 },
            request: { type: "NONE" },
        }),
    })
    coordinateCollection = CampaignSquaddieDeploymentCoordinateCollectionService.addOrUpdate({
        collection: coordinateCollection,
        campaignSquaddieDeploymentCoordinate: CampaignSquaddieDeploymentCoordinateService.new({
            id: TwoOpenCoordinatesIds.slotC,
            coordinate: { row: 0, col: 2 },
            request: { type: "NONE" },
        }),
    })

    const outOfBattleSquaddieManager = new OutOfBattleSquaddieManager(
        OutOfBattleSquaddieCollectionService.new(),
        OutOfBattleSquaddieAttributeSheetCollectionService.new()
    )
    for (const [attributeSheetId, outOfBattleSquaddieId, name] of [
        ["alice-attribute-sheet", "alice-out-of-battle", "Alice"],
        ["bob-attribute-sheet", "bob-out-of-battle", "Bob"],
    ] as const) {
        outOfBattleSquaddieManager.addOrUpdateAttributeSheet(
            OutOfBattleSquaddieAttributeSheetService.new({
                id: attributeSheetId,
                maxHitPoints: 5,
                movement: { movementPointsPerAction: 2 },
                attributeScores: {
                    [AttributeScore.BODY]: 0,
                    [AttributeScore.MIND]: 0,
                    [AttributeScore.SOUL]: 0,
                },
            })
        )
        outOfBattleSquaddieManager.addOrUpdateSquaddie(
            OutOfBattleSquaddieService.new({
                id: outOfBattleSquaddieId,
                name,
                attributeSheetId,
                affiliation: SquaddieAffiliation.PLAYER,
            })
        )
    }

    const inBattleSquaddieManager = new InBattleSquaddieManager(
        InBattleSquaddieCollectionService.new(),
        outOfBattleSquaddieManager
    )

    const mapId = "two-open-coordinates-map"
    const coordinateMapCollectionManager = new CoordinateMapCollectionManager(
        CoordinateMapCollectionService.new()
    )
    coordinateMapCollectionManager.addOrUpdate({
        map: CoordinateMapService.new({ id: mapId, name: "Map", movementProperties: ["1 1"] }),
    })

    const squaddieActionManager = new SquaddieActionManager(SquaddieActionCollectionService.new())

    const missionState = MissionStateService.new({
        id: "two-open-coordinates-mission",
        mapId,
        campaignSquaddieDeploymentCoordinates: coordinateCollection,
    })

    const missionManager = new MissionManager({
        missionState,
        inBattleSquaddieManager,
        coordinateMapCollectionManager,
        squaddieActionManager,
        outOfBattleSquaddieManager,
        armyManager,
    })

    const engine = new MissionEngine(missionManager)
    engine.finalizeLoadingMission()
    engine.deployCampaignSquaddie({
        coordinateId: TwoOpenCoordinatesIds.slotA,
        campaignSquaddieId: TwoOpenCoordinatesIds.alice,
    })
    engine.deployCampaignSquaddie({
        coordinateId: TwoOpenCoordinatesIds.slotB,
        campaignSquaddieId: TwoOpenCoordinatesIds.bob,
    })

    return engine
}

// Builds a MissionEngine with a single campaign squaddie whose only deployment coordinate is a
// locked LEADER request -- defaultAssign() resolves it completely, leaving nothing for the
// player to confirm, so the runner should auto-finalize and start the mission immediately.
export const buildEngineWithFullyResolvedDeployment = (): MissionEngine => {
    const leaderId = "leader-campaign-squaddie"
    const outOfBattleSquaddieId = "leader-out-of-battle"
    const attributeSheetId = "leader-attribute-sheet"
    const mapId = "fully-resolved-map"
    const coordinateId = "leader-slot"

    const armyManager = new ArmyManager(ArmyService.new())
    armyManager.addOrUpdate(
        CampaignSquaddieService.new({
            id: leaderId,
            outOfBattleAttributeSheetId: attributeSheetId,
            outOfBattleSquaddieId,
            name: "Sole Leader",
            isLeader: true,
        })
    )

    let coordinateCollection = CampaignSquaddieDeploymentCoordinateCollectionService.new()
    coordinateCollection = CampaignSquaddieDeploymentCoordinateCollectionService.addOrUpdate({
        collection: coordinateCollection,
        campaignSquaddieDeploymentCoordinate: CampaignSquaddieDeploymentCoordinateService.new({
            id: coordinateId,
            coordinate: { row: 0, col: 0 },
            request: { type: "LEADER" },
            locked: true,
        }),
    })

    const outOfBattleSquaddieManager = new OutOfBattleSquaddieManager(
        OutOfBattleSquaddieCollectionService.new(),
        OutOfBattleSquaddieAttributeSheetCollectionService.new()
    )
    outOfBattleSquaddieManager.addOrUpdateAttributeSheet(
        OutOfBattleSquaddieAttributeSheetService.new({
            id: attributeSheetId,
            maxHitPoints: 5,
            movement: { movementPointsPerAction: 2 },
            attributeScores: {
                [AttributeScore.BODY]: 0,
                [AttributeScore.MIND]: 0,
                [AttributeScore.SOUL]: 0,
            },
        })
    )
    outOfBattleSquaddieManager.addOrUpdateSquaddie(
        OutOfBattleSquaddieService.new({
            id: outOfBattleSquaddieId,
            name: "Sole Leader",
            attributeSheetId,
            affiliation: SquaddieAffiliation.PLAYER,
        })
    )

    const inBattleSquaddieManager = new InBattleSquaddieManager(
        InBattleSquaddieCollectionService.new(),
        outOfBattleSquaddieManager
    )

    const coordinateMapCollectionManager = new CoordinateMapCollectionManager(
        CoordinateMapCollectionService.new()
    )
    coordinateMapCollectionManager.addOrUpdate({
        map: CoordinateMapService.new({ id: mapId, name: "Map", movementProperties: ["1 1"] }),
    })

    const squaddieActionManager = new SquaddieActionManager(SquaddieActionCollectionService.new())

    const missionState = MissionStateService.new({
        id: "fully-resolved-mission",
        mapId,
        campaignSquaddieDeploymentCoordinates: coordinateCollection,
    })

    const missionManager = new MissionManager({
        missionState,
        inBattleSquaddieManager,
        coordinateMapCollectionManager,
        squaddieActionManager,
        outOfBattleSquaddieManager,
        armyManager,
    })

    const engine = new MissionEngine(missionManager)
    engine.finalizeLoadingMission()
    return engine
}
