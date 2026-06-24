import type { MissionEngine } from "../logic/src/mission/missionEngine/missionEngine.js"
import { MovieSceneType } from "../logic/src/mission/missionEngine/missionEngine.js"

export type CurrentScene = NonNullable<
    NonNullable<ReturnType<MissionEngine["getMovieStatus"]>>["currentScene"]
>

// Returns true when the scene is a conversation that is currently blocking on a player decision.
export const sceneIsWaitingForDecision = (scene: CurrentScene): boolean =>
    scene.type === MovieSceneType.CONVERSATION && scene.isWaitingForDecision

// Formats a single movie scene as player-facing display text.
export const sceneDisplayText = (scene: CurrentScene): string => {
    const lines: string[] = []

    if (scene.type === MovieSceneType.CONVERSATION) {
        const speaker = scene.speakerId != undefined ? `${scene.speakerId}: ` : ""
        lines.push(`${speaker}${scene.text}`)
        if (scene.isWaitingForDecision) {
            lines.push("Choose:")
            scene.decisions.forEach((d, i) => lines.push(`  ${i + 1}) ${d.text}`))
            lines.push("[Type the option number to choose, S to stop]")
        } else {
            lines.push("[Enter/N to continue, S to stop movie]")
        }
    } else if (scene.type === MovieSceneType.IMAGE) {
        const descriptionText = scene.description ?? "No description given"
        lines.push(`[Image] ${descriptionText}`)
        if (scene.caption != undefined) lines.push(scene.caption)
        lines.push("[Enter/N to continue, S to stop movie]")
    }

    return lines.join("\n")
}
