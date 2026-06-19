import { defineConfig } from "vitest/config"

export default defineConfig({
    test: {
        exclude: ["logic/**", "campaignData/**", "node_modules/**", "dist/**"],
    },
})
