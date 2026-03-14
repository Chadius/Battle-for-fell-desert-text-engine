import { describe, it, expect } from "vitest"
import {
    processCommand,
    InteractionPhase,
    transitionToNextPhase,
} from "./commandProcessor.js"
import type { CommandContext } from "./commandProcessor.js"
import { MissionEngineTestHarness } from "../logic/src/testUtils/mission/missionEngineTestHarness.js"
import { MissionAffiliationTurn } from "../logic/src/mission/missionTurn.js"
import { RollGenerator } from "../logic/src/squaddieAction/calculate/roll/rollGenerator.js"

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

        it("shows O command in help text", () => {
            const result = processCommand("?")
            expect(result.message).toContain("O - Show objectives")
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
            expect(result.message).toContain("Scimitar")
            expect(result.message).toContain("[")
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

        it("includes objectives in map output", () => {
            const engine = new MissionEngineTestHarness()
            const result = processCommand("M", engine)
            expect(result.message).toContain("Objective:")
            expect(result.message).toContain("- Defeat enemy:")
            expect(result.message).toContain("Failure:")
            expect(result.message).toContain("- Defeat players:")
        })
    })

    describe("showObjectives action", () => {
        it("returns showObjectives action for O command", () => {
            const engine = new MissionEngineTestHarness()
            const result = processCommand("O", engine)
            expect(result.action).toBe("showObjectives")
        })

        it("is case-insensitive", () => {
            const engine = new MissionEngineTestHarness()
            const result = processCommand("o", engine)
            expect(result.action).toBe("showObjectives")
        })

        it("handles surrounding whitespace", () => {
            const engine = new MissionEngineTestHarness()
            const result = processCommand("  O  ", engine)
            expect(result.action).toBe("showObjectives")
        })

        it("returns error when engine is undefined", () => {
            const result = processCommand("O")
            expect(result.action).toBe("showObjectives")
            expect(result.message).toBe(
                "No engine available to show objectives."
            )
        })

        it("shows objectives and failure conditions", () => {
            const engine = new MissionEngineTestHarness()
            const result = processCommand("O", engine)
            expect(result.message).toContain("Objective:")
            expect(result.message).toContain("- Defeat enemy:")
            expect(result.message).toContain("Failure:")
            expect(result.message).toContain("- Defeat players:")
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

    describe("selectAction action", () => {
        const setupPlayerTurnWithLini = () => {
            const engine = new MissionEngineTestHarness()
            engine.transitionToNextPhase()
            engine.transitionToNextPhase()
            const context: CommandContext = {
                selectedSquaddieId: engine.getLiniSquaddieId(),
                interactionPhase: InteractionPhase.BROWSING,
                actingSquaddieId: undefined,
            }
            return { engine, context }
        }

        describe("listing actions with A", () => {
            it("lists available actions when a squaddie is selected", () => {
                const { engine, context } = setupPlayerTurnWithLini()
                const result = processCommand("A", engine, context)
                expect(result.action).toBe("selectAction")
                expect(result.message).toContain("Actions:")
                expect(result.message).toContain("E - End Turn")
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
                const result = processCommand("A", undefined, context)
                expect(result.action).toBe("selectAction")
                expect(result.message).toBe(
                    "No engine available to select actions."
                )
            })

            it("returns error when no squaddie is selected", () => {
                const engine = new MissionEngineTestHarness()
                const result = processCommand("A", engine)
                expect(result.action).toBe("selectAction")
                expect(result.message).toBe(
                    "No squaddie selected. Inspect a coordinate with a squaddie first."
                )
            })

            it("is case-insensitive", () => {
                const { engine, context } = setupPlayerTurnWithLini()
                const result = processCommand("a", engine, context)
                expect(result.action).toBe("selectAction")
                expect(result.message).toContain("Actions:")
            })

            it("handles surrounding whitespace", () => {
                const { engine, context } = setupPlayerTurnWithLini()
                const result = processCommand("  A  ", engine, context)
                expect(result.action).toBe("selectAction")
                expect(result.message).toContain("Actions:")
            })
        })

        describe("end turn with AE", () => {
            it("returns message with squaddie name ending their turn", () => {
                const { engine, context } = setupPlayerTurnWithLini()
                const result = processCommand("AE", engine, context)
                expect(result.action).toBe("selectAction")
                expect(result.message).toContain("ends their turn")
                expect(result.message).toContain("Lini")
            })

            it("clears selected and acting squaddie from context", () => {
                const { engine, context } = setupPlayerTurnWithLini()
                const result = processCommand("AE", engine, context)
                expect(result.updatedContext).toBeDefined()
                expect(
                    result.updatedContext!.selectedSquaddieId
                ).toBeUndefined()
                expect(
                    result.updatedContext!.actingSquaddieId
                ).toBeUndefined()
            })

            it("sets interaction phase to BROWSING", () => {
                const { engine, context } = setupPlayerTurnWithLini()
                const result = processCommand("AE", engine, context)
                expect(result.updatedContext).toBeDefined()
                expect(result.updatedContext!.interactionPhase).toBe(
                    InteractionPhase.BROWSING
                )
            })

            it("spends all action points", () => {
                const { engine, context } = setupPlayerTurnWithLini()
                processCommand("AE", engine, context)
                const info = engine.getSquaddieInfo(
                    context.selectedSquaddieId!
                )
                expect(info.currentActionPoints).toBe(0)
            })

            it("is case-insensitive and handles whitespace", () => {
                const { engine, context } = setupPlayerTurnWithLini()
                const result = processCommand("  ae  ", engine, context)
                expect(result.action).toBe("selectAction")
                expect(result.message).toContain("ends their turn")
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
                const result = processCommand("AE", undefined, context)
                expect(result.action).toBe("selectAction")
                expect(result.message).toBe(
                    "No engine available to select actions."
                )
            })

            it("returns error when no squaddie is selected", () => {
                const engine = new MissionEngineTestHarness()
                const result = processCommand("AE", engine)
                expect(result.action).toBe("selectAction")
                expect(result.message).toBe(
                    "No squaddie selected. Inspect a coordinate with a squaddie first."
                )
            })
        })

        describe("help text for A command", () => {
            it("shows A command when a squaddie is selected", () => {
                const engine = new MissionEngineTestHarness()
                const context: CommandContext = {
                    selectedSquaddieId: engine.getLiniSquaddieId(),
                    interactionPhase: InteractionPhase.BROWSING,
                    actingSquaddieId: undefined,
                }
                const result = processCommand("?", engine, context)
                expect(result.message).toContain("A - Select action")
            })

            it("does not show A command when no squaddie is selected", () => {
                const result = processCommand("?")
                expect(result.message).not.toContain("A - Select action")
            })
        })
    })

    describe("AM — movement command", () => {
        const setupPlayerTurnWithLini = () => {
            const engine = new MissionEngineTestHarness()
            engine.transitionToNextPhase()
            engine.transitionToNextPhase()
            const context: CommandContext = {
                selectedSquaddieId: engine.getLiniSquaddieId(),
                interactionPhase: InteractionPhase.BROWSING,
                actingSquaddieId: undefined,
            }
            return { engine, context }
        }

        it("returns error when no squaddie is selected", () => {
            const engine = new MissionEngineTestHarness()
            engine.transitionToNextPhase()
            engine.transitionToNextPhase()
            const result = processCommand("AM", engine)
            expect(result.action).toBe("selectAction")
            expect(result.message).toBe(
                "No squaddie selected. Inspect a coordinate with a squaddie first."
            )
        })

        it("returns moveSquaddie action with AP cost overlay on map when squaddie is selected", () => {
            const { engine, context } = setupPlayerTurnWithLini()
            const result = processCommand("AM", engine, context)
            expect(result.action).toBe("moveSquaddie")
            expect(result.message).toMatch(/[123]/)
        })

        it("sets context to SELECTING_TARGET after AM command", () => {
            const { engine, context } = setupPlayerTurnWithLini()
            const result = processCommand("AM", engine, context)
            expect(result.updatedContext?.interactionPhase).toBe(
                InteractionPhase.SELECTING_TARGET
            )
            expect(result.updatedContext?.pendingActionId).toBe("default-move")
        })

        it("executes movement to a valid reachable coordinate", () => {
            const { engine, context } = setupPlayerTurnWithLini()
            const selectResult = processCommand("AM", engine, context)
            const targetContext = selectResult.updatedContext!

            const moveResult = processCommand("0, 1", engine, targetContext)
            expect(moveResult.action).toBe("moveSquaddie")
            expect(moveResult.message).toContain("moves to")
            expect(moveResult.message).toContain("(0, 1)")
        })

        it("returns BROWSING context after successful movement", () => {
            const { engine, context } = setupPlayerTurnWithLini()
            const selectResult = processCommand("AM", engine, context)
            const targetContext = selectResult.updatedContext!

            const moveResult = processCommand("0, 1", engine, targetContext)
            expect(moveResult.updatedContext?.interactionPhase).toBe(
                InteractionPhase.BROWSING
            )
            expect(moveResult.updatedContext?.pendingActionId).toBeUndefined()
        })

        it("returns out of reach message for unreachable coordinate, keeping SELECTING_TARGET", () => {
            const { engine, context } = setupPlayerTurnWithLini()
            const selectResult = processCommand("AM", engine, context)
            const targetContext = selectResult.updatedContext!

            const moveResult = processCommand("3, 4", engine, targetContext)
            expect(moveResult.action).toBe("moveSquaddie")
            expect(moveResult.message).toContain("out of reach")
            expect(moveResult.updatedContext?.interactionPhase).toBe(
                InteractionPhase.SELECTING_TARGET
            )
        })

        it("cancels movement when malformed input is entered during SELECTING_TARGET", () => {
            const { engine, context } = setupPlayerTurnWithLini()
            const selectResult = processCommand("AM", engine, context)
            const targetContext = selectResult.updatedContext!

            const cancelResult = processCommand("gibberish", engine, targetContext)
            expect(cancelResult.action).toBe("moveSquaddie")
            expect(cancelResult.message).toContain("cancelled")
            expect(cancelResult.updatedContext?.interactionPhase).toBe(
                InteractionPhase.BROWSING
            )
        })

        it("shows movement message with AP spent and remaining after move", () => {
            const { engine, context } = setupPlayerTurnWithLini()
            const selectResult = processCommand("AM", engine, context)
            const targetContext = selectResult.updatedContext!

            const moveResult = processCommand("0, 1", engine, targetContext)
            expect(moveResult.message).toMatch(/spending [1-9]\d* AP/)
            expect(moveResult.message).toMatch(/\d+ remaining/)
            const {currentActionPoints} = engine.getSquaddieInfo(engine.getLiniSquaddieId())
            expect(currentActionPoints).toBe(2)
        })

        it("shows movement route with ** and !! after move", () => {
            const { engine, context } = setupPlayerTurnWithLini()
            const selectResult = processCommand("AM", engine, context)
            const targetContext = selectResult.updatedContext!

            const moveResult = processCommand("0, 1", engine, targetContext)

            expect(moveResult.message).toContain("**")
            expect(moveResult.message).toContain("!!")
        })

        it("squaddie moves to new position after movement", () => {
            const { engine, context } = setupPlayerTurnWithLini()
            const selectResult = processCommand("AM", engine, context)
            const targetContext = selectResult.updatedContext!

            processCommand("0, 1", engine, targetContext)
            const liniPos = engine.getSquaddiePosition(engine.getLiniSquaddieId())
            expect(liniPos).toEqual(expect.objectContaining({ row: 0, col: 1 }))
        })

        it("movement overlay does not show destinations that cost more AP than available", () => {
            const { engine, context } = setupPlayerTurnWithLini()
            const { currentActionPoints } = engine.getSquaddieInfo(engine.getLiniSquaddieId())

            const result = processCommand("AM", engine, context)

            const lines = result.message.split("\n")
            const mapHeaderIdx = lines.findIndex(l => l.startsWith("Map:"))
            const legendIdx = lines.findIndex(l => l.startsWith("Legend:"))
            const gridText = lines.slice(mapHeaderIdx + 1, legendIdx).join("\n")

            expect(gridText).not.toMatch(new RegExp(`\\b${currentActionPoints + 1}\\b`))
        })

        it("shows the engine rejection message and returns to BROWSING when readyAction is invalid", () => {
            const engine = new MissionEngineTestHarness()
            engine.transitionToNextPhase()
            engine.transitionToNextPhase()

            const slitherDemonId = engine.getSlitherDemonSquaddieId()
            const validity = engine.getSquaddieActionValidity(slitherDemonId)
            const moveAction = validity.validActions.find(
                (a) => a.actionId === "default-move"
            )

            const targetCoord = moveAction?.targetCoordinates[0]
            expect(targetCoord).toBeDefined()
            if (!targetCoord) return

            const context: CommandContext = {
                selectedSquaddieId: slitherDemonId,
                interactionPhase: InteractionPhase.SELECTING_TARGET,
                actingSquaddieId: slitherDemonId,
                pendingActionId: "default-move",
            }

            const result = processCommand(
                `${targetCoord.row}, ${targetCoord.col}`,
                engine,
                context
            )

            expect(result.message).toContain("It is not this squaddie's turn")
            expect(result.updatedContext?.interactionPhase).toBe(
                InteractionPhase.BROWSING
            )

            const slitherPos = engine.getSquaddiePosition(slitherDemonId)
            expect(slitherPos).toEqual(expect.objectContaining({ row: 3, col: 4 }))
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

    describe("numbered combat actions (A1, A2, …)", () => {
        const setupPlayerTurnWithLini = () => {
            const engine = new MissionEngineTestHarness()
            engine.transitionToNextPhase()
            engine.transitionToNextPhase()
            const context: CommandContext = {
                selectedSquaddieId: engine.getLiniSquaddieId(),
                interactionPhase: InteractionPhase.BROWSING,
                actingSquaddieId: undefined,
            }
            return { engine, context }
        }

        const drainNonPlayerTurns = (engine: MissionEngineTestHarness) => {
            for (let i = 0; i < 20; i++) {
                if (
                    engine.getCurrentAffiliationTurn() ===
                    MissionAffiliationTurn.PLAYER_TURN
                )
                    break
                if (engine.getReadiedAction() != undefined) {
                    engine.useActionAndGetResults()
                } else {
                    engine.transitionToNextPhase()
                }
            }
        }

        const setupPlayerTurnWithLiniAdjacentToEnemy = () => {
            const allFoursQueue = Array<number>(40).fill(4)
            const engine = new MissionEngineTestHarness(new RollGenerator(allFoursQueue))
            const liniId = engine.getLiniSquaddieId()

            engine.transitionToNextPhase()
            engine.transitionToNextPhase()

            engine.readyAction({
                actor: liniId,
                targets: [liniId],
                action: {
                    id: "default-move",
                    decisions: { desiredMovementDestination: { row: 2, col: 2 } },
                },
            })
            engine.useActionAndGetResults()

            engine.endSquaddieTurn(liniId)

            drainNonPlayerTurns(engine)

            const context: CommandContext = {
                selectedSquaddieId: liniId,
                interactionPhase: InteractionPhase.BROWSING,
                actingSquaddieId: undefined,
            }
            return { engine, context }
        }

        describe("A command (list) shows numbered combat actions", () => {
            it("shows A1 and A2 keys for Lini's combat actions", () => {
                const { engine, context } = setupPlayerTurnWithLini()
                const result = processCommand("A", engine, context)
                expect(result.message).toContain("A1 -")
                expect(result.message).toContain("A2 -")
            })

            it("shows AE and AM entries in the action list", () => {
                const { engine, context } = setupPlayerTurnWithLini()
                const result = processCommand("A", engine, context)
                expect(result.message).toContain("AE - End Turn")
                expect(result.message).toContain("AM - Move")
            })

            it("shows invalid Scimitar with reason in brackets", () => {
                const { engine, context } = setupPlayerTurnWithLini()
                const result = processCommand("A", engine, context)
                expect(result.message).toContain("Scimitar")
                expect(result.message).toContain("[")
            })
        })

        describe("A2 (Scimitar) — single target auto-selects to CONFIRMING_ACTION when adjacent to enemy", () => {
            it("enters CONFIRMING_ACTION phase", () => {
                const { engine, context } = setupPlayerTurnWithLiniAdjacentToEnemy()
                const result = processCommand("A2", engine, context)
                expect(result.action).toBe("executeAction")
                expect(result.updatedContext?.interactionPhase).toBe(
                    InteractionPhase.CONFIRMING_ACTION
                )
            })

            it("shows forecast for the auto-selected target (the Slither Demon)", () => {
                const { engine, context } = setupPlayerTurnWithLiniAdjacentToEnemy()
                const result = processCommand("A2", engine, context)
                const slitherDemonInfo = engine.getSquaddieInfo(
                    engine.getSlitherDemonSquaddieId()
                )
                expect(result.message).toContain("Forecast for")
                expect(result.message).toContain(slitherDemonInfo.name)
            })

            it("sets pendingTargetCount to 1 for single-target action", () => {
                const { engine, context } = setupPlayerTurnWithLiniAdjacentToEnemy()
                const result = processCommand("A2", engine, context)
                expect(result.updatedContext?.pendingTargetCount).toBe(1)
            })

            it("preserves the acting squaddie in the updated context", () => {
                const { engine, context } = setupPlayerTurnWithLiniAdjacentToEnemy()
                const result = processCommand("A2", engine, context)
                expect(result.updatedContext?.actingSquaddieId).toEqual(
                    engine.getLiniSquaddieId()
                )
            })

            // Forecast message should always include the confirmation prompt
            it("forecast message includes confirmation prompt", () => {
                const { engine, context } = setupPlayerTurnWithLiniAdjacentToEnemy()
                const result = processCommand("A2", engine, context)
                expect(result.message).toContain(
                    "Press Y to confirm or N/C to cancel."
                )
            })
        })

        describe("selecting an invalid numbered action", () => {
            it("returns an error message without entering CONFIRMING_ACTION", () => {
                const { engine, context } = setupPlayerTurnWithLini()
                const result = processCommand("A2", engine, context)
                expect(result.action).toBe("selectAction")
                expect(result.message).toContain("Scimitar")
                expect(result.updatedContext).toBeUndefined()
            })

            it("returns an error for an out-of-range number", () => {
                const { engine, context } = setupPlayerTurnWithLini()
                const result = processCommand("A99", engine, context)
                expect(result.action).toBe("selectAction")
                expect(result.message).toContain("No action at number 99")
            })
        })

        describe("CONFIRMING_ACTION — Y executes, N/C cancels", () => {
            const setupInConfirmingAction = () => {
                const { engine, context } = setupPlayerTurnWithLiniAdjacentToEnemy()
                const selectResult = processCommand("A2", engine, context)
                const confirmingContext = selectResult.updatedContext!
                return { engine, confirmingContext }
            }

            it("Y executes the action and returns to BROWSING", () => {
                const { engine, confirmingContext } = setupInConfirmingAction()
                const result = processCommand("Y", engine, confirmingContext)
                expect(result.action).toBe("executeAction")
                expect(result.updatedContext?.interactionPhase).toBe(
                    InteractionPhase.BROWSING
                )
            })

            it("Y shows the action result with degree of success", () => {
                const { engine, confirmingContext } = setupInConfirmingAction()
                const result = processCommand("Y", engine, confirmingContext)
                expect(result.message).toContain("Result:")
            })

            it("Y clears the selected and acting squaddie", () => {
                const { engine, confirmingContext } = setupInConfirmingAction()
                const result = processCommand("Y", engine, confirmingContext)
                expect(result.updatedContext?.selectedSquaddieId).toBeUndefined()
                expect(result.updatedContext?.actingSquaddieId).toBeUndefined()
            })

            it("N cancels the action and returns to BROWSING when pendingTargetCount is 1", () => {
                const { engine, confirmingContext } = setupInConfirmingAction()
                const result = processCommand("N", engine, confirmingContext)
                expect(result.action).toBe("cancelAction")
                expect(result.updatedContext?.interactionPhase).toBe(
                    InteractionPhase.BROWSING
                )
            })

            it("C cancels the action and returns to BROWSING when pendingTargetCount is 1", () => {
                const { engine, confirmingContext } = setupInConfirmingAction()
                const result = processCommand("C", engine, confirmingContext)
                expect(result.action).toBe("cancelAction")
                expect(result.updatedContext?.interactionPhase).toBe(
                    InteractionPhase.BROWSING
                )
            })

            it("unknown input prompts to use Y or N/C", () => {
                const { engine, confirmingContext } = setupInConfirmingAction()
                const result = processCommand("X", engine, confirmingContext)
                expect(result.message).toContain("Y")
                expect(result.message).toContain("N")
            })

            it("N cancels the readied action so the engine has no pending action", () => {
                const { engine, confirmingContext } = setupInConfirmingAction()
                processCommand("N", engine, confirmingContext)
                expect(engine.getReadiedAction()).toBeUndefined()
            })
        })

        describe("SELECTING_TARGET for combat action", () => {
            it("cancels when a non-coordinate input is entered during combat target selection", () => {
                const engine = new MissionEngineTestHarness()
                engine.transitionToNextPhase()
                engine.transitionToNextPhase()
                const liniId = engine.getLiniSquaddieId()

                const context: CommandContext = {
                    selectedSquaddieId: liniId,
                    interactionPhase: InteractionPhase.SELECTING_TARGET,
                    actingSquaddieId: liniId,
                    pendingActionId: "lini-heal",
                    pendingTargetCount: 1,
                }

                const result = processCommand("gibberish", engine, context)
                expect(result.action).toBe("cancelAction")
                expect(result.updatedContext?.interactionPhase).toBe(
                    InteractionPhase.BROWSING
                )
            })

            it("cancels when an out-of-range coordinate is entered during combat target selection", () => {
                const engine = new MissionEngineTestHarness()
                engine.transitionToNextPhase()
                engine.transitionToNextPhase()
                const liniId = engine.getLiniSquaddieId()

                const context: CommandContext = {
                    selectedSquaddieId: liniId,
                    interactionPhase: InteractionPhase.SELECTING_TARGET,
                    actingSquaddieId: liniId,
                    pendingActionId: "lini-heal",
                    pendingTargetCount: 2,
                }

                const result = processCommand("0, 4", engine, context)
                expect(result.action).toBe("cancelAction")
                expect(result.updatedContext?.interactionPhase).toBe(
                    InteractionPhase.BROWSING
                )
            })
        })
    })
})
