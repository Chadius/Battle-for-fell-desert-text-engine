import { describe, it, expect } from "vitest"
import { ChallengeModifierInspector } from "./challengeModifierInspector.js"
import { MissionEngineTestHarness } from "../logic/src/testUtils/mission/missionEngineTestHarness.js"
import { ChallengeModifierType } from "../logic/src/squaddieAction/calculate/challengeModifier/challengeModifierSetting.js"

describe("ChallengeModifierInspector", () => {
    describe("activeModifierLines", () => {
        it("lists nothing when no modifiers are enabled", () => {
            const engine = new MissionEngineTestHarness()
            expect(ChallengeModifierInspector.activeModifierLines(engine)).toEqual(
                []
            )
        })

        it("lists an enabled modifier by its display name", () => {
            const engine = new MissionEngineTestHarness()
            engine.setChallengeModifier(
                ChallengeModifierType.TRAINING_WHEELS,
                true
            )
            expect(ChallengeModifierInspector.activeModifierLines(engine)).toEqual(
                ["Training Wheels: ON"]
            )
        })

        it("stops listing a modifier once it is disabled again", () => {
            const engine = new MissionEngineTestHarness()
            engine.setChallengeModifier(
                ChallengeModifierType.TRAINING_WHEELS,
                true
            )
            engine.setChallengeModifier(
                ChallengeModifierType.TRAINING_WHEELS,
                false
            )
            expect(ChallengeModifierInspector.activeModifierLines(engine)).toEqual(
                []
            )
        })
    })
})
