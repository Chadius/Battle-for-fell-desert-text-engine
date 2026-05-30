import { readdirSync, readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import type { MissionEngine } from "../logic/src/mission/missionEngine/missionEngine.js"

export const CAMPAIGN_DATA_FOLDER = "campaignData"
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

// Reads the six JSON files from folderPath, loads them into the engine, and finalizes loading.
export const loadMissionFromFolder = (
    engine: MissionEngine,
    folderPath: string
): { isValid: boolean; errors: string[] } => {
    const readJson = (filename: string): unknown =>
        JSON.parse(readFileSync(join(folderPath, filename), "utf-8"))

    const loadResult = engine.loadMissionFromJson({
        squaddies: readJson("squaddies.json"),
        attributeSheets: readJson("attributeSheets.json"),
        items: readJson("items.json"),
        maps: readJson("maps.json"),
        actions: readJson("actions.json"),
        missionState: readJson("missionState.json"),
    })
    if (!loadResult.isValid) {
        return loadResult
    }
    return engine.finalizeLoadingMission()
}
