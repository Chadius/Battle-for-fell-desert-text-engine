import type { Movie } from "../logic/src/movie/movie.js"
import { MovieService } from "../logic/src/movie/movie.js"
import { MovieSceneType } from "../logic/src/movie/movieScene.js"
import type { LocalizedText } from "../logic/src/movie/movieSceneConversation.js"
// Validates that a value is a LocalizedText object: Record<string, { text: string }>
const isLocalizedText = (value: unknown): value is LocalizedText => {
    if (typeof value !== "object" || value === null) return false
    return Object.values(value).every(
        (entry) =>
            typeof entry === "object" &&
            entry !== null &&
            "text" in entry &&
            typeof (entry as Record<string, unknown>).text === "string"
    )
}

const parseObject = (raw: unknown, path: string): Record<string, unknown> => {
    if (typeof raw !== "object" || raw === null)
        throw new Error(
            `[MovieCollectionLoader.loadFromJSON] "${path}" must be an object`
        )
    return raw as Record<string, unknown>
}

const parseArray = (raw: unknown, path: string): unknown[] => {
    if (!Array.isArray(raw))
        throw new Error(
            `[MovieCollectionLoader.loadFromJSON] "${path}" must be an array`
        )
    return raw
}

const parseLocalizedText = (raw: unknown, path: string): LocalizedText => {
    if (!isLocalizedText(raw))
        throw new Error(
            `[MovieCollectionLoader.loadFromJSON] "${path}" must be a LocalizedText object`
        )
    return raw
}

const parseString = (raw: unknown, path: string): string => {
    if (typeof raw !== "string")
        throw new Error(
            `[MovieCollectionLoader.loadFromJSON] "${path}" must be a string`
        )
    return raw
}

const parseOptionalString = (
    raw: unknown,
    path: string
): string | undefined => {
    if (raw == undefined) return undefined
    return parseString(raw, path)
}

// Parses a single DIALOG or DECISION line from the JSON
const parseLine = (raw: unknown, path: string) => {
    const obj = parseObject(raw, path)
    const type = parseString(obj.type, `${path}.type`)

    if (type === "DIALOG") {
        return {
            type: "DIALOG" as const,
            speakerId: parseOptionalString(obj.speakerId, `${path}.speakerId`),
            text: parseLocalizedText(obj.text, `${path}.text`),
        }
    }
    if (type === "DECISION") {
        const options = parseArray(obj.options, `${path}.options`)
        return {
            type: "DECISION" as const,
            prompt: parseLocalizedText(obj.prompt, `${path}.prompt`),
            options: options.map((opt: unknown, i: number) => {
                const o = parseObject(opt, `${path}.options[${i}]`)
                return {
                    decisionId: parseString(o.decisionId, `${path}.options[${i}].decisionId`),
                    text: parseLocalizedText(o.text, `${path}.options[${i}].text`),
                    nextSceneId: parseOptionalString(o.nextSceneId, `${path}.options[${i}].nextSceneId`),
                }
            }),
        }
    }
    throw new Error(
        `[MovieCollectionLoader.loadFromJSON] "${path}.type" has unknown value "${type}"`
    )
}

// Parses one entry from the "data" array into a Movie
const parseMovie = (raw: unknown, index: number): Movie => {
    const path = `data[${index}]`
    const obj = parseObject(raw, path)

    const id = parseString(obj.id, `${path}.id`)
    const firstSceneId = parseString(obj.firstSceneId, `${path}.firstSceneId`)
    const scenes = parseArray(obj.scenes, `${path}.scenes`).map((rawScene: unknown, si: number) => {
        const scenePath = `${path}.scenes[${si}]`
        const scene = parseObject(rawScene, scenePath)
        const sceneType = parseString(scene.type, `${scenePath}.type`)
        const sceneId = parseString(scene.id, `${scenePath}.id`)
        const nextSceneId = parseOptionalString(scene.nextSceneId, `${scenePath}.nextSceneId`)

        if (sceneType === MovieSceneType.CONVERSATION) {
            const lines = parseArray(scene.lines, `${scenePath}.lines`)
            return {
                type: MovieSceneType.CONVERSATION,
                data: {
                    id: sceneId,
                    nextSceneId,
                    lines: lines.map((l: unknown, li: number) =>
                        parseLine(l, `${scenePath}.lines[${li}]`)
                    ),
                },
            } as const
        }

        if (sceneType === MovieSceneType.IMAGE) {
            return {
                type: MovieSceneType.IMAGE,
                data: {
                    id: sceneId,
                    resourceManifestEntryId: parseString(
                        scene.resourceManifestEntryId,
                        `${scenePath}.resourceManifestEntryId`
                    ),
                    nextSceneId,
                    caption: parseOptionalString(scene.caption, `${scenePath}.caption`),
                    introTransition: undefined,
                    exitTransition: undefined,
                    manualScrollEnabled: false,
                    autoScroll: undefined,
                },
            } as const
        }

        throw new Error(
            `[MovieCollectionLoader.loadFromJSON] "${scenePath}.type" has unknown value "${sceneType}"`
        )
    })

    const movie: Movie = { id, firstSceneId, scenes }
    const { isValid, errors } = MovieService.validate(movie)
    if (!isValid)
        throw new Error(
            `[MovieCollectionLoader.loadFromJSON] Movie "${id}" failed validation: ${errors.join("; ")}`
        )
    return movie
}

export const MovieCollectionLoader = {
    // Parses a movies.json file with format: { "data": [ ...movies ] }
    loadFromJSON: (json: unknown): Movie[] => {
        const root = parseObject(json, "root")
        const data = parseArray(root.data, "root.data")
        return data.map((entry, i) => parseMovie(entry, i))
    },
}

