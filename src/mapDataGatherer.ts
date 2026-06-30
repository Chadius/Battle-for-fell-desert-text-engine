import type { MissionEngine } from "../logic/src/mission/missionEngine/missionEngine.js"
import type { TSquaddieAffiliation } from "../logic/src/affiliation/affiliation.js"
import { MissionTurnService } from "../logic/src/mission/missionTurn.js"

export const squaddieAffiliations = (
    engine: MissionEngine,
    overview: ReturnType<MissionEngine["getMapOverview"]>
): Map<string, TSquaddieAffiliation> => {
    const affiliationMap = new Map<string, TSquaddieAffiliation>()
    for (const row of overview.tiles) {
        for (const tile of row) {
            if (tile.squaddieId != undefined) {
                const info = engine.getSquaddieInfo(tile.squaddieId)
                affiliationMap.set(
                    tile.squaddieId.outOfBattleSquaddieId,
                    info.affiliation
                )
            }
        }
    }
    return affiliationMap
}

export const baseRenderInfo = (engine: MissionEngine): {
    overview: ReturnType<MissionEngine["getMapOverview"]>
    turnNumber: number
    currentAffiliation: TSquaddieAffiliation | undefined
    squaddieAffiliations: Map<string, TSquaddieAffiliation>
} => {
    const overview = engine.getMapOverview()
    const turnNumber = engine.getCurrentTurnNumber()
    const affiliationTurn = engine.getCurrentAffiliationTurn()
    const currentAffiliation =
        MissionTurnService.getSquaddieAffiliationForAffiliationTurn(affiliationTurn)
    return { overview, turnNumber, currentAffiliation, squaddieAffiliations: squaddieAffiliations(engine, overview) }
}
