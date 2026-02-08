import { defineConfig } from "vitest/config"

export default defineConfig({
    test: {
        exclude: ["logic/**", "node_modules/**", "dist/**"],
    },
})
