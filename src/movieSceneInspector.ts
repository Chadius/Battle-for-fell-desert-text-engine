import type { MissionEngine } from "../logic/src/mission/missionEngine/missionEngine.js"
import { MovieSceneType } from "../logic/src/mission/missionEngine/missionEngine.js"

type CurrentScene = NonNullable<
    NonNullable<ReturnType<MissionEngine["getMovieStatus"]>>["currentScene"]
>

// Returns true when the scene is a conversation that is currently blocking on a player decision.
export const sceneIsWaitingForDecision = (scene: CurrentScene): boolean =>
    scene.type === MovieSceneType.CONVERSATION && scene.isWaitingForDecision

// Returns the decisionId matching the player's input, or undefined if the input is not a valid choice.
export const findDecisionId = (
    scene: CurrentScene,
    input: string
): string | undefined => {
    if (scene.type !== MovieSceneType.CONVERSATION || !scene.isWaitingForDecision) {
        return undefined
    }
    return scene.decisions.find((d) => d.decisionId === input)?.decisionId
}

// Formats a single movie scene as player-facing display text.
export const sceneDisplayText = (scene: CurrentScene): string => {
    const lines: string[] = []

    if (scene.type === MovieSceneType.CONVERSATION) {
        const speaker = scene.speakerId != undefined ? `${scene.speakerId}: ` : ""
        lines.push(`${speaker}${scene.text}`)
    } else if (scene.type === MovieSceneType.IMAGE) {
        const descriptionText = scene.description ?? "No description given"
        lines.push(`[Image] ${descriptionText}`)
        if (scene.caption != undefined) lines.push(scene.caption)
    }

    if (scene.type === MovieSceneType.CONVERSATION && scene.isWaitingForDecision) {
        lines.push("Choose:")
        for (const d of scene.decisions) {
            lines.push(`  ${d.decisionId}) ${d.text}`)
        }
        lines.push("[Type the option number to choose, S to stop]")
    } else {
        lines.push("[Enter/N to continue, S to stop movie]")
    }

    return lines.join("\n")
}
