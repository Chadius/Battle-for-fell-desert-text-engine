import * as readline from "node:readline"
import {
    createDefaultCampaignManager,
    DefaultCampaignIds,
} from "../logic/src/testUtils/mission/defaultCampaign.js"
import { MissionEngine } from "../logic/src/mission/missionEngine/missionEngine.js"
import { TextMissionRunner } from "./textMissionRunner.js"

// Loads a MissionEngine from the default campaign, prompting interactively if the requested ID is unknown.
async function selectMissionEngine(
    rl: readline.Interface,
    requestedMissionId: string | undefined
): Promise<MissionEngine> {
    const campaignManager = createDefaultCampaignManager()
    const missions = campaignManager.getSerializedMissions()
    let missionIdToLoad = requestedMissionId ?? DefaultCampaignIds.mission1Id

    // Unknown ID supplied — check before loading, show list, and let the user pick
    if (
        requestedMissionId != undefined &&
        !missions.some((m) => m.id === missionIdToLoad)
    ) {
        console.log(`Unknown mission: "${requestedMissionId}"`)
        console.log("Available missions:")
        missions.forEach((m, i) => {
            console.log(`  ${i + 1}. ${m.name} (${m.id})`)
        })

        const answer = await new Promise<string>((resolve) => {
            rl.question("Enter a mission number or Q to exit: ", resolve)
        })

        if (answer.toUpperCase() === "Q") {
            rl.close()
            process.exit(0)
        }

        const index = parseInt(answer, 10) - 1
        if (index >= 0 && index < missions.length) {
            missionIdToLoad = missions[index].id
        } else {
            throw new Error(`[selectMissionEngine] Invalid selection`)
        }
    }

    campaignManager.loadMissionById(missionIdToLoad)
    const missionManager = campaignManager.getCurrentMission()
    if (missionManager == undefined) {
        throw new Error(
            `[selectMissionEngine] Could not load mission: ${missionIdToLoad}`
        )
    }

    return new MissionEngine(missionManager)
}

const prompt = (rl: readline.Interface, runner: TextMissionRunner): void => {
    rl.question("> ", (answer) => {
        const result = runner.processInput(answer)
        console.log(result.text)

        if (result.shouldQuit) {
            rl.close()
            return
        }

        prompt(rl, runner)
    })
}

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
})

;(async () => {
    const engine = await selectMissionEngine(rl, process.argv[2])
    const runner = new TextMissionRunner(engine)
    console.log(runner.getWelcomeText())
    prompt(rl, runner)
})()
