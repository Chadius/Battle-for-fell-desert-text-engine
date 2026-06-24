import type { Movie } from "../logic/src/movie/movie.js"
import { MovieLoader } from "../logic/src/movie/movieLoader.js"

export const MovieCollectionLoader = {
    // Parses a movies.json file with format: { "data": [ ...movies ] }
    loadFromJSON: (json: unknown): Movie[] => {
        if (typeof json !== "object" || json === null)
            throw new Error(
                "[MovieCollectionLoader.loadFromJSON] root must have a 'data' array"
            )
        const record = json as Record<string, unknown>
        if (!Array.isArray(record.data))
            throw new Error(
                "[MovieCollectionLoader.loadFromJSON] root must have a 'data' array"
            )
        return (record.data as unknown[]).map((entry) => MovieLoader.loadFromJSON(entry))
    },
}
