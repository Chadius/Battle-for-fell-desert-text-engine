import type { MissionEngine } from "../logic/src/mission/missionEngine/missionEngine.js"
import { MovieSceneType } from "../logic/src/mission/missionEngine/missionEngine.js"

type CurrentScene = NonNullable<
    NonNullable<ReturnType<MissionEngine["getMovieStatus"]>>["currentScene"]
>

// Formats a single movie scene as player-facing display text.
export const sceneDisplayText = (scene: CurrentScene): string => {
    const lines: string[] = []

    if (scene.type === MovieSceneType.CONVERSATION) {
        const speaker = scene.speakerId != undefined ? `${scene.speakerId}: ` : ""
        lines.push(`${speaker}${scene.text}`)
        if (scene.isWaitingForDecision) {
            lines.push("Choose:")
            for (const d of scene.decisions) {
                lines.push(`  ${d.decisionId}) ${d.text}`)
            }
            return lines.join("\n")
        }
    } else if (scene.type === MovieSceneType.IMAGE) {
        if (scene.description != undefined) lines.push(scene.description)
        if (scene.caption != undefined) lines.push(scene.caption)
    }

    lines.push("[Enter/N to continue, S to stop movie]")
    return lines.join("\n")
}
