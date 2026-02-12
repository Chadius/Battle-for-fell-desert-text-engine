import { describe, it, expect } from "vitest"
import {
    renderMap,
    terrainToSymbol,
    buildSquaddieLabels,
    affiliationDisplayName,
    type MapRenderInfo,
} from "./mapRenderer.js"
import type { MapOverview } from "../logic/src/mission/missionEngine/missionEngine.js"
import { SquaddieAffiliation } from "../logic/src/affiliation/affiliation.js"

describe("mapRenderer", () => {
    describe("terrainToSymbol", () => {
        it("returns . for normal terrain (cost=1, canStop=true)", () => {
            expect(terrainToSymbol(1, true)).toBe(".")
        })

        it("returns ~ for rough terrain (cost=2, canStop=true)", () => {
            expect(terrainToSymbol(2, true)).toBe("~")
        })

        it("returns _ for pit terrain (cost defined, canStop=false)", () => {
            expect(terrainToSymbol(1, false)).toBe("_")
        })

        it("returns # for wall terrain (cost undefined, canStop=false)", () => {
            expect(terrainToSymbol(undefined, false)).toBe("#")
        })
    })

    describe("affiliationDisplayName", () => {
        it("returns Player for PLAYER affiliation", () => {
            expect(affiliationDisplayName(SquaddieAffiliation.PLAYER)).toBe(
                "Player"
            )
        })

        it("returns Ally for ALLY affiliation", () => {
            expect(affiliationDisplayName(SquaddieAffiliation.ALLY)).toBe(
                "Ally"
            )
        })

        it("returns Enemy for ENEMY affiliation", () => {
            expect(affiliationDisplayName(SquaddieAffiliation.ENEMY)).toBe(
                "Enemy"
            )
        })

        it("returns None for NONE affiliation", () => {
            expect(affiliationDisplayName(SquaddieAffiliation.NONE)).toBe(
                "None"
            )
        })
    })

    describe("buildSquaddieLabels", () => {
        it("uses first character of outOfBattleSquaddieId uppercased", () => {
            const overview: MapOverview = {
                width: 2,
                height: 1,
                tiles: [
                    [
                        {
                            row: 0,
                            col: 0,
                            movementCost: 1,
                            canStop: true,
                            squaddieId: {
                                outOfBattleSquaddieId: "lini",
                                inBattleSquaddieId: 0,
                            },
                        },
                        {
                            row: 0,
                            col: 1,
                            movementCost: 1,
                            canStop: true,
                            squaddieId: undefined,
                        },
                    ],
                ],
            }

            const labels = buildSquaddieLabels(overview)
            expect(labels.get("lini")).toBe("L")
        })

        it("disambiguates squaddies that share a first letter", () => {
            const overview: MapOverview = {
                width: 2,
                height: 1,
                tiles: [
                    [
                        {
                            row: 0,
                            col: 0,
                            movementCost: 1,
                            canStop: true,
                            squaddieId: {
                                outOfBattleSquaddieId: "lini",
                                inBattleSquaddieId: 0,
                            },
                        },
                        {
                            row: 0,
                            col: 1,
                            movementCost: 1,
                            canStop: true,
                            squaddieId: {
                                outOfBattleSquaddieId: "largo",
                                inBattleSquaddieId: 1,
                            },
                        },
                    ],
                ],
            }

            const labels = buildSquaddieLabels(overview)
            const liniLabel = labels.get("lini")!
            const largoLabel = labels.get("largo")!
            expect(liniLabel).not.toBe(largoLabel)
            expect(liniLabel.length).toBeGreaterThanOrEqual(1)
            expect(largoLabel.length).toBeGreaterThanOrEqual(1)
        })
    })

    describe("renderMap", () => {
        it("renders a simple 1x1 map", () => {
            const overview: MapOverview = {
                width: 1,
                height: 1,
                tiles: [
                    [
                        {
                            row: 0,
                            col: 0,
                            movementCost: 1,
                            canStop: true,
                            squaddieId: undefined,
                        },
                    ],
                ],
            }

            const output = renderMap(overview)
            expect(output).toContain("Map: 1 columns x 1 rows")
            expect(output).toContain(".")
        })

        it("renders terrain symbols correctly", () => {
            const overview: MapOverview = {
                width: 4,
                height: 1,
                tiles: [
                    [
                        {
                            row: 0,
                            col: 0,
                            movementCost: 1,
                            canStop: true,
                            squaddieId: undefined,
                        },
                        {
                            row: 0,
                            col: 1,
                            movementCost: 2,
                            canStop: true,
                            squaddieId: undefined,
                        },
                        {
                            row: 0,
                            col: 2,
                            movementCost: 1,
                            canStop: false,
                            squaddieId: undefined,
                        },
                        {
                            row: 0,
                            col: 3,
                            movementCost: undefined,
                            canStop: false,
                            squaddieId: undefined,
                        },
                    ],
                ],
            }

            const output = renderMap(overview)
            expect(output).toContain(". ~ _ #")
        })

        it("shows squaddie labels instead of terrain at squaddie positions", () => {
            const overview: MapOverview = {
                width: 3,
                height: 1,
                tiles: [
                    [
                        {
                            row: 0,
                            col: 0,
                            movementCost: 1,
                            canStop: true,
                            squaddieId: {
                                outOfBattleSquaddieId: "lini",
                                inBattleSquaddieId: 0,
                            },
                        },
                        {
                            row: 0,
                            col: 1,
                            movementCost: 1,
                            canStop: true,
                            squaddieId: undefined,
                        },
                        {
                            row: 0,
                            col: 2,
                            movementCost: 1,
                            canStop: true,
                            squaddieId: {
                                outOfBattleSquaddieId: "slither-demon",
                                inBattleSquaddieId: 1,
                            },
                        },
                    ],
                ],
            }

            const output = renderMap(overview)
            expect(output).toContain("L . S")
        })

        it("indents odd rows by 1 space for hex offset rendering", () => {
            const overview: MapOverview = {
                width: 2,
                height: 2,
                tiles: [
                    [
                        {
                            row: 0,
                            col: 0,
                            movementCost: 1,
                            canStop: true,
                            squaddieId: undefined,
                        },
                        {
                            row: 0,
                            col: 1,
                            movementCost: 1,
                            canStop: true,
                            squaddieId: undefined,
                        },
                    ],
                    [
                        {
                            row: 1,
                            col: 0,
                            movementCost: 2,
                            canStop: true,
                            squaddieId: undefined,
                        },
                        {
                            row: 1,
                            col: 1,
                            movementCost: 2,
                            canStop: true,
                            squaddieId: undefined,
                        },
                    ],
                ],
            }

            const output = renderMap(overview)
            const lines = output.split("\n")
            const gridLines = lines.filter(
                (line) =>
                    (line.startsWith(".") ||
                        line.startsWith("~") ||
                        line.startsWith(" ")) &&
                    !line.startsWith("  ")
            )
            let evenRowStartsWithoutIndent = gridLines[0];
            expect(evenRowStartsWithoutIndent).toBe(". .")
            let oddRowStartsWithIndent = gridLines[1];
            expect(oddRowStartsWithIndent).toBe(" ~ ~")
        })

        it("includes a legend section", () => {
            const overview: MapOverview = {
                width: 1,
                height: 1,
                tiles: [
                    [
                        {
                            row: 0,
                            col: 0,
                            movementCost: 1,
                            canStop: true,
                            squaddieId: undefined,
                        },
                    ],
                ],
            }

            const output = renderMap(overview)
            expect(output).toContain("Legend:")
            expect(output).toContain(". = Normal terrain")
            expect(output).toContain("~ = Rough terrain")
            expect(output).toContain("_ = Pit (cannot stop)")
            expect(output).toContain("# = Wall (impassable)")
        })

        it("includes a squaddies section listing all squaddies", () => {
            const overview: MapOverview = {
                width: 2,
                height: 1,
                tiles: [
                    [
                        {
                            row: 0,
                            col: 0,
                            movementCost: 1,
                            canStop: true,
                            squaddieId: {
                                outOfBattleSquaddieId: "lini",
                                inBattleSquaddieId: 0,
                            },
                        },
                        {
                            row: 0,
                            col: 1,
                            movementCost: 1,
                            canStop: true,
                            squaddieId: {
                                outOfBattleSquaddieId: "slither-demon",
                                inBattleSquaddieId: 1,
                            },
                        },
                    ],
                ],
            }

            const output = renderMap(overview)
            expect(output).toContain("Squaddies:")
            expect(output).toContain("L = lini (0,0)")
            expect(output).toContain("S = slither-demon (0,1)")
        })

        it("renders the test harness map correctly", () => {
            const overview: MapOverview = {
                width: 5,
                height: 4,
                tiles: [
                    [
                        {
                            row: 0,
                            col: 0,
                            movementCost: 1,
                            canStop: true,
                            squaddieId: {
                                outOfBattleSquaddieId: "lini",
                                inBattleSquaddieId: 0,
                            },
                        },
                        {
                            row: 0,
                            col: 1,
                            movementCost: 1,
                            canStop: true,
                            squaddieId: undefined,
                        },
                        {
                            row: 0,
                            col: 2,
                            movementCost: 2,
                            canStop: true,
                            squaddieId: undefined,
                        },
                        {
                            row: 0,
                            col: 3,
                            movementCost: 1,
                            canStop: true,
                            squaddieId: undefined,
                        },
                        {
                            row: 0,
                            col: 4,
                            movementCost: 1,
                            canStop: true,
                            squaddieId: undefined,
                        },
                    ],
                    [
                        {
                            row: 1,
                            col: 0,
                            movementCost: 1,
                            canStop: true,
                            squaddieId: undefined,
                        },
                        {
                            row: 1,
                            col: 1,
                            movementCost: 1,
                            canStop: false,
                            squaddieId: undefined,
                        },
                        {
                            row: 1,
                            col: 2,
                            movementCost: 1,
                            canStop: true,
                            squaddieId: undefined,
                        },
                        {
                            row: 1,
                            col: 3,
                            movementCost: undefined,
                            canStop: false,
                            squaddieId: undefined,
                        },
                        {
                            row: 1,
                            col: 4,
                            movementCost: 1,
                            canStop: true,
                            squaddieId: undefined,
                        },
                    ],
                    [
                        {
                            row: 2,
                            col: 0,
                            movementCost: 1,
                            canStop: true,
                            squaddieId: undefined,
                        },
                        {
                            row: 2,
                            col: 1,
                            movementCost: 1,
                            canStop: true,
                            squaddieId: undefined,
                        },
                        {
                            row: 2,
                            col: 2,
                            movementCost: 1,
                            canStop: true,
                            squaddieId: undefined,
                        },
                        {
                            row: 2,
                            col: 3,
                            movementCost: 1,
                            canStop: true,
                            squaddieId: undefined,
                        },
                        {
                            row: 2,
                            col: 4,
                            movementCost: 2,
                            canStop: true,
                            squaddieId: undefined,
                        },
                    ],
                    [
                        {
                            row: 3,
                            col: 0,
                            movementCost: 2,
                            canStop: true,
                            squaddieId: undefined,
                        },
                        {
                            row: 3,
                            col: 1,
                            movementCost: 1,
                            canStop: true,
                            squaddieId: undefined,
                        },
                        {
                            row: 3,
                            col: 2,
                            movementCost: 1,
                            canStop: false,
                            squaddieId: undefined,
                        },
                        {
                            row: 3,
                            col: 3,
                            movementCost: 1,
                            canStop: true,
                            squaddieId: undefined,
                        },
                        {
                            row: 3,
                            col: 4,
                            movementCost: 1,
                            canStop: true,
                            squaddieId: {
                                outOfBattleSquaddieId: "slither-demon",
                                inBattleSquaddieId: 1,
                            },
                        },
                    ],
                ],
            }

            const output = renderMap(overview)
            expect(output).toContain("Map: 5 columns x 4 rows")
            expect(output).toContain("L = lini (0,0)")
            expect(output).toContain("S = slither-demon (3,4)")

            const lines = output.split("\n")
            const headerIndex = lines.findIndex((line) =>
                line.startsWith("Map:")
            )
            expect(lines[headerIndex + 1]).toBe("L . ~ . .")
            expect(lines[headerIndex + 2]).toBe(" . _ . # .")
            expect(lines[headerIndex + 3]).toBe(". . . . ~")
            expect(lines[headerIndex + 4]).toBe(" ~ . _ . S")
        })

        it("shows turn header with affiliation phase when renderInfo is provided", () => {
            const overview: MapOverview = {
                width: 1,
                height: 1,
                tiles: [
                    [
                        {
                            row: 0,
                            col: 0,
                            movementCost: 1,
                            canStop: true,
                            squaddieId: undefined,
                        },
                    ],
                ],
            }

            const renderInfo: MapRenderInfo = {
                turnNumber: 0,
                currentAffiliation: SquaddieAffiliation.PLAYER,
                squaddieAffiliations: new Map(),
            }

            const output = renderMap(overview, renderInfo)
            const lines = output.split("\n")
            expect(lines[0]).toBe("Turn 0 - Player Phase")
            expect(lines[1]).toContain("Map:")
        })

        it("shows turn header without phase when currentAffiliation is undefined", () => {
            const overview: MapOverview = {
                width: 1,
                height: 1,
                tiles: [
                    [
                        {
                            row: 0,
                            col: 0,
                            movementCost: 1,
                            canStop: true,
                            squaddieId: undefined,
                        },
                    ],
                ],
            }

            const renderInfo: MapRenderInfo = {
                turnNumber: 2,
                currentAffiliation: undefined,
                squaddieAffiliations: new Map(),
            }

            const output = renderMap(overview, renderInfo)
            const lines = output.split("\n")
            expect(lines[0]).toBe("Turn 2")
            expect(lines[1]).toContain("Map:")
        })

        it("groups squaddies under their affiliation headers", () => {
            const overview: MapOverview = {
                width: 2,
                height: 1,
                tiles: [
                    [
                        {
                            row: 0,
                            col: 0,
                            movementCost: 1,
                            canStop: true,
                            squaddieId: {
                                outOfBattleSquaddieId: "lini",
                                inBattleSquaddieId: 0,
                            },
                        },
                        {
                            row: 0,
                            col: 1,
                            movementCost: 1,
                            canStop: true,
                            squaddieId: {
                                outOfBattleSquaddieId: "slither-demon",
                                inBattleSquaddieId: 1,
                            },
                        },
                    ],
                ],
            }

            const renderInfo: MapRenderInfo = {
                turnNumber: 0,
                currentAffiliation: SquaddieAffiliation.PLAYER,
                squaddieAffiliations: new Map([
                    ["lini", SquaddieAffiliation.PLAYER],
                    ["slither-demon", SquaddieAffiliation.ENEMY],
                ]),
            }

            const output = renderMap(overview, renderInfo)
            expect(output).toContain("Squaddies:")
            expect(output).toContain("  Player:")
            expect(output).toContain("    L = lini (0,0)")
            expect(output).toContain("  Enemy:")
            expect(output).toContain("    S = slither-demon (0,1)")
        })

        it("shows only affiliations that have squaddies", () => {
            const overview: MapOverview = {
                width: 1,
                height: 1,
                tiles: [
                    [
                        {
                            row: 0,
                            col: 0,
                            movementCost: 1,
                            canStop: true,
                            squaddieId: {
                                outOfBattleSquaddieId: "lini",
                                inBattleSquaddieId: 0,
                            },
                        },
                    ],
                ],
            }

            const renderInfo: MapRenderInfo = {
                turnNumber: 0,
                currentAffiliation: SquaddieAffiliation.PLAYER,
                squaddieAffiliations: new Map([
                    ["lini", SquaddieAffiliation.PLAYER],
                ]),
            }

            const output = renderMap(overview, renderInfo)
            expect(output).toContain("  Player:")
            expect(output).not.toContain("  Enemy:")
            expect(output).not.toContain("  Ally:")
            expect(output).not.toContain("  None:")
        })

        it("preserves group order: Player before Enemy", () => {
            const overview: MapOverview = {
                width: 2,
                height: 1,
                tiles: [
                    [
                        {
                            row: 0,
                            col: 0,
                            movementCost: 1,
                            canStop: true,
                            squaddieId: {
                                outOfBattleSquaddieId: "slither-demon",
                                inBattleSquaddieId: 1,
                            },
                        },
                        {
                            row: 0,
                            col: 1,
                            movementCost: 1,
                            canStop: true,
                            squaddieId: {
                                outOfBattleSquaddieId: "lini",
                                inBattleSquaddieId: 0,
                            },
                        },
                    ],
                ],
            }

            const renderInfo: MapRenderInfo = {
                turnNumber: 0,
                currentAffiliation: SquaddieAffiliation.PLAYER,
                squaddieAffiliations: new Map([
                    ["slither-demon", SquaddieAffiliation.ENEMY],
                    ["lini", SquaddieAffiliation.PLAYER],
                ]),
            }

            const output = renderMap(overview, renderInfo)
            const playerIndex = output.indexOf("  Player:")
            const enemyIndex = output.indexOf("  Enemy:")
            expect(playerIndex).toBeLessThan(enemyIndex)
        })

        it("falls back to flat list when renderInfo is not provided", () => {
            const overview: MapOverview = {
                width: 2,
                height: 1,
                tiles: [
                    [
                        {
                            row: 0,
                            col: 0,
                            movementCost: 1,
                            canStop: true,
                            squaddieId: {
                                outOfBattleSquaddieId: "lini",
                                inBattleSquaddieId: 0,
                            },
                        },
                        {
                            row: 0,
                            col: 1,
                            movementCost: 1,
                            canStop: true,
                            squaddieId: {
                                outOfBattleSquaddieId: "slither-demon",
                                inBattleSquaddieId: 1,
                            },
                        },
                    ],
                ],
            }

            const output = renderMap(overview)
            expect(output).toContain("Squaddies:")
            expect(output).toContain("  L = lini (0,0)")
            expect(output).toContain("  S = slither-demon (0,1)")
            expect(output).not.toContain("  Player:")
            expect(output).not.toContain("  Enemy:")
        })

        it("omits the squaddies section when there are no squaddies", () => {
            const overview: MapOverview = {
                width: 1,
                height: 1,
                tiles: [
                    [
                        {
                            row: 0,
                            col: 0,
                            movementCost: 1,
                            canStop: true,
                            squaddieId: undefined,
                        },
                    ],
                ],
            }

            const output = renderMap(overview)
            expect(output).not.toContain("Squaddies:")
        })
    })
})
