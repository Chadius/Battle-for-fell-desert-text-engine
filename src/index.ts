import * as readline from "node:readline"
import { MissionEngineTestHarness } from "../logic/src/testUtils/mission/missionEngineTestHarness.js"
import { MissionEngine } from "../logic/src/mission/missionEngine/missionEngine.js"
import { TextMissionRunner } from "./textMissionRunner.js"
import type { DebugFlags } from "../logic/src/mission/debugFlags.js"
import { DEBUG_FLAG_NAMES } from "./commandProcessor.js"

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

const engine = loadTestHarnessMission(rl)

for (const flag of debugFlagNames) {
    engine.setDebugFlag(flag, true)
}

const runner = new TextMissionRunner(engine)
console.log(runner.getWelcomeText())
prompt(rl, runner)
