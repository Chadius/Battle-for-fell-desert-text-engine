import { MissionEngine } from "../../logic/src/mission/missionEngine/missionEngine.js"
import {
    createMovementTestMission,
    MovementTestMissionIds,
} from "../../logic/src/testUtils/mission/movementTestMission.js"
import type { BattleSquaddieId } from "../../logic/src/squaddie/inBattle/battleSquaddieId.js"
import { MissionAffiliationTurn } from "../../logic/src/mission/missionTurn.js"

export { MovementTestMissionIds }

// Creates a MissionEngine for the movement test mission (Vale and Fracta as PLAYER squaddies
// vs Slither Demons as ENEMY squaddies) and advances it to PLAYER_TURN.
// Returns the engine and the in-battle IDs for Vale and Fracta.
export function createMovementMissionEngine(): {
    engine: MissionEngine
    valeId: BattleSquaddieId
    fractaId: BattleSquaddieId
} {
    const { missionManager, valeSquaddieId, fractaSquaddieId } =
        createMovementTestMission()

    const engine = new MissionEngine(missionManager)

    // Advance past TURN_START and PLAYER_TURN_START to reach PLAYER_TURN.
    while (
        engine.getCurrentAffiliationTurn() !== MissionAffiliationTurn.PLAYER_TURN
    ) {
        engine.transitionToNextPhase()
    }

    return {
        engine,
        valeId: valeSquaddieId,
        fractaId: fractaSquaddieId,
    }
}
