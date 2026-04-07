import * as readline from "node:readline"
import {
    createDefaultCampaignManager,
    DefaultCampaignIds,
} from "../logic/src/testUtils/mission/defaultCampaign.js"
import { MissionEngine } from "../logic/src/mission/missionEngine/missionEngine.js"
import { TextMissionRunner } from "./textMissionRunner.js"
import type { DebugFlags } from "../logic/src/mission/debugFlags.js"
import { DEBUG_FLAG_NAMES } from "./commandProcessor.js"

// Parses --debug=flagName,flagName2 arguments from argv and applies them to the engine.
// Unknown flag names are warned about but do not abort. Returns the remaining positional args.
const parseArgv = (
    argv: string[]
): { missionId: string | undefined; debugFlagNames: (keyof DebugFlags)[] } => {
    const debugFlagNames: (keyof DebugFlags)[] = []
    const positional: string[] = []

    for (const arg of argv) {
        if (arg.startsWith("--debug=")) {
            const names = arg.slice("--debug=".length).split(",")
            for (const name of names) {
                const trimmed = name.trim() as keyof DebugFlags
                if (DEBUG_FLAG_NAMES.includes(trimmed)) {
                    debugFlagNames.push(trimmed)
                } else {
                    console.warn(`[index] Unknown debug flag: "${trimmed}". Known flags: ${DEBUG_FLAG_NAMES.join(", ")}`)
                }
            }
        } else {
            positional.push(arg)
        }
    }

    return { missionId: positional[0], debugFlagNames }
}

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
    // Separate --debug= flags from the positional mission ID
    const { missionId, debugFlagNames } = parseArgv(process.argv.slice(2))

    const engine = await selectMissionEngine(rl, missionId)

    // Apply any debug flags requested on the command line
    for (const flag of debugFlagNames) {
        engine.setDebugFlag(flag, true)
    }

    const runner = new TextMissionRunner(engine)
    console.log(runner.getWelcomeText())
    prompt(rl, runner)
})()
