import { z } from "zod"
import type { Movie } from "../logic/src/movie/movie.js"
import { MovieLoader } from "../logic/src/movie/movieLoader.js"

const moviesFileSchema = z.object({ data: z.array(z.unknown()) })

export const MovieCollectionLoader = {
    loadFromJSON: (json: unknown): Movie[] => {
        const { data } = moviesFileSchema.parse(json)
        return data.map((entry) => MovieLoader.loadFromJSON(entry))
    },
}
