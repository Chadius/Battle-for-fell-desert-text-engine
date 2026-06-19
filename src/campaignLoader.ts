import { readdirSync, readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import type { MissionEngine } from "../logic/src/mission/missionEngine/missionEngine.js"
import { MovieCollectionLoader } from "./movieCollectionLoader.js"

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

// Reads movies.json from campaignFolderPath and registers each movie with the engine.
// Returns silently if movies.json does not exist.
export const loadMoviesFromFolder = (
    engine: MissionEngine,
    campaignFolderPath: string
): void => {
    const moviesPath = join(campaignFolderPath, "movies.json")
    if (!existsSync(moviesPath)) return
    const json = JSON.parse(readFileSync(moviesPath, "utf-8"))
    const movies = MovieCollectionLoader.loadFromJSON(json)
    movies.forEach((movie) => engine.registerMovie(movie))
}
