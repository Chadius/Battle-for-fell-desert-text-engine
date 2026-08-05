import { readdirSync, readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import type { Movie } from "../logic/src/movie/movie.js"
import type { MissionEngine } from "../logic/src/mission/missionEngine/missionEngine.js"
import { MovieCollectionLoader } from "./movieCollectionLoader.js"
import { ArmyManager } from "../logic/src/campaign/army/armyManager.js"
import { ArmyService } from "../logic/src/campaign/army/army.js"
import { GlossaryManager } from "../logic/src/campaign/glossary/glossaryManager.js"
import { GlossaryCollectionService } from "../logic/src/campaign/glossary/glossaryCollection.js"

export const CAMPAIGN_DATA_FOLDER = "campaignData"
export const CAMPAIGNS_SUBFOLDER = "campaigns"
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

// Returns sorted list of campaign folder names, or empty array if path doesn't exist.
export const listAvailableCampaigns = (campaignsPath: string): string[] => {
    if (!existsSync(campaignsPath)) {
        return []
    }
    return readdirSync(campaignsPath, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort()
}

// Reads campaign.json's displayName for the given locale. Falls back to folderName if
// campaign.json is missing or has no displayName entry for that locale.
export const loadCampaignDisplayName = (
    campaignFolderPath: string,
    folderName: string,
    locale = "en-US"
): string => {
    const campaignJsonPath = join(campaignFolderPath, "campaign.json")
    if (!existsSync(campaignJsonPath)) return folderName

    const parsed = JSON.parse(readFileSync(campaignJsonPath, "utf-8"))
    return parsed?.displayName?.[locale] ?? folderName
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

// Reads movies.json from campaignFolderPath, and from missionFolderPath if given, and returns
// the combined parsed movies. Missions can define their own movies.json for cutscenes that only
// make sense within that mission, alongside campaign-wide movies (e.g. shared victory/defeat
// scenes) defined at the campaign root. Returns an empty array if neither file exists.
export const loadMoviesFromFolder = (
    campaignFolderPath: string,
    missionFolderPath?: string
): Movie[] => {
    const readMoviesFromFolder = (folderPath: string): Movie[] => {
        const moviesPath = join(folderPath, "movies.json")
        if (!existsSync(moviesPath)) return []
        const json = JSON.parse(readFileSync(moviesPath, "utf-8"))
        return MovieCollectionLoader.loadFromJSON(json)
    }

    return [
        ...readMoviesFromFolder(campaignFolderPath),
        ...(missionFolderPath ? readMoviesFromFolder(missionFolderPath) : []),
    ]
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
        errors.forEach((error) => console.warn(` - ${error}`))
    }

    return armyManager
}

// Reads glossary.json from campaignFolderPath and builds a GlossaryManager of term definitions.
// Returns an empty GlossaryManager if glossary.json does not exist (missions without a glossary
// still play normally; the G command just has nothing to show).
export const loadGlossaryFromFolder = (campaignFolderPath: string): GlossaryManager => {
    const glossaryManager = new GlossaryManager(GlossaryCollectionService.new())

    const glossaryPath = join(campaignFolderPath, "glossary.json")
    if (!existsSync(glossaryPath)) return glossaryManager

    const parsedGlossary = JSON.parse(readFileSync(glossaryPath, "utf-8"))
    const termsData = parsedGlossary.data ?? parsedGlossary
    const errors = glossaryManager.addTermsFromJson(termsData)
    if (errors.length > 0) {
        console.warn(`[campaignLoader] Warnings loading ${glossaryPath}:`)
        errors.forEach((error) => console.warn(` - ${error}`))
    }

    return glossaryManager
}
