import { describe, it, expect } from "vitest"
import {
    processCommand,
    InteractionPhase,
    transitionToNextPhase,
} from "./commandProcessor.js"
import type { CommandContext } from "./commandProcessor.js"
import { MissionEngineTestHarness } from "../logic/src/testUtils/mission/missionEngineTestHarness.js"
import { MissionAffiliationTurn } from "../logic/src/mission/missionTurn.js"

describe("processCommand", () => {
    describe("quit action", () => {
        it("returns quit when input is Q", () => {
            const result = processCommand("Q")
            expect(result.action).toBe("quit")
            expect(result.message).toBe("Goodbye!")
        })

        it("returns quit when input is lowercase q", () => {
            const result = processCommand("q")
            expect(result.action).toBe("quit")
            expect(result.message).toBe("Goodbye!")
        })

        it("returns quit when input has surrounding whitespace", () => {
            const result = processCommand("  Q  ")
            expect(result.action).toBe("quit")
            expect(result.message).toBe("Goodbye!")
        })
    })

    describe("echo action", () => {
        it("returns echo with the original input for normal text", () => {
            const result = processCommand("hello world")
            expect(result.action).toBe("echo")
            expect(result.message).toBe("You entered: hello world")
        })

        it("returns echo for empty input", () => {
            const result = processCommand("")
            expect(result.action).toBe("echo")
            expect(result.message).toBe("You entered: ")
        })
    })

    describe("showCommands action", () => {
        it("returns showCommands with all command descriptions when input is ?", () => {
            const result = processCommand("?")
            expect(result.action).toBe("showCommands")
            expect(result.message).toContain("M - Show the map")
            expect(result.message).toContain("row, col - Inspect a coordinate")
            expect(result.message).toContain("Q - Quit the game")
            expect(result.message).toContain("? - Show all commands")
        })

        it("returns showCommands when input has surrounding whitespace", () => {
            const result = processCommand(" ? ")
            expect(result.action).toBe("showCommands")
            expect(result.message).toContain("M - Show the map")
        })

        it("shows L command when a squaddie is selected", () => {
            const engine = new MissionEngineTestHarness()
            const context: CommandContext = {
                selectedSquaddieId: engine.getLiniSquaddieId(),
                interactionPhase: InteractionPhase.BROWSING,
                actingSquaddieId: undefined,
            }
            const result = processCommand("?", engine, context)
            expect(result.message).toContain("L - Look at selected squaddie")
        })

        it("does not show L command when no squaddie is selected", () => {
            const result = processCommand("?")
            expect(result.message).not.toContain("L - Look at selected squaddie")
        })

        it("shows W command in help text", () => {
            const result = processCommand("?")
            expect(result.message).toContain("W - Who can act this phase?")
        })

        it("shows P command in help text", () => {
            const result = processCommand("?")
            expect(result.message).toContain("P - Show current phase")
        })
    })

    describe("inspectCoordinate action", () => {
        it("returns terrain info for a valid coordinate", () => {
            const engine = new MissionEngineTestHarness()
            const result = processCommand("0, 1", engine)
            expect(result.action).toBe("inspectCoordinate")
            expect(result.message).toContain("(0,1): Standard")
        })

        it("returns off-map message for an out-of-bounds coordinate", () => {
            const engine = new MissionEngineTestHarness()
            const result = processCommand("10, 10", engine)
            expect(result.action).toBe("inspectCoordinate")
            expect(result.message).toContain("is off map")
        })

        it("returns an error message when engine is undefined", () => {
            const result = processCommand("0, 0")
            expect(result.action).toBe("inspectCoordinate")
            expect(result.message).toBe(
                "No engine available to inspect coordinates."
            )
        })

        it("falls through to echo for non-coordinate input", () => {
            const result = processCommand("hello world")
            expect(result.action).toBe("echo")
            expect(result.message).toBe("You entered: hello world")
        })

        it("sets updatedContext with squaddieId when a squaddie is at the coordinate", () => {
            const engine = new MissionEngineTestHarness()
            const result = processCommand("0, 0", engine)
            expect(result.updatedContext).toBeDefined()
            expect(result.updatedContext!.selectedSquaddieId).toEqual(
                engine.getLiniSquaddieId()
            )
            expect(result.updatedContext!.interactionPhase).toBe(
                InteractionPhase.BROWSING
            )
            expect(result.updatedContext!.actingSquaddieId).toBeUndefined()
        })

        it("clears updatedContext when no squaddie is at the coordinate", () => {
            const engine = new MissionEngineTestHarness()
            const result = processCommand("2, 2", engine)
            expect(result.updatedContext).toBeDefined()
            expect(result.updatedContext!.selectedSquaddieId).toBeUndefined()
            expect(result.updatedContext!.interactionPhase).toBe(
                InteractionPhase.BROWSING
            )
            expect(result.updatedContext!.actingSquaddieId).toBeUndefined()
        })

        it("clears updatedContext for off-map coordinates", () => {
            const engine = new MissionEngineTestHarness()
            const result = processCommand("10, 10", engine)
            expect(result.updatedContext).toBeDefined()
            expect(result.updatedContext!.selectedSquaddieId).toBeUndefined()
            expect(result.updatedContext!.interactionPhase).toBe(
                InteractionPhase.BROWSING
            )
            expect(result.updatedContext!.actingSquaddieId).toBeUndefined()
        })
    })

    describe("lookAtSquaddie action", () => {
        it("returns squaddie details when a squaddie is selected", () => {
            const engine = new MissionEngineTestHarness()
            const context: CommandContext = {
                selectedSquaddieId: engine.getLiniSquaddieId(),
                interactionPhase: InteractionPhase.BROWSING,
                actingSquaddieId: undefined,
            }
            const result = processCommand("L", engine, context)
            expect(result.action).toBe("lookAtSquaddie")
            expect(result.message).toContain("Lini")
        })

        it("returns error when no squaddie is selected", () => {
            const engine = new MissionEngineTestHarness()
            const result = processCommand("L", engine)
            expect(result.action).toBe("lookAtSquaddie")
            expect(result.message).toBe(
                "No squaddie selected. Inspect a coordinate with a squaddie first."
            )
        })

        it("returns error when engine is undefined", () => {
            const context: CommandContext = {
                selectedSquaddieId: {
                    inBattleSquaddieId: 0,
                    outOfBattleSquaddieId: "test",
                },
                interactionPhase: InteractionPhase.BROWSING,
                actingSquaddieId: undefined,
            }
            const result = processCommand("L", undefined, context)
            expect(result.action).toBe("lookAtSquaddie")
            expect(result.message).toBe(
                "No engine available to look at squaddie details."
            )
        })

        it("is case-insensitive", () => {
            const engine = new MissionEngineTestHarness()
            const context: CommandContext = {
                selectedSquaddieId: engine.getLiniSquaddieId(),
                interactionPhase: InteractionPhase.BROWSING,
                actingSquaddieId: undefined,
            }
            const result = processCommand("l", engine, context)
            expect(result.action).toBe("lookAtSquaddie")
            expect(result.message).toContain("Lini")
        })

        it("handles surrounding whitespace", () => {
            const engine = new MissionEngineTestHarness()
            const context: CommandContext = {
                selectedSquaddieId: engine.getLiniSquaddieId(),
                interactionPhase: InteractionPhase.BROWSING,
                actingSquaddieId: undefined,
            }
            const result = processCommand("  L  ", engine, context)
            expect(result.action).toBe("lookAtSquaddie")
            expect(result.message).toContain("Lini")
        })

        it("shows squaddie name and affiliation", () => {
            const engine = new MissionEngineTestHarness()
            const context: CommandContext = {
                selectedSquaddieId: engine.getLiniSquaddieId(),
                interactionPhase: InteractionPhase.BROWSING,
                actingSquaddieId: undefined,
            }
            const result = processCommand("L", engine, context)
            expect(result.message).toContain("Lini")
            expect(result.message).toContain("PLAYER")
        })

        it("shows hit points and action points", () => {
            const engine = new MissionEngineTestHarness()
            const context: CommandContext = {
                selectedSquaddieId: engine.getLiniSquaddieId(),
                interactionPhase: InteractionPhase.BROWSING,
                actingSquaddieId: undefined,
            }
            const result = processCommand("L", engine, context)
            expect(result.message).toContain("Hit Points:")
            expect(result.message).toContain("Action Points:")
        })

        it("does not show conditions section when squaddie has no conditions", () => {
            const engine = new MissionEngineTestHarness()
            const context: CommandContext = {
                selectedSquaddieId: engine.getLiniSquaddieId(),
                interactionPhase: InteractionPhase.BROWSING,
                actingSquaddieId: undefined,
            }
            const result = processCommand("L", engine, context)
            expect(result.message).not.toContain("Conditions:")
        })

        it("shows actions section with valid and invalid actions", () => {
            const engine = new MissionEngineTestHarness()
            const context: CommandContext = {
                selectedSquaddieId: engine.getLiniSquaddieId(),
                interactionPhase: InteractionPhase.BROWSING,
                actingSquaddieId: undefined,
            }
            const result = processCommand("L", engine, context)
            expect(result.message).toContain("Actions:")
        })

        it("shows End Turn and Move as valid actions", () => {
            const engine = new MissionEngineTestHarness()
            const context: CommandContext = {
                selectedSquaddieId: engine.getLiniSquaddieId(),
                interactionPhase: InteractionPhase.BROWSING,
                actingSquaddieId: undefined,
            }
            const result = processCommand("L", engine, context)
            expect(result.message).toContain("End Turn (all AP)")
            expect(result.message).toContain("Move")
        })

        it("shows Scimitar as invalid when no foes in range", () => {
            const engine = new MissionEngineTestHarness()
            const context: CommandContext = {
                selectedSquaddieId: engine.getLiniSquaddieId(),
                interactionPhase: InteractionPhase.BROWSING,
                actingSquaddieId: undefined,
            }
            const result = processCommand("L", engine, context)
            expect(result.message).toContain("Scimitar -")
        })
    })

    describe("showMap action", () => {
        it("returns showMap when input is M", () => {
            const engine = new MissionEngineTestHarness()
            const result = processCommand("M", engine)
            expect(result.action).toBe("showMap")
            expect(result.message).toContain("Map:")
        })

        it("returns showMap when input is lowercase m", () => {
            const engine = new MissionEngineTestHarness()
            const result = processCommand("m", engine)
            expect(result.action).toBe("showMap")
            expect(result.message).toContain("Map:")
        })

        it("returns showMap when input has surrounding whitespace", () => {
            const engine = new MissionEngineTestHarness()
            const result = processCommand("  M  ", engine)
            expect(result.action).toBe("showMap")
            expect(result.message).toContain("Map:")
        })

        it("returns an error message when engine is undefined", () => {
            const result = processCommand("M")
            expect(result.action).toBe("showMap")
            expect(result.message).toBe(
                "No engine available to display the map."
            )
        })

        it("renders the test harness map with squaddies", () => {
            const engine = new MissionEngineTestHarness()
            const result = processCommand("M", engine)
            expect(result.message).toContain("5 columns x 4 rows")
            expect(result.message).toContain("lini")
            expect(result.message).toContain("slither-demon")
        })

        it("includes turn header in map output", () => {
            const engine = new MissionEngineTestHarness()
            const result = processCommand("M", engine)
            expect(result.message).toContain("Turn 0")
        })

        it("groups squaddies by affiliation in map output", () => {
            const engine = new MissionEngineTestHarness()
            const result = processCommand("M", engine)
            expect(result.message).toContain("  Player:")
            expect(result.message).toContain("    L = lini")
            expect(result.message).toContain("  Enemy:")
            expect(result.message).toContain("    S = slither-demon")
        })
    })

    describe("listControllableSquaddies action", () => {
        it("returns listControllableSquaddies for W command", () => {
            const engine = new MissionEngineTestHarness()
            const result = processCommand("W", engine)
            expect(result.action).toBe("listControllableSquaddies")
        })

        it("is case-insensitive", () => {
            const engine = new MissionEngineTestHarness()
            const result = processCommand("w", engine)
            expect(result.action).toBe("listControllableSquaddies")
        })

        it("handles surrounding whitespace", () => {
            const engine = new MissionEngineTestHarness()
            const result = processCommand("  W  ", engine)
            expect(result.action).toBe("listControllableSquaddies")
        })

        it("returns error when engine is undefined", () => {
            const result = processCommand("W")
            expect(result.action).toBe("listControllableSquaddies")
            expect(result.message).toBe(
                "No engine available to list controllable squaddies."
            )
        })

        it("lists squaddies who can act during PLAYER_TURN", () => {
            const engine = new MissionEngineTestHarness()
            engine.transitionToNextPhase()
            engine.transitionToNextPhase()

            const result = processCommand("W", engine)
            expect(result.message).toContain("Squaddies who can act:")
            expect(result.message).toContain("Lini")
        })

        it("shows no squaddies message during TURN_START", () => {
            const engine = new MissionEngineTestHarness()
            const result = processCommand("W", engine)
            expect(result.message).toBe(
                "No squaddies can act this phase."
            )
        })
    })

    describe("transitionToNextPhase", () => {
        it("returns current phase after transition from TURN_START", () => {
            const engine = new MissionEngineTestHarness()
            const result = transitionToNextPhase(engine)
            expect(result).toBe(MissionAffiliationTurn.PLAYER_TURN_START)
        })

        it("returns PLAYER_TURN after two transitions from TURN_START", () => {
            const engine = new MissionEngineTestHarness()
            transitionToNextPhase(engine)
            const result = transitionToNextPhase(engine)
            expect(result).toBe(MissionAffiliationTurn.PLAYER_TURN)
        })

        it("stays at PLAYER_TURN when squaddies can still act", () => {
            const engine = new MissionEngineTestHarness()
            transitionToNextPhase(engine)
            transitionToNextPhase(engine)
            const result = transitionToNextPhase(engine)
            expect(result).toBe(MissionAffiliationTurn.PLAYER_TURN)
        })
    })

    describe("showPhase action", () => {
        it("returns showPhase action for P command", () => {
            const engine = new MissionEngineTestHarness()
            const result = processCommand("P", engine)
            expect(result.action).toBe("showPhase")
        })

        it("is case-insensitive", () => {
            const engine = new MissionEngineTestHarness()
            const result = processCommand("p", engine)
            expect(result.action).toBe("showPhase")
        })

        it("handles surrounding whitespace", () => {
            const engine = new MissionEngineTestHarness()
            const result = processCommand("  P  ", engine)
            expect(result.action).toBe("showPhase")
        })

        it("returns error when engine is undefined", () => {
            const result = processCommand("P")
            expect(result.action).toBe("showPhase")
            expect(result.message).toBe("No engine available to show phase.")
        })

        it("shows turn number and phase name at TURN_START", () => {
            const engine = new MissionEngineTestHarness()
            const result = processCommand("P", engine)
            expect(result.message).toBe("Turn 0 - Turn Start")
        })

        it("shows updated phase after advancing", () => {
            const engine = new MissionEngineTestHarness()
            transitionToNextPhase(engine)
            transitionToNextPhase(engine)
            const result = processCommand("P", engine)
            expect(result.message).toBe("Turn 0 - Player Turn")
        })
    })
})
