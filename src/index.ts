import * as readline from "node:readline"
import { existsSync } from "node:fs"
import { join } from "node:path"
import termKit from "terminal-kit"
import { MissionEngineTestHarness } from "../logic/src/testUtils/mission/missionEngineTestHarness.js"
import { MissionEngine } from "../logic/src/mission/missionEngine/missionEngine.js"
import { MissionManager } from "../logic/src/mission/missionManager.js"
import { TextMissionRunner } from "./textMissionRunner.js"
import type { DebugFlags } from "../logic/src/mission/debugFlags.js"
import { DEBUG_FLAG_NAMES } from "./commandProcessor.js"
import {
    CAMPAIGN_DATA_FOLDER,
    CAMPAIGNS_SUBFOLDER,
    MISSIONS_SUBFOLDER,
    listAvailableCampaigns,
    listAvailableMissions,
    loadArmyFromFolder,
    loadCampaignDisplayName,
    loadGlossaryFromFolder,
    loadMissionFromFolder,
    loadMoviesFromFolder,
} from "./campaignLoader.js"
import { GlossaryManager } from "../logic/src/campaign/glossary/glossaryManager.js"
import { GlossaryCollectionService } from "../logic/src/campaign/glossary/glossaryCollection.js"
import { initLogger, appendLog } from "./logger.js"
import { wrapLine } from "./terminalLayout.js"

const term = termKit.terminal

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

// Prompts the user to pick one of the listed campaign folders (shown by their campaign.json
// displayName) and returns the chosen folder name.
async function promptCampaignSelection(
    rl: readline.Interface,
    campaignsPath: string,
    campaignFolderNames: string[]
): Promise<string> {
    const campaignLabels = campaignFolderNames.map((folderName) =>
        loadCampaignDisplayName(join(campaignsPath, folderName), folderName)
    )

    return new Promise((resolve) => {
        console.log("Available campaigns:")
        campaignLabels.forEach((label, index) => {
            console.log(`  ${index + 1}. ${label}`)
        })

        const ask = () => {
            rl.question(`Select a campaign (1-${campaignFolderNames.length}): `, (answer) => {
                const num = parseInt(answer.trim(), 10)
                if (num >= 1 && num <= campaignFolderNames.length) {
                    resolve(campaignFolderNames[num - 1])
                } else {
                    console.log(`Please enter a number between 1 and ${campaignFolderNames.length}.`)
                    ask()
                }
            })
        }
        ask()
    })
}

// Tries to load a mission from a campaign under campaignData/campaigns/. Prompts the user to
// choose a campaign when more than one is available, then a mission within it. Falls back to
// the test harness if no campaigns or missions are found.
async function selectAndLoadMission(
    rl: readline.Interface
): Promise<{ engine: MissionEngine; glossaryManager: GlossaryManager }> {
    const campaignDataPath = join(process.cwd(), CAMPAIGN_DATA_FOLDER)
    const campaignsPath = join(campaignDataPath, CAMPAIGNS_SUBFOLDER)
    const createEmptyGlossaryManager = () => new GlossaryManager(GlossaryCollectionService.new())

    if (!existsSync(campaignDataPath)) {
        console.warn("[index] Warning: campaignData folder not found. Loading default test harness mission.")
        return { engine: loadTestHarnessMission(rl), glossaryManager: createEmptyGlossaryManager() }
    }

    const campaignFolderNames = listAvailableCampaigns(campaignsPath)
    if (campaignFolderNames.length === 0) {
        console.warn("[index] Warning: No campaigns found in campaignData/campaigns. Loading default test harness mission.")
        return { engine: loadTestHarnessMission(rl), glossaryManager: createEmptyGlossaryManager() }
    }

    const selectedCampaignFolder = await promptCampaignSelection(rl, campaignsPath, campaignFolderNames)
    const campaignFolderPath = join(campaignsPath, selectedCampaignFolder)
    const missionsPath = join(campaignFolderPath, MISSIONS_SUBFOLDER)

    const missionNames = listAvailableMissions(missionsPath)
    if (missionNames.length === 0) {
        console.warn(`[index] Warning: No missions found in campaignData/campaigns/${selectedCampaignFolder}/missions. Loading default test harness mission.`)
        return { engine: loadTestHarnessMission(rl), glossaryManager: createEmptyGlossaryManager() }
    }

    const selected = await promptMissionSelection(rl, missionNames)
    const missionFolderPath = join(missionsPath, selected)

    const armyManager = loadArmyFromFolder(campaignFolderPath)
    const glossaryManager = loadGlossaryFromFolder(campaignFolderPath)
    const engine = new MissionEngine(new MissionManager({ armyManager }))
    const result = loadMissionFromFolder(engine, campaignFolderPath, missionFolderPath)
    if (!result.isValid) {
        console.error(`Mission "${selected}" failed to load:`)
        result.errors.forEach((e) => console.error(` - ${e}`))
        rl.close()
        process.exit(1)
    }
    loadMoviesFromFolder(campaignFolderPath, missionFolderPath).forEach((movie) =>
        engine.registerMovie(movie)
    )

    return { engine, glossaryManager }
}

// Calculates the column widths for the split layout based on current terminal dimensions.
const getLayoutDimensions = () => {
    const leftWidth = Math.floor(term.width / 2)
    const rightStart = leftWidth + 2
    const rightWidth = term.width - leftWidth - 1
    return { leftWidth, rightStart, rightWidth }
}

// Draws the split-pane layout: map on the left, output lines on the right, divider between them.
const redrawScreen = (mapText: string, outputLines: string[]): void => {
    const { leftWidth, rightStart, rightWidth } = getLayoutDimensions()
    const maxOutputRows = term.height - 3

    term.clear()

    // Draw map lines into left pane
    const mapLines = mapText.split("\n")
    mapLines.forEach((line, i) => {
        if (i >= term.height - 1) return
        term.moveTo(1, i + 1)
        term(line.slice(0, leftWidth).padEnd(leftWidth, " "))
    })

    // Draw vertical divider
    for (let row = 1; row <= term.height - 1; row++) {
        term.moveTo(leftWidth + 1, row)
        term("│")
    }

    // Wrap output lines to the pane width, then draw the last maxOutputRows wrapped rows.
    const wrappedLines = outputLines.flatMap((line) => wrapLine(line, rightWidth))
    const visibleLines = wrappedLines.slice(-maxOutputRows)
    visibleLines.forEach((line, i) => {
        term.moveTo(rightStart, i + 1)
        term(line)
    })
}

// Keeps the output buffer from growing unbounded; retains the most recent entries.
const trimOutputBuffer = (lines: string[], maxLines: number): void => {
    if (lines.length > maxLines) {
        lines.splice(0, lines.length - maxLines)
    }
}

// Main async game loop using terminal-kit input.
const gameLoop = async (runner: TextMissionRunner): Promise<void> => {
    const outputLines: string[] = runner.getWelcomeText().split("\n")
    appendLog("Welcome text displayed")

    // Redraw on terminal resize
    term.on("resize", () => {
        redrawScreen(runner.getMapText(), outputLines)
    })

    let gameEnded = false
    while (true) {
        redrawScreen(runner.getMapText(), outputLines)
        const { rightStart } = getLayoutDimensions()
        term.moveTo(rightStart, term.height - 1)
        term("> ")

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const inputResult = await (term.inputField({}) as any).promise as string | undefined
        if (inputResult == undefined) break // ctrl+c or abort

        const answer = inputResult.trim()
        appendLog(`Input: "${answer}"`)
        const result = runner.processInput(answer)
        appendLog(`Output: "${result.text.replace(/\n/g, " | ")}"`)

        outputLines.push(...result.text.split("\n"))
        trimOutputBuffer(outputLines, term.height - 3)

        if (result.shouldQuit) {
            gameEnded = true
            break
        }
    }

    if (gameEnded) {
        redrawScreen(runner.getMapText(), outputLines)
        const { rightStart } = getLayoutDimensions()
        term.moveTo(rightStart, term.height - 1)
        term("Press Enter to exit.")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (term.inputField({}) as any).promise
    }

    term.clear()
    term.processExit(0)
}

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
})

const { debugFlagNames } = parseArgv(process.argv.slice(2))

const { engine, glossaryManager } = await selectAndLoadMission(rl)
rl.close()

for (const flag of debugFlagNames) {
    engine.setDebugFlag(flag, true)
}

initLogger(join(process.cwd(), "debug.log"))

const runner = new TextMissionRunner(engine, Date.now, glossaryManager)
await gameLoop(runner)
