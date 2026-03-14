import { describe, it, expect } from "vitest"
import { EnemyAI } from "./enemyAI.js"
import { MissionEngineTestHarness } from "../logic/src/testUtils/mission/missionEngineTestHarness.js"
import { RollGenerator } from "../logic/src/squaddieAction/calculate/roll/rollGenerator.js"
import { MissionAffiliationTurn } from "../logic/src/mission/missionTurn.js"

describe("EnemyAI", () => {
    // Helper: advance to PLAYER_TURN and move Lini to (2,2) so the Slither Demon
    // is within movement range, then end Lini's turn.
    // After endSquaddieTurn, autoAdvanceThroughBookendAffiliationTurns stops at
    // ENEMY_TURN with a readied movement action for the Slither Demon.
    const setupEnemyTurnWithSlitherDemonAbleToMove = () => {
        const allFoursQueue = Array<number>(40).fill(4)
        const engine = new MissionEngineTestHarness(
            new RollGenerator(allFoursQueue)
        )
        const liniId = engine.getLiniSquaddieId()
        const slitherDemonId = engine.getSlitherDemonSquaddieId()

        engine.transitionToNextPhase()
        engine.transitionToNextPhase()

        // Move Lini closer so the Slither Demon at (3,4) can reach her
        engine.readyAction({
            actor: liniId,
            targets: [liniId],
            action: {
                id: "default-move",
                decisions: { desiredMovementDestination: { row: 2, col: 2 } },
            },
        })
        engine.useActionAndGetResults()

        // Ending Lini's turn triggers autoAdvanceThroughBookendAffiliationTurns,
        // which stops at ENEMY_TURN after preloading a movement action for the demon
        engine.endSquaddieTurn(liniId)

        return { engine, liniId, slitherDemonId }
    }

    describe("takeTurn", () => {
        it("returns a non-empty message array", () => {
            const { engine, slitherDemonId } =
                setupEnemyTurnWithSlitherDemonAbleToMove()

            const messages = EnemyAI.takeTurn(engine, slitherDemonId)

            expect(messages.length).toBeGreaterThan(0)
        })

        it("enemy moves toward Lini when reachable tiles exist", () => {
            const { engine, slitherDemonId } =
                setupEnemyTurnWithSlitherDemonAbleToMove()
            expect(engine.getCurrentAffiliationTurn()).toBe(
                MissionAffiliationTurn.ENEMY_TURN
            )
            expect(engine.getReadiedAction()).not.toBeUndefined()

            const messages = EnemyAI.takeTurn(engine, slitherDemonId)

            expect(messages.some((m) => m.includes("moves to"))).toBe(true)
        })

        it("narration includes the enemy name", () => {
            const { engine, slitherDemonId } =
                setupEnemyTurnWithSlitherDemonAbleToMove()

            const messages = EnemyAI.takeTurn(engine, slitherDemonId)

            expect(messages.some((m) => m.includes("Slither Demon"))).toBe(true)
        })

        it("narration includes destination coordinate", () => {
            const { engine, slitherDemonId } =
                setupEnemyTurnWithSlitherDemonAbleToMove()

            const messages = EnemyAI.takeTurn(engine, slitherDemonId)

            // Destination is in (row, col) format
            expect(
                messages.some((m) => /\(\d+, \d+\)/.test(m))
            ).toBe(true)
        })

        it("narration includes attack result text when enemy attacks", () => {
            // Helper: move Lini adjacent to the Slither Demon at (3,4),
            // then end her turn so ENEMY_TURN starts with an attack action preloaded.
            const allFoursQueue = Array<number>(40).fill(4)
            const engine = new MissionEngineTestHarness(
                new RollGenerator(allFoursQueue)
            )
            const liniId = engine.getLiniSquaddieId()
            const slitherDemonId = engine.getSlitherDemonSquaddieId()

            engine.transitionToNextPhase()
            engine.transitionToNextPhase()

            // Move Lini adjacent to the Slither Demon at (3,4)
            engine.readyAction({
                actor: liniId,
                targets: [liniId],
                action: {
                    id: "default-move",
                    decisions: { desiredMovementDestination: { row: 3, col: 3 } },
                },
            })
            engine.useActionAndGetResults()
            engine.endSquaddieTurn(liniId)

            const messages = EnemyAI.takeTurn(engine, slitherDemonId)

            // Should include roll info or damage text from ActionResultInspector
            expect(
                messages.some(
                    (m) =>
                        m.includes("Roll:") ||
                        m.includes("takes")
                )
            ).toBe(true)
        })

        it("returns end-turn narration when no action is preloaded", () => {
            // Manually advance to ENEMY_TURN without triggering autoAdvance,
            // so no action is preloaded by the AI strategy
            const engine = new MissionEngineTestHarness()
            const slitherDemonId = engine.getSlitherDemonSquaddieId()

            // Manually transition until ENEMY_TURN (bypasses autoAdvanceThroughBookend)
            for (let i = 0; i < 20; i++) {
                if (
                    engine.getCurrentAffiliationTurn() ===
                    MissionAffiliationTurn.ENEMY_TURN
                )
                    break
                engine.transitionToNextPhase()
            }
            // At this point getReadiedAction() is undefined (no strategy called)
            expect(engine.getReadiedAction()).toBeUndefined()

            const messages = EnemyAI.takeTurn(engine, slitherDemonId)

            expect(messages.some((m) => m.includes("ends their turn"))).toBe(
                true
            )
        })
    })
})
