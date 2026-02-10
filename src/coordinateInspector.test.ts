import { describe, it, expect } from "vitest"
import { parseCoordinate, inspectCoordinate, terrainName } from "./coordinateInspector.js"
import { MissionEngineTestHarness } from "../logic/src/testUtils/mission/missionEngineTestHarness.js"

describe("coordinateInspector", () => {
    describe("parseCoordinate", () => {
        it("parses comma-separated coordinates with spaces", () => {
            const result = parseCoordinate("2, 0")
            expect(result).toEqual({ row: 2, col: 0 })
        })

        it("parses space-separated coordinates", () => {
            const result = parseCoordinate("3 5")
            expect(result).toEqual({ row: 3, col: 5 })
        })

        it("parses parenthesized comma-separated coordinates", () => {
            const result = parseCoordinate("(6, 10)")
            expect(result).toEqual({ row: 6, col: 10 })
        })

        it("parses parenthesized space-separated coordinates", () => {
            const result = parseCoordinate("(1 2)")
            expect(result).toEqual({ row: 1, col: 2 })
        })

        it("returns undefined for non-coordinate input", () => {
            expect(parseCoordinate("hello")).toBeUndefined()
        })

        it("returns undefined for a single number", () => {
            expect(parseCoordinate("5")).toBeUndefined()
        })
    })

    describe("terrainName", () => {
        it("returns Standard for movementCost 1 and canStop true", () => {
            expect(terrainName(1, true)).toBe("Standard")
        })

        it("returns Difficult for movementCost greater than 1 and canStop true", () => {
            expect(terrainName(2, true)).toBe("Difficult")
        })

        it("returns Pit for canStop false with defined movementCost", () => {
            expect(terrainName(1, false)).toBe("Pit")
        })

        it("returns Wall for undefined movementCost", () => {
            expect(terrainName(undefined, false)).toBe("Wall")
        })
    })

    describe("inspectCoordinate", () => {
        it("returns off-map message for coordinates outside the map", () => {
            const engine = new MissionEngineTestHarness()
            const result = inspectCoordinate(engine, { row: 10, col: 10 })
            expect(result).toBe(
                "(10,10) is off map (rows less than 4 and columns less than 5 are valid.)"
            )
        })

        it("returns Standard terrain for a standard tile", () => {
            const engine = new MissionEngineTestHarness()
            // row 0, col 1 is standard terrain (movementCost=1, canStop=true)
            const result = inspectCoordinate(engine, { row: 0, col: 1 })
            expect(result).toBe("(0,1): Standard")
        })

        it("returns Difficult terrain for a difficult tile", () => {
            const engine = new MissionEngineTestHarness()
            // row 0, col 2 is difficult terrain (movementCost=2, canStop=true)
            const result = inspectCoordinate(engine, { row: 0, col: 2 })
            expect(result).toBe("(0,2): Difficult")
        })

        it("returns Pit terrain for a pit tile", () => {
            const engine = new MissionEngineTestHarness()
            // row 1, col 1 is a pit (movementCost=1, canStop=false)
            const result = inspectCoordinate(engine, { row: 1, col: 1 })
            expect(result).toBe("(1,1): Pit")
        })

        it("returns Wall terrain for a wall tile", () => {
            const engine = new MissionEngineTestHarness()
            // row 1, col 3 is a wall (movementCost=undefined, canStop=false)
            const result = inspectCoordinate(engine, { row: 1, col: 3 })
            expect(result).toBe("(1,3): Wall")
        })

        it("shows terrain and squaddie info when a squaddie is present", () => {
            const engine = new MissionEngineTestHarness()
            // lini is at row 0, col 0 on standard terrain
            const result = inspectCoordinate(engine, { row: 0, col: 0 })
            expect(result).toContain("(0,0): Standard")
            expect(result).toContain("Lini")
            expect(result).toContain("Hit Points:")
            expect(result).toContain("Action Points:")
        })

        it("shows only terrain info when no squaddie is present", () => {
            const engine = new MissionEngineTestHarness()
            // row 2, col 2 is standard terrain with no squaddie
            const result = inspectCoordinate(engine, { row: 2, col: 2 })
            expect(result).toBe("(2,2): Standard")
            expect(result).not.toContain("Hit Points:")
        })
    })
})
