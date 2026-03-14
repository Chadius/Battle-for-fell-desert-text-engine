import type { MissionEngine } from "../logic/src/mission/missionEngine/missionEngine.js"
import type { BattleSquaddieId } from "../logic/src/squaddie/inBattle/inBattleSquaddieManager.js"
import type { OffsetMaybeOffmapCoordinate } from "../logic/src/coordinateMap/coordinateMap.js"

// EnemyAI handles execution of AI-decided actions during the enemy turn.
// The engine's built-in strategy (SimpleAggressorStrategy) preloads the next action
// via prepareNextAiAction; takeTurn executes the preloaded action and returns
// narration strings for display.
export const EnemyAI = {
    takeTurn(
        engine: MissionEngine,
        squaddieId: BattleSquaddieId
    ): string[] {
        const readiedAction = engine.getReadiedAction()

        // Fallback: no action was preloaded by the AI strategy — end the turn
        if (readiedAction == undefined) {
            const info = engine.getSquaddieInfo(squaddieId)
            engine.endSquaddieTurn(squaddieId)
            return [`${info.name} ends their turn.`]
        }

        // Use the actor from the readied action (the engine's strategy selected it)
        const actorId = readiedAction.actor
        const info = engine.getSquaddieInfo(actorId)
        const positionBefore = engine.getSquaddiePosition(actorId)

        engine.useActionAndGetResults()

        const positionAfter = engine.getSquaddiePosition(actorId)

        return buildNarration(info.name, positionBefore, positionAfter)
    },
}

// Format a narration line describing what the enemy did based on position change
function buildNarration(
    name: string,
    positionBefore: OffsetMaybeOffmapCoordinate | undefined,
    positionAfter: OffsetMaybeOffmapCoordinate | undefined
): string[] {
    if (
        positionBefore?.row != undefined &&
        positionBefore?.col != undefined &&
        positionAfter?.row != undefined &&
        positionAfter?.col != undefined &&
        (positionBefore.row !== positionAfter.row ||
            positionBefore.col !== positionAfter.col)
    ) {
        return [`${name} moves to (${positionAfter.row}, ${positionAfter.col}).`]
    }
    return [`${name} acts.`]
}
