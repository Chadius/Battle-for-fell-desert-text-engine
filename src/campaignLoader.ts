import { readdirSync, readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import type { Movie } from "../logic/src/movie/movie.js"
import type { MissionEngine } from "../logic/src/mission/missionEngine/missionEngine.js"
import { MovieCollectionLoader } from "./movieCollectionLoader.js"
import { ArmyManager } from "../logic/src/campaign/army/armyManager.js"
import { ArmyService } from "../logic/src/campaign/army/army.js"

export const CAMPAIGN_DATA_FOLDER = "campaignData"
export const CAMPAIGNS_SUBFOLDER = "campaigns"
export const MAIN_CAMPAIGN_FOLDER = "test"
export const MISSIONS_SUBFOLDER = "missions"

// Returns sorted list of mission folder names, or empty array if path doesn't exist.
export const listAvailableMissions = (missionsPath: string): string[] => {
    if (!existsSync(missionsPath)) {
        return []
    }
    return readdirSync(missionsPath, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort()
}

// Reads mission JSON files from missionFolderPath and campaign JSON files from campaignFolderPath,
// loads them into the engine with campaign data merged first, then finalizes loading.
export const loadMissionFromFolder = (
    engine: MissionEngine,
    campaignFolderPath: string,
    missionFolderPath: string
): { isValid: boolean; errors: string[] } => {
    const readJson = (folderPath: string, filename: string): unknown =>
        JSON.parse(readFileSync(join(folderPath, filename), "utf-8"))

    const loadResult = engine.loadMissionFromJson({
        squaddies: readJson(missionFolderPath, "squaddies.json"),
        attributeSheets: readJson(missionFolderPath, "attributeSheets.json"),
        items: readJson(missionFolderPath, "items.json"),
        maps: readJson(missionFolderPath, "maps.json"),
        actions: readJson(missionFolderPath, "actions.json"),
        missionState: readJson(missionFolderPath, "missionState.json"),
        campaignData: {
            squaddies: readJson(campaignFolderPath, "squaddies.json"),
            attributeSheets: readJson(campaignFolderPath, "attributeSheets.json"),
            items: readJson(campaignFolderPath, "items.json"),
            actions: readJson(campaignFolderPath, "actions.json"),
        },
    })
    if (!loadResult.isValid) {
        return loadResult
    }
    return engine.finalizeLoadingMission()
}

// Reads movies.json from campaignFolderPath and returns the parsed movies.
// Returns an empty array if movies.json does not exist.
export const loadMoviesFromFolder = (campaignFolderPath: string): Movie[] => {
    const moviesPath = join(campaignFolderPath, "movies.json")
    if (!existsSync(moviesPath)) return []
    const json = JSON.parse(readFileSync(moviesPath, "utf-8"))
    return MovieCollectionLoader.loadFromJSON(json)
}

// Reads army.json from campaignFolderPath and builds the persistent Campaign Army roster.
// Returns an empty ArmyManager if army.json does not exist (missions without campaign
// squaddie deployment don't need one).
export const loadArmyFromFolder = (campaignFolderPath: string): ArmyManager => {
    const armyManager = new ArmyManager(ArmyService.new())

    const armyPath = join(campaignFolderPath, "army.json")
    if (!existsSync(armyPath)) return armyManager

    const json = JSON.parse(readFileSync(armyPath, "utf-8"))
    const rosterData = Array.isArray(json) ? json : json.data
    const errors = armyManager.addSquaddiesFromJson(rosterData)
    if (errors.length > 0) {
        console.warn(`[campaignLoader] Warnings loading ${armyPath}:`)
        errors.forEach((e) => console.warn(` - ${e}`))
    }

    return armyManager
}
