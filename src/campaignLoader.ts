import { readdirSync, readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import type { Movie } from "../logic/src/movie/movie.js"
import type { MissionEngine } from "../logic/src/mission/missionEngine/missionEngine.js"
import { MovieCollectionLoader } from "./movieCollectionLoader.js"
import { ArmyManager } from "../logic/src/campaign/army/armyManager.js"
import { ArmyService } from "../logic/src/campaign/army/army.js"
import { GlossaryManager } from "../logic/src/campaign/glossary/glossaryManager.js"
import { GlossaryCollectionService } from "../logic/src/campaign/glossary/glossaryCollection.js"
import { loadResourceManifestFromJSON } from "../logic/src/resource/resourceManifestLoader.js"
import type { ResourceManifestCollection } from "../logic/src/resource/resourceManifestCollection.js"

export const CAMPAIGN_DATA_FOLDER = "campaignData"
export const CAMPAIGNS_SUBFOLDER = "campaigns"
export const MISSIONS_SUBFOLDER = "missions"
const RESOURCES_SUBFOLDER = "resources"
const RESOURCE_MANIFEST_FILENAME = "resources.json"

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

// Returns one ResourceManifestCollection per category subfolder (e.g. resources/dialogPortraits/resources.json,
// resources/backgrounds/resources.json) found under folderPath/resources. Categories are not merged
// into a single collection here: resolveResourceManifestEntry's first-match-wins scan over the full
// ordered array (see loadResourceManifestsFromFolder) is what decides precedence when the same id
// appears in more than one collection, so that's the only place precedence should be decided.
// Only the content manifest is read, never the parallel media manifest (filepath/format) the logic
// submodule also defines: this CLI has no renderer to point a filepath at, so the only thing it ever
// needs from a resource entry is its localized description, used as the text shown in place of an image.
const loadResourceManifestCollectionsFromLevel = (
    folderPath: string
): ResourceManifestCollection[] => {
    const resourcesPath = join(folderPath, RESOURCES_SUBFOLDER)
    if (!existsSync(resourcesPath)) return []

    const categoryFolders = readdirSync(resourcesPath, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort()

    return categoryFolders
        .map((categoryFolder) =>
            join(resourcesPath, categoryFolder, RESOURCE_MANIFEST_FILENAME)
        )
        .filter((resourcesJsonPath) => existsSync(resourcesJsonPath))
        .map((resourcesJsonPath) => {
            const parsed = JSON.parse(readFileSync(resourcesJsonPath, "utf-8"))
            const { collection, errors } = loadResourceManifestFromJSON(parsed)
            if (errors.length > 0) {
                console.warn(
                    `[campaignLoader] Warnings loading ${resourcesJsonPath}:`
                )
                errors.forEach((error) => console.warn(` - ${error}`))
            }
            return collection
        })
}

// Loads resource content manifests from campaignFolderPath/resources, and from
// missionFolderPath/resources if given, returned mission-first so resolveResourceManifestEntry's
// first-match-wins scan lets a mission override a campaign-level resource of the same id.
export const loadResourceManifestsFromFolder = (
    campaignFolderPath: string,
    missionFolderPath?: string
): ResourceManifestCollection[] => [
    ...(missionFolderPath
        ? loadResourceManifestCollectionsFromLevel(missionFolderPath)
        : []),
    ...loadResourceManifestCollectionsFromLevel(campaignFolderPath),
]

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
