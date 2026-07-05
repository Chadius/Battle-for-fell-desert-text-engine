import type { MissionEngine } from "../logic/src/mission/missionEngine/missionEngine.js"
import {
    ChallengeModifierType,
    ChallengeModifierSettingService,
} from "../logic/src/squaddieAction/calculate/challengeModifier/challengeModifierSetting.js"
import { humanizeEnumName } from "./stringFormat.js"

// Only lists modifiers that are ON — the default (OFF) state should stay invisible.
const activeModifierLines = (engine: MissionEngine): string[] => {
    const setting = engine.getChallengeModifierSetting()
    return Object.values(ChallengeModifierType)
        .filter((type) =>
            ChallengeModifierSettingService.isEnabled(setting, type)
        )
        .map((type) => `${humanizeEnumName(type)}: ON`)
}

export const ChallengeModifierInspector = {
    activeModifierLines: (engine: MissionEngine) =>
        activeModifierLines(engine),
}
