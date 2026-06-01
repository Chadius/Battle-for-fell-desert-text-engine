import * as readline from "node:readline"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { MissionEngineTestHarness } from "../logic/src/testUtils/mission/missionEngineTestHarness.js"
import { MissionEngine } from "../logic/src/mission/missionEngine/missionEngine.js"
import { TextMissionRunner } from "./textMissionRunner.js"
import type { DebugFlags } from "../logic/src/mission/debugFlags.js"
import { DEBUG_FLAG_NAMES } from "./commandProcessor.js"
import {
    CAMPAIGN_DATA_FOLDER,
    CAMPAIGNS_SUBFOLDER,
    MAIN_CAMPAIGN_FOLDER,
    MISSIONS_SUBFOLDER,
    listAvailableMissions,
    loadMissionFromFolder,
} from "./campaignLoader.js"

// Parses --debug=flagName,flagName2 arguments from argv.
// Unknown flag names are warned about but do not abort.
const parseArgv = (argv: string[]): { debugFlagNames: (keyof DebugFlags)[] } => {
    const debugFlagNames: (keyof DebugFlags)[] = []

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
        }
    }

    return { debugFlagNames }
}

// Loads the test harness mission by supplying serialized resources to a plain MissionEngine.
function loadTestHarnessMission(rl: readline.Interface): MissionEngine {
    const engine = new MissionEngine()

    const loadResult = engine.loadMissionFromJson({
        squaddies: MissionEngineTestHarness.serializeSquaddies(),
        attributeSheets: MissionEngineTestHarness.serializeAttributeSheets(),
        maps: MissionEngineTestHarness.serializeMaps(),
        actions: MissionEngineTestHarness.serializeActions(),
        missionState: MissionEngineTestHarness.serializeMissionState(),
    })
    if (!loadResult.isValid) {
        console.error("Mission failed to load:")
        loadResult.errors.forEach((e) => console.error(` - ${e}`))
        rl.close()
        process.exit(1)
    }

    const finalizeResult = engine.finalizeLoadingMission()
    if (!finalizeResult.isValid) {
        console.error("Mission failed to finalize:")
        finalizeResult.errors.forEach((e) => console.error(` - ${e}`))
        rl.close()
        process.exit(1)
    }

    return engine
}

// Prompts the user to pick one of the listed mission names and returns the chosen name.
async function promptMissionSelection(
    rl: readline.Interface,
    missionNames: string[]
): Promise<string> {
    return new Promise((resolve) => {
        console.log("Available missions:")
        missionNames.forEach((name, index) => {
            console.log(`  ${index + 1}. ${name}`)
        })

        const ask = () => {
            rl.question(`Select a mission (1-${missionNames.length}): `, (answer) => {
                const num = parseInt(answer.trim(), 10)
                if (num >= 1 && num <= missionNames.length) {
                    resolve(missionNames[num - 1])
                } else {
                    console.log(`Please enter a number between 1 and ${missionNames.length}.`)
                    ask()
                }
            })
        }
        ask()
    })
}

// Tries to load a mission from campaignData/campaigns/main/missions/. Falls back to the test
// harness if the folder is absent or empty.
async function selectAndLoadMission(rl: readline.Interface): Promise<MissionEngine> {
    const campaignDataPath = join(process.cwd(), CAMPAIGN_DATA_FOLDER)
    const campaignFolderPath = join(campaignDataPath, CAMPAIGNS_SUBFOLDER, MAIN_CAMPAIGN_FOLDER)
    const missionsPath = join(campaignFolderPath, MISSIONS_SUBFOLDER)

    if (!existsSync(campaignDataPath)) {
        console.warn("[index] Warning: campaignData folder not found. Loading default test harness mission.")
        return loadTestHarnessMission(rl)
    }

    const missionNames = listAvailableMissions(missionsPath)
    if (missionNames.length === 0) {
        console.warn("[index] Warning: No missions found in campaignData/campaigns/main/missions. Loading default test harness mission.")
        return loadTestHarnessMission(rl)
    }

    const selected = await promptMissionSelection(rl, missionNames)
    const missionFolderPath = join(missionsPath, selected)

    const engine = new MissionEngine()
    const result = loadMissionFromFolder(engine, campaignFolderPath, missionFolderPath)
    if (!result.isValid) {
        console.error(`Mission "${selected}" failed to load:`)
        result.errors.forEach((e) => console.error(` - ${e}`))
        rl.close()
        process.exit(1)
    }

    return engine
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

const { debugFlagNames } = parseArgv(process.argv.slice(2))

const engine = await selectAndLoadMission(rl)

for (const flag of debugFlagNames) {
    engine.setDebugFlag(flag, true)
}

const runner = new TextMissionRunner(engine)
console.log(runner.getWelcomeText())
prompt(rl, runner)
