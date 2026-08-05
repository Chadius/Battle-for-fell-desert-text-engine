import { describe, it, expect } from "vitest"
import {
    processCommand,
    InteractionPhase,
    transitionToNextPhase,
    DEBUG_FLAG_NAMES,
} from "./commandProcessor.js"
import type { CommandContext } from "./commandProcessor.js"
import { MissionAffiliationTurn } from "../logic/src/mission/missionTurn.js"
import { RollGenerator } from "../logic/src/squaddieAction/calculate/roll/rollGenerator.js"
import { MissionEngine } from "../logic/src/mission/missionEngine/missionEngine.js"
import {
    createSimplePlayerVsEnemyMission,
    createLineActionMission,
    SimpleTestMissionIds,
} from "./testUtils/simpleTestMission.js"
import {
    createMovementMissionEngine,
    MovementTestMissionIds,
} from "./testUtils/movementTestMission.js"
import { glossaryManagerWith } from "./testUtils/glossaryFixture.js"

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
            const { engine, playerSquaddieId } = createSimplePlayerVsEnemyMission()
            const context: CommandContext = {
                selectedSquaddieId: playerSquaddieId,
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

        it("shows G command in help text", () => {
            const result = processCommand("?")
            expect(result.message).toContain("G - Show glossary terms")
        })

        it("shows turn flow explanation in help text", () => {
            const result = processCommand("?")
            expect(result.message).toContain("Turn Flow")
        })

        it("shows objective summary in help text when engine is provided", () => {
            const { engine } = createSimplePlayerVsEnemyMission()
            const result = processCommand("?", engine)
            expect(result.message).toContain("Defeat")
        })
    })

    describe("inspectCoordinate action", () => {
        it("returns terrain info for a valid coordinate", () => {
            const { engine } = createSimplePlayerVsEnemyMission()
            const result = processCommand("0, 1", engine)
            expect(result.action).toBe("inspectCoordinate")
            expect(result.message).toContain("(0,1): Standard")
        })

        it("returns off-map message for an out-of-bounds coordinate", () => {
            const { engine } = createSimplePlayerVsEnemyMission()
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
            const { engine, playerSquaddieId } = createSimplePlayerVsEnemyMission()
            const result = processCommand("0, 0", engine)
            expect(result.updatedContext).toBeDefined()
            expect(result.updatedContext!.selectedSquaddieId).toEqual(
                playerSquaddieId
            )
            expect(result.updatedContext!.interactionPhase).toBe(
                InteractionPhase.BROWSING
            )
            expect(result.updatedContext!.actingSquaddieId).toBeUndefined()
        })

        it("clears updatedContext when no squaddie is at the coordinate", () => {
            const { engine } = createSimplePlayerVsEnemyMission()
            const result = processCommand("2, 2", engine)
            expect(result.updatedContext).toBeDefined()
            expect(result.updatedContext!.selectedSquaddieId).toBeUndefined()
            expect(result.updatedContext!.interactionPhase).toBe(
                InteractionPhase.BROWSING
            )
            expect(result.updatedContext!.actingSquaddieId).toBeUndefined()
        })

        it("clears updatedContext for off-map coordinates", () => {
            const { engine } = createSimplePlayerVsEnemyMission()
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
            const { engine, playerSquaddieId } = createSimplePlayerVsEnemyMission()
            const context: CommandContext = {
                selectedSquaddieId: playerSquaddieId,
                interactionPhase: InteractionPhase.BROWSING,
                actingSquaddieId: undefined,
            }
            const result = processCommand("L", engine, context)
            expect(result.action).toBe("lookAtSquaddie")
            expect(result.message).toContain("Lini")
        })

        it("returns error when no squaddie is selected", () => {
            const { engine } = createSimplePlayerVsEnemyMission()
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
            const { engine, playerSquaddieId } = createSimplePlayerVsEnemyMission()
            const context: CommandContext = {
                selectedSquaddieId: playerSquaddieId,
                interactionPhase: InteractionPhase.BROWSING,
                actingSquaddieId: undefined,
            }
            const result = processCommand("l", engine, context)
            expect(result.action).toBe("lookAtSquaddie")
            expect(result.message).toContain("Lini")
        })

        it("handles surrounding whitespace", () => {
            const { engine, playerSquaddieId } = createSimplePlayerVsEnemyMission()
            const context: CommandContext = {
                selectedSquaddieId: playerSquaddieId,
                interactionPhase: InteractionPhase.BROWSING,
                actingSquaddieId: undefined,
            }
            const result = processCommand("  L  ", engine, context)
            expect(result.action).toBe("lookAtSquaddie")
            expect(result.message).toContain("Lini")
        })

        it("shows squaddie name and affiliation", () => {
            const { engine, playerSquaddieId } = createSimplePlayerVsEnemyMission()
            const context: CommandContext = {
                selectedSquaddieId: playerSquaddieId,
                interactionPhase: InteractionPhase.BROWSING,
                actingSquaddieId: undefined,
            }
            const result = processCommand("L", engine, context)
            expect(result.message).toContain("Lini")
            expect(result.message).toContain("PLAYER")
        })

        it("shows hit points and action points", () => {
            const { engine, playerSquaddieId } = createSimplePlayerVsEnemyMission()
            const context: CommandContext = {
                selectedSquaddieId: playerSquaddieId,
                interactionPhase: InteractionPhase.BROWSING,
                actingSquaddieId: undefined,
            }
            const result = processCommand("L", engine, context)
            expect(result.message).toContain("Hit Points:")
            expect(result.message).toContain("Action Points:")
        })

        it("does not show conditions section when squaddie has no conditions", () => {
            const { engine, playerSquaddieId } = createSimplePlayerVsEnemyMission()
            const context: CommandContext = {
                selectedSquaddieId: playerSquaddieId,
                interactionPhase: InteractionPhase.BROWSING,
                actingSquaddieId: undefined,
            }
            const result = processCommand("L", engine, context)
            expect(result.message).not.toContain("Conditions:")
        })

        it("shows actions section with valid and invalid actions", () => {
            const { engine, playerSquaddieId } = createSimplePlayerVsEnemyMission()
            const context: CommandContext = {
                selectedSquaddieId: playerSquaddieId,
                interactionPhase: InteractionPhase.BROWSING,
                actingSquaddieId: undefined,
            }
            const result = processCommand("L", engine, context)
            expect(result.message).toContain("Actions:")
        })

        it("shows End Turn and Move as valid actions", () => {
            const { engine, playerSquaddieId } = createSimplePlayerVsEnemyMission()
            const context: CommandContext = {
                selectedSquaddieId: playerSquaddieId,
                interactionPhase: InteractionPhase.BROWSING,
                actingSquaddieId: undefined,
            }
            const result = processCommand("L", engine, context)
            expect(result.message).toContain("AE - End Turn (all AP)")
            expect(result.message).toContain("AM - Move")
        })

        it("shows Scimitar as invalid when no foes in range", () => {
            const { engine, playerSquaddieId } = createSimplePlayerVsEnemyMission()
            const context: CommandContext = {
                selectedSquaddieId: playerSquaddieId,
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
            const { engine } = createSimplePlayerVsEnemyMission()
            const result = processCommand("M", engine)
            expect(result.action).toBe("showMap")
            expect(result.message).toContain("Test Harness Map")
        })

        it("returns showMap when input is lowercase m", () => {
            const { engine } = createSimplePlayerVsEnemyMission()
            const result = processCommand("m", engine)
            expect(result.action).toBe("showMap")
            expect(result.message).toContain("Test Harness Map")
        })

        it("returns showMap when input has surrounding whitespace", () => {
            const { engine } = createSimplePlayerVsEnemyMission()
            const result = processCommand("  M  ", engine)
            expect(result.action).toBe("showMap")
            expect(result.message).toContain("Test Harness Map")
        })

        it("returns an error message when engine is undefined", () => {
            const result = processCommand("M")
            expect(result.action).toBe("showMap")
            expect(result.message).toBe(
                "No engine available to display the map."
            )
        })

        it("renders the test harness map with squaddies", () => {
            const { engine } = createSimplePlayerVsEnemyMission()
            const result = processCommand("M", engine)
            expect(result.message).toContain("5 columns x 4 rows")
            expect(result.message).toContain("lini")
            expect(result.message).toContain("slither-demon")
        })

        it("includes turn header in map output", () => {
            const { engine } = createSimplePlayerVsEnemyMission()
            const result = processCommand("M", engine)
            expect(result.message).toContain("Turn 0")
        })

        it("groups squaddies by affiliation in map output", () => {
            const { engine } = createSimplePlayerVsEnemyMission()
            const result = processCommand("M", engine)
            expect(result.message).toContain("  Player:")
            expect(result.message).toContain("    Li = lini")
            expect(result.message).toContain("  Enemy:")
            expect(result.message).toContain("    Sl = slither-demon")
        })

        it("includes objectives in map output", () => {
            const { engine } = createSimplePlayerVsEnemyMission()
            const result = processCommand("M", engine)
            expect(result.message).toContain("Objective:")
            expect(result.message).toContain("- Defeat enemy:")
            expect(result.message).toContain("Failure:")
            expect(result.message).toContain("- Defeat players:")
        })
    })

    describe("showObjectives action", () => {
        it("returns showObjectives action for O command", () => {
            const { engine } = createSimplePlayerVsEnemyMission()
            const result = processCommand("O", engine)
            expect(result.action).toBe("showObjectives")
        })

        it("is case-insensitive", () => {
            const { engine } = createSimplePlayerVsEnemyMission()
            const result = processCommand("o", engine)
            expect(result.action).toBe("showObjectives")
        })

        it("handles surrounding whitespace", () => {
            const { engine } = createSimplePlayerVsEnemyMission()
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
            const { engine } = createSimplePlayerVsEnemyMission()
            const result = processCommand("O", engine)
            expect(result.message).toContain("Objective:")
            expect(result.message).toContain("- Defeat enemy:")
            expect(result.message).toContain("Failure:")
            expect(result.message).toContain("- Defeat players:")
        })
    })

    describe("showGlossary action", () => {
        it("returns showGlossary action for G command", () => {
            const { engine } = createSimplePlayerVsEnemyMission()
            const result = processCommand("G", engine, undefined, glossaryManagerWith([]))
            expect(result.action).toBe("showGlossary")
        })

        it("reports no glossary available when no GlossaryManager is supplied", () => {
            const { engine } = createSimplePlayerVsEnemyMission()
            const result = processCommand("G", engine)
            expect(result.message).toBe("No glossary available.")
        })

        it("reports no engine available when no MissionEngine is supplied", () => {
            const result = processCommand("G", undefined, undefined, glossaryManagerWith([]))
            expect(result.message).toBe("No engine available to show glossary terms.")
        })

        it("lists every known term when no squaddie is selected", () => {
            const glossaryManager = glossaryManagerWith([
                {
                    termId: "condition.ARMOR",
                    type: "SQUADDIE_CONDITION_TYPE",
                    name: "Armor",
                    definition: "Reduces hit chance.",
                },
            ])
            const { engine } = createSimplePlayerVsEnemyMission()
            const result = processCommand("G", engine, undefined, glossaryManager)
            expect(result.message).toContain("Armor - Reduces hit chance.")
        })

        it("lists only terms reachable from the selected squaddie", () => {
            const glossaryManager = glossaryManagerWith([
                {
                    termId: "condition.ARMOR",
                    type: "SQUADDIE_CONDITION_TYPE",
                    name: "Armor",
                    definition: "Reduces hit chance.",
                },
                {
                    termId: "condition.HUSTLE",
                    type: "SQUADDIE_CONDITION_TYPE",
                    name: "Hustle",
                    definition: "Cheaper movement.",
                },
            ])
            // Vale (actorId) starts with a permanent HUSTLE condition; Armor is unrelated to her.
            const { engine, actorId } = createLineActionMission()
            const context: CommandContext = {
                selectedSquaddieId: actorId,
                interactionPhase: InteractionPhase.BROWSING,
                actingSquaddieId: undefined,
            }
            const result = processCommand("G", engine, context, glossaryManager)
            expect(result.message).toContain("Hustle - Cheaper movement.")
            expect(result.message).not.toContain("Armor")
        })
    })

    describe("listControllableSquaddies action", () => {
        it("returns listControllableSquaddies for W command", () => {
            const { engine } = createSimplePlayerVsEnemyMission()
            const result = processCommand("W", engine)
            expect(result.action).toBe("listControllableSquaddies")
        })

        it("is case-insensitive", () => {
            const { engine } = createSimplePlayerVsEnemyMission()
            const result = processCommand("w", engine)
            expect(result.action).toBe("listControllableSquaddies")
        })

        it("handles surrounding whitespace", () => {
            const { engine } = createSimplePlayerVsEnemyMission()
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
            const { engine } = createSimplePlayerVsEnemyMission()
            engine.transitionToNextPhase()
            engine.transitionToNextPhase()

            const result = processCommand("W", engine)
            expect(result.message).toContain("Squaddies who can act:")
            expect(result.message).toContain("Lini")
        })

        it("shows no squaddies message during TURN_START", () => {
            const { engine } = createSimplePlayerVsEnemyMission()
            const result = processCommand("W", engine)
            expect(result.message).toBe(
                "No squaddies can act this phase."
            )
        })
    })

    describe("transitionToNextPhase", () => {
        it("returns current phase after transition from TURN_START", () => {
            const { engine } = createSimplePlayerVsEnemyMission()
            const result = transitionToNextPhase(engine)
            expect(result).toBe(MissionAffiliationTurn.PLAYER_TURN_START)
        })

        it("returns PLAYER_TURN after two transitions from TURN_START", () => {
            const { engine } = createSimplePlayerVsEnemyMission()
            transitionToNextPhase(engine)
            const result = transitionToNextPhase(engine)
            expect(result).toBe(MissionAffiliationTurn.PLAYER_TURN)
        })

        it("stays at PLAYER_TURN when squaddies can still act", () => {
            const { engine } = createSimplePlayerVsEnemyMission()
            transitionToNextPhase(engine)
            transitionToNextPhase(engine)
            const result = transitionToNextPhase(engine)
            expect(result).toBe(MissionAffiliationTurn.PLAYER_TURN)
        })
    })

    describe("selectAction action", () => {
        const setupPlayerTurnWithLini = () => {
            const { engine, playerSquaddieId } = createSimplePlayerVsEnemyMission()
            engine.transitionToNextPhase()
            engine.transitionToNextPhase()
            const context: CommandContext = {
                selectedSquaddieId: playerSquaddieId,
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
                const { engine } = createSimplePlayerVsEnemyMission()
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

            it("after ending turn, Lini is deselected and ready to accept new coordinate input", () => {
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
                const { engine } = createSimplePlayerVsEnemyMission()
                const result = processCommand("AE", engine)
                expect(result.action).toBe("selectAction")
                expect(result.message).toBe(
                    "No squaddie selected. Inspect a coordinate with a squaddie first."
                )
            })
        })

        describe("help text for A command", () => {
            it("shows A command when a squaddie is selected", () => {
                const { engine, playerSquaddieId } = createSimplePlayerVsEnemyMission()
                const context: CommandContext = {
                    selectedSquaddieId: playerSquaddieId,
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
            const { engine, playerSquaddieId } = createSimplePlayerVsEnemyMission()
            engine.transitionToNextPhase()
            engine.transitionToNextPhase()
            const context: CommandContext = {
                selectedSquaddieId: playerSquaddieId,
                interactionPhase: InteractionPhase.BROWSING,
                actingSquaddieId: undefined,
            }
            return { engine, context }
        }

        it("returns error when no squaddie is selected", () => {
            const { engine } = createSimplePlayerVsEnemyMission()
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
            expect(result.mapText).toMatch(/[123]/)
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

        it("cancels movement when an unreachable coordinate is entered during SELECTING_TARGET", () => {
            const { engine, context } = setupPlayerTurnWithLini()
            const selectResult = processCommand("AM", engine, context)
            const targetContext = selectResult.updatedContext!

            const moveResult = processCommand("3, 4", engine, targetContext)
            expect(moveResult.action).toBe("moveSquaddie")
            expect(moveResult.message).toContain("out of reach")
            expect(moveResult.updatedContext?.interactionPhase).toBe(
                InteractionPhase.BROWSING
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
            const {currentActionPoints} = engine.getSquaddieInfo(context.selectedSquaddieId!)
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
            const liniPos = engine.getSquaddiePosition(context.selectedSquaddieId!)
            expect(liniPos).toEqual(expect.objectContaining({ row: 0, col: 1 }))
        })

        it("movement overlay does not show destinations that cost more AP than available", () => {
            const { engine, context } = setupPlayerTurnWithLini()
            const { currentActionPoints } = engine.getSquaddieInfo(context.selectedSquaddieId!)

            const result = processCommand("AM", engine, context)

            const lines = result.message.split("\n")
            const mapHeaderIdx = lines.findIndex(l => l.startsWith("Map:"))
            const legendIdx = lines.findIndex(l => l.startsWith("Legend:"))
            const gridText = lines.slice(mapHeaderIdx + 1, legendIdx).join("\n")

            expect(gridText).not.toMatch(new RegExp(`\\b${currentActionPoints + 1}\\b`))
        })

        it("shows the engine rejection message and returns to BROWSING when readyAction is invalid", () => {
            const { engine, enemySquaddieId: slitherDemonId } = createSimplePlayerVsEnemyMission()
            engine.transitionToNextPhase()
            engine.transitionToNextPhase()
            const validity = engine.getSquaddieActionValidity(slitherDemonId)
            const moveAction = validity.validActions.find(
                (a) => a.actionId === "default-move"
            )

            const targetCoord = moveAction?.reachableCoordinates[0]
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
            const { engine } = createSimplePlayerVsEnemyMission()
            const result = processCommand("P", engine)
            expect(result.action).toBe("showPhase")
        })

        it("is case-insensitive", () => {
            const { engine } = createSimplePlayerVsEnemyMission()
            const result = processCommand("p", engine)
            expect(result.action).toBe("showPhase")
        })

        it("handles surrounding whitespace", () => {
            const { engine } = createSimplePlayerVsEnemyMission()
            const result = processCommand("  P  ", engine)
            expect(result.action).toBe("showPhase")
        })

        it("returns error when engine is undefined", () => {
            const result = processCommand("P")
            expect(result.action).toBe("showPhase")
            expect(result.message).toBe("No engine available to show phase.")
        })

        it("shows turn number and phase name at TURN_START", () => {
            const { engine } = createSimplePlayerVsEnemyMission()
            const result = processCommand("P", engine)
            expect(result.message).toBe("Turn 0 - Turn Start")
        })

        it("shows updated phase after advancing", () => {
            const { engine } = createSimplePlayerVsEnemyMission()
            transitionToNextPhase(engine)
            transitionToNextPhase(engine)
            const result = processCommand("P", engine)
            expect(result.message).toBe("Turn 0 - Player Turn")
        })
    })

    describe("numbered combat actions (A1, A2, …)", () => {
        const setupPlayerTurnWithLini = () => {
            const { engine, playerSquaddieId } = createSimplePlayerVsEnemyMission()
            engine.transitionToNextPhase()
            engine.transitionToNextPhase()
            const context: CommandContext = {
                selectedSquaddieId: playerSquaddieId,
                interactionPhase: InteractionPhase.BROWSING,
                actingSquaddieId: undefined,
            }
            return { engine, context }
        }

        const setupPlayerTurnWithLiniAdjacentToEnemy = () => {
            const allFoursQueue = Array<number>(40).fill(4)
            const { engine, playerSquaddieId: liniId } = createSimplePlayerVsEnemyMission(new RollGenerator(allFoursQueue))

            engine.transitionToNextPhase()
            engine.transitionToNextPhase()

            engine.readyAction({
                actor: liniId,
                targets: [liniId],
                action: {
                    id: "default-move",
                    decisions: { targetDestination: { row: 2, col: 2 } },
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

        describe("A4 (Scimitar) — single target auto-selects to CONFIRMING_ACTION when adjacent to enemy", () => {
            it("enters CONFIRMING_ACTION phase", () => {
                const { engine, context } = setupPlayerTurnWithLiniAdjacentToEnemy()
                const result = processCommand("A4", engine, context)
                expect(result.action).toBe("executeAction")
                expect(result.updatedContext?.interactionPhase).toBe(
                    InteractionPhase.CONFIRMING_ACTION
                )
            })

            it("shows forecast for the auto-selected target (the Slither Demon)", () => {
                const { engine, context } = setupPlayerTurnWithLiniAdjacentToEnemy()
                const result = processCommand("A4", engine, context)
                const allPositions = engine.getAllSquaddiePositions()
                const slitherDemonPos = allPositions.find((p) => p.squaddieId.outOfBattleSquaddieId === "slither-demon")!
                const slitherDemonInfo = engine.getSquaddieInfo(slitherDemonPos.squaddieId)
                expect(result.message).toContain("Forecast for")
                expect(result.message).toContain(slitherDemonInfo.name)
            })

            it("sets pendingTargetCount to 1 for single-target action", () => {
                const { engine, context } = setupPlayerTurnWithLiniAdjacentToEnemy()
                const result = processCommand("A4", engine, context)
                expect(result.updatedContext?.pendingTargetCount).toBe(1)
            })

            it("preserves the acting squaddie in the updated context", () => {
                const { engine, context } = setupPlayerTurnWithLiniAdjacentToEnemy()
                const result = processCommand("A4", engine, context)
                expect(result.updatedContext?.actingSquaddieId).toEqual(
                    context.selectedSquaddieId
                )
            })

            it("CONFIRMING_ACTION map includes the HT marker on the target", () => {
                const { engine, context } = setupPlayerTurnWithLiniAdjacentToEnemy()
                const result = processCommand("A4", engine, context)
                expect(result.mapText).toContain("HT")
            })

            // Scimitar targets an adjacent cell — no intermediate line cells exist,
            // so "//" markers only appear for actions with multi-step range.
            it("CONFIRMING_ACTION map does not include // for a 1-step melee action", () => {
                const { engine, context } = setupPlayerTurnWithLiniAdjacentToEnemy()
                const result = processCommand("A4", engine, context)
                expect(result.mapText).not.toContain("//")
            })

            // Forecast message should always include the confirmation prompt
            it("forecast message includes confirmation prompt", () => {
                const { engine, context } = setupPlayerTurnWithLiniAdjacentToEnemy()
                const result = processCommand("A4", engine, context)
                expect(result.message).toContain(
                    "Press Y to confirm or N/C to cancel."
                )
            })
        })

        describe("selecting an invalid numbered action", () => {
            it("returns an error message without entering CONFIRMING_ACTION", () => {
                const { engine, context } = setupPlayerTurnWithLini()
                const result = processCommand("A4", engine, context)
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
                const { engine, playerSquaddieId: liniId } = createSimplePlayerVsEnemyMission()
                engine.transitionToNextPhase()
                engine.transitionToNextPhase()

                const context: CommandContext = {
                    selectedSquaddieId: liniId,
                    interactionPhase: InteractionPhase.SELECTING_TARGET,
                    actingSquaddieId: liniId,
                    pendingActionId: SimpleTestMissionIds.player.healActionId,
                    pendingTargetCount: 1,
                }

                const result = processCommand("gibberish", engine, context)
                expect(result.action).toBe("cancelAction")
                expect(result.updatedContext?.interactionPhase).toBe(
                    InteractionPhase.BROWSING
                )
            })

            it("cancels when an out-of-range coordinate is entered during combat target selection", () => {
                const { engine, playerSquaddieId: liniId } = createSimplePlayerVsEnemyMission()
                engine.transitionToNextPhase()
                engine.transitionToNextPhase()

                const context: CommandContext = {
                    selectedSquaddieId: liniId,
                    interactionPhase: InteractionPhase.SELECTING_TARGET,
                    actingSquaddieId: liniId,
                    pendingActionId: SimpleTestMissionIds.player.healActionId,
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

    describe("wrong-affiliation guard", () => {
        // Advance to PLAYER_TURN and set the Slither Demon as the selected squaddie.
        const setupEnemySelectedDuringPlayerTurn = () => {
            const { engine, enemySquaddieId } = createSimplePlayerVsEnemyMission()
            engine.transitionToNextPhase()
            engine.transitionToNextPhase()
            const context: CommandContext = {
                selectedSquaddieId: enemySquaddieId,
                interactionPhase: InteractionPhase.BROWSING,
                actingSquaddieId: undefined,
            }
            return { engine, context }
        }

        it("returns action list when enemy is selected and A is pressed during PLAYER_TURN", () => {
            const { engine, context } = setupEnemySelectedDuringPlayerTurn()
            const result = processCommand("A", engine, context)
            expect(result.action).toBe("selectAction")
            expect(result.message).not.toContain("Cannot command")
            expect(result.message).toContain("Actions:")
        })

        it("returns selectAction error when enemy is selected and AE is pressed during PLAYER_TURN", () => {
            const { engine, context } = setupEnemySelectedDuringPlayerTurn()
            const result = processCommand("AE", engine, context)
            expect(result.action).toBe("selectAction")
            expect(result.message).toContain("Cannot command")
            expect(result.message).toContain("not")
            expect(result.message).toContain("turn")
        })

        it("returns selectAction error when enemy is selected and AM is pressed during PLAYER_TURN", () => {
            const { engine, context } = setupEnemySelectedDuringPlayerTurn()
            const result = processCommand("AM", engine, context)
            expect(result.action).toBe("selectAction")
            expect(result.message).toContain("Cannot command")
            expect(result.message).toContain("not")
            expect(result.message).toContain("turn")
        })

        it("does not return the guard error when Lini is selected during PLAYER_TURN", () => {
            const { engine, playerSquaddieId } = createSimplePlayerVsEnemyMission()
            engine.transitionToNextPhase()
            engine.transitionToNextPhase()
            const context: CommandContext = {
                selectedSquaddieId: playerSquaddieId,
                interactionPhase: InteractionPhase.BROWSING,
                actingSquaddieId: undefined,
            }
            const result = processCommand("A", engine, context)
            expect(result.message).not.toContain("Cannot command")
        })
    })

    describe("Z - undo action", () => {
        // Shared setup: advance to PLAYER_TURN so Lini can act.
        const setupPlayerTurnWithLini = () => {
            const allFoursQueue = Array<number>(40).fill(4)
            const { engine, playerSquaddieId } = createSimplePlayerVsEnemyMission(new RollGenerator(allFoursQueue))
            engine.transitionToNextPhase()
            engine.transitionToNextPhase()
            const context: CommandContext = {
                selectedSquaddieId: playerSquaddieId,
                interactionPhase: InteractionPhase.BROWSING,
                actingSquaddieId: undefined,
            }
            return { engine, context }
        }

        it("returns undoAction with no-engine message when engine is undefined", () => {
            const result = processCommand("Z")
            expect(result.action).toBe("undoAction")
            expect(result.message).toContain("No engine available")
        })

        it("returns undoAction with no-action-to-undo message on a fresh engine", () => {
            const { engine } = setupPlayerTurnWithLini()
            const result = processCommand("Z", engine)
            expect(result.action).toBe("undoAction")
            expect(result.message).toContain("no action to undo")
        })

        it("successfully undoes a movement and returns message with action name", () => {
            const { engine, context } = setupPlayerTurnWithLini()

            // Move Lini one tile.
            const selectResult = processCommand("AM", engine, context)
            processCommand("0, 1", engine, selectResult.updatedContext!)

            // Undo the movement.
            const result = processCommand("Z", engine)
            expect(result.action).toBe("undoAction")
            expect(result.message).toContain("Undid: Move")
        })

        it("resets context to BROWSING after a successful undo", () => {
            const { engine, context } = setupPlayerTurnWithLini()

            const selectResult = processCommand("AM", engine, context)
            processCommand("0, 1", engine, selectResult.updatedContext!)

            const result = processCommand("Z", engine)
            expect(result.updatedContext?.interactionPhase).toBe(
                InteractionPhase.BROWSING
            )
            expect(result.updatedContext?.selectedSquaddieId).toBeUndefined()
            expect(result.updatedContext?.actingSquaddieId).toBeUndefined()
        })

        it("returns cannot-undo message after executing a combat action against an enemy", () => {
            const { engine, context } = setupPlayerTurnWithLini()
            const liniId = context.selectedSquaddieId!

            // Move Lini adjacent to the Slither Demon and end her turn.
            engine.readyAction({
                actor: liniId,
                targets: [liniId],
                action: {
                    id: "default-move",
                    decisions: { targetDestination: { row: 2, col: 2 } },
                },
            })
            engine.useActionAndGetResults()
            engine.endSquaddieTurn(liniId)

            // Let the enemy act and return to PLAYER_TURN.
            drainNonPlayerTurns(engine)

            // Execute Scimitar (A4 from the adjacent position).
            const selectResult = processCommand("A4", engine, context)
            const confirmingContext = selectResult.updatedContext!
            processCommand("Y", engine, confirmingContext)

            // Undo should fail for a combat action.
            const result = processCommand("Z", engine)
            expect(result.action).toBe("undoAction")
            expect(result.message).toContain("action type cannot be undone")
        })
    })

    describe("multi-target LINE action — Lightning Bolt hits all demons in range", () => {
        // Vale moves from (1,0) to (2,2): 2 tiles with HUSTLE costs 1 AP, leaving 2 AP for
        // Lightning Bolt. From (2,2), demons at (2,6), (2,7), (2,8) are all within LONG range
        // (distances 4, 5, 6). All three are returned as valid targets for the LINE action.
        const setupValeWithLightningBoltInRange = () => {
            const allFoursQueue = Array<number>(40).fill(4)
            const { engine, actorId: valeId } = createLineActionMission(new RollGenerator(allFoursQueue))

            engine.transitionToNextPhase()
            engine.transitionToNextPhase()

            // Move Vale to (2,2) via (1,0)→(1,1)→(2,2): 2 tile moves, 1 AP cost.
            engine.readyAction({
                actor: valeId,
                targets: [valeId],
                action: {
                    id: "default-move",
                    decisions: { targetDestination: { row: 2, col: 2 } },
                },
            })
            engine.useActionAndGetResults()

            const context: CommandContext = {
                selectedSquaddieId: valeId,
                interactionPhase: InteractionPhase.BROWSING,
                actingSquaddieId: undefined,
            }

            return { engine, context, valeId }
        }

        it("selecting Lightning Bolt (A2) with multiple targets in range enters SELECTING_TARGET", () => {
            const { engine, context } = setupValeWithLightningBoltInRange()
            const result = processCommand("A2", engine, context)
            expect(result.action).toBe("executeAction")
            expect(result.updatedContext?.interactionPhase).toBe(
                InteractionPhase.SELECTING_TARGET
            )
        })

        it("aiming at a demon coordinate enters CONFIRMING_ACTION instead of cancelling", () => {
            const { engine, context } = setupValeWithLightningBoltInRange()
            const selectResult = processCommand("A2", engine, context)
            // Aim toward the farthest in-range demon at (2,8).
            const aimResult = processCommand("2, 8", engine, selectResult.updatedContext!)
            expect(aimResult.action).toBe("executeAction")
            expect(aimResult.updatedContext?.interactionPhase).toBe(
                InteractionPhase.CONFIRMING_ACTION
            )
        })

        it("CONFIRMING_ACTION map includes HT markers on hit targets", () => {
            const { engine, context } = setupValeWithLightningBoltInRange()
            const selectResult = processCommand("A2", engine, context)
            const aimResult = processCommand("2, 8", engine, selectResult.updatedContext!)
            expect(aimResult.mapText).toContain("HT")
        })

        it("CONFIRMING_ACTION map includes // markers on line path cells", () => {
            const { engine, context } = setupValeWithLightningBoltInRange()
            const selectResult = processCommand("A2", engine, context)
            const aimResult = processCommand("2, 8", engine, selectResult.updatedContext!)
            expect(aimResult.mapText).toContain("//")
        })

        it("CONFIRMING_ACTION map does not mark friendly squaddies as HT", () => {
            // Gloria is at (3,0), off the line of fire. She should never appear as HT.
            // Previously a bug caused squaddies sharing inBattleSquaddieId=0 (Vale, Gloria,
            // and Demon 0 all have index 0 within their outOfBattleSquaddieId bucket) to all
            // be treated as hit targets when any one of them was targeted.
            // The fix compares both inBattleSquaddieId AND outOfBattleSquaddieId.
            const { engine, context } = setupValeWithLightningBoltInRange()
            const selectResult = processCommand("A2", engine, context)
            const aimResult = processCommand("2, 8", engine, selectResult.updatedContext!)

            // The line from Vale at (2,2) to aim (2,8) hits exactly 3 demons at (2,6), (2,7), (2,8).
            // Vale and Gloria must NOT be counted. Without the fix, 5 markers appeared (Vale + Gloria + 3 demons).
            const htCount = (aimResult.mapText?.match(/HT/g) ?? []).length
            expect(htCount).toBe(3)
        })

        it("forecast contains a section for each demon in range along the line", () => {
            const { engine, context } = setupValeWithLightningBoltInRange()
            const selectResult = processCommand("A2", engine, context)
            const aimResult = processCommand("2, 8", engine, selectResult.updatedContext!)

            // Three demons at (2,6), (2,7), (2,8) are all named "Slither Demon".
            const forecastSections = aimResult.message.match(/Forecast for Slither Demon/g)
            expect(forecastSections).toBeDefined()
            expect(forecastSections!.length).toBeGreaterThanOrEqual(2)
        })

        it("pressing Y executes the action and returns to BROWSING", () => {
            const { engine, context } = setupValeWithLightningBoltInRange()
            const selectResult = processCommand("A2", engine, context)
            const aimResult = processCommand("2, 8", engine, selectResult.updatedContext!)
            const confirmResult = processCommand("Y", engine, aimResult.updatedContext!)
            expect(confirmResult.action).toBe("executeAction")
            expect(confirmResult.updatedContext?.interactionPhase).toBe(
                InteractionPhase.BROWSING
            )
        })
    })

    describe("Gravity Pull action — actor is the aim coordinate", () => {
        // Vale starts at (5,1); demons at (5,0), (4,4), (1,5), (2,5).
        // Gravity Pull (A1, sorted before Rescue) uses actorIsAimCoordinate: the aim
        // coordinate is always Vale's own position, so no target selection step is needed.
        const setupValeWithGravityPull = () => {
            // Use [4,4] rolls so targets get SUCCESS (not BOTCH) on their saving throw,
            // avoiding the "results must have at least one entry" error.
            const allFoursQueue = Array<number>(40).fill(4)
            const { engine, valeId } = createMovementMissionEngine(
                new RollGenerator(allFoursQueue)
            )
            const context: CommandContext = {
                selectedSquaddieId: valeId,
                interactionPhase: InteractionPhase.BROWSING,
                actingSquaddieId: undefined,
            }
            return { engine, context, valeId }
        }

        it("A1 (Gravity Pull) skips SELECTING_TARGET and enters CONFIRMING_ACTION directly", () => {
            const { engine, context } = setupValeWithGravityPull()
            const result = processCommand("A1", engine, context)
            expect(result.action).toBe("executeAction")
            expect(result.updatedContext?.interactionPhase).toBe(
                InteractionPhase.CONFIRMING_ACTION
            )
        })

        it("CONFIRMING_ACTION message prompts to confirm or cancel", () => {
            const { engine, context } = setupValeWithGravityPull()
            const result = processCommand("A1", engine, context)
            expect(result.message).toContain("Press Y to confirm or N/C to cancel")
        })

        it("pressing Y after A1 (Gravity Pull) executes the action and returns to BROWSING", () => {
            const { engine, context } = setupValeWithGravityPull()
            const result = processCommand("A1", engine, context)
            const confirmResult = processCommand("Y", engine, result.updatedContext!)
            expect(confirmResult.action).toBe("executeAction")
            expect(confirmResult.updatedContext?.interactionPhase).toBe(
                InteractionPhase.BROWSING
            )
        })
    })

    describe("Teleport action — Rescue (Vale rescues Fracta)", () => {
        // Map layout: Fracta at (2,2), Vale at (5,1), Demons at (1,5) and (2,5).
        // Vale's Rescue action: targets a friend within MEDIUM range, places them within
        // MELEE range of Vale. Sorted alphabetically, Rescue is A2 (Gravity Pull is A1).
        //
        // Because Fracta is the only friend within MEDIUM range, she is auto-selected
        // when A2 is initiated, and we jump directly to destination selection.

        // Selects Vale, initiates Rescue (A2), returns the destination-selection result.
        // Since Fracta is the only valid friend, she is auto-selected.
        const setupValeSelectsRescue = () => {
            const { engine, valeId } = createMovementMissionEngine()
            const context: CommandContext = {
                selectedSquaddieId: valeId,
                interactionPhase: InteractionPhase.BROWSING,
                actingSquaddieId: undefined,
            }
            // A2 = Rescue (vale-mt-rescue, sorted after vale-mt-gravity-pull)
            const result = processCommand("A2", engine, context)
            return { engine, valeId, result }
        }

        // Gets a valid teleport destination from the engine (tiles within MELEE of Vale).
        const getValidDestination = (
            engine: ReturnType<typeof createMovementMissionEngine>["engine"],
            valeId: ReturnType<typeof createMovementMissionEngine>["valeId"]
        ) => {
            const destinations = engine.getTargetDestinationsForAction(
                valeId,
                MovementTestMissionIds.vale.rescueActionId
            )
            expect(destinations.length).toBeGreaterThan(0)
            // Sort by row then col for deterministic selection regardless of engine return order.
            const sorted = [...destinations].sort((a, b) =>
                a.destination.row !== b.destination.row
                    ? a.destination.row - b.destination.row
                    : a.destination.col - b.destination.col
            )
            return sorted[0].destination
        }

        it("A2 (Rescue) auto-selects the only valid friend and enters destination selection", () => {
            const { result } = setupValeSelectsRescue()
            expect(result.action).toBe("executeAction")
            expect(result.updatedContext?.interactionPhase).toBe(
                InteractionPhase.SELECTING_TARGET
            )
            expect(result.updatedContext?.pendingActionIsSelectingTeleportDestination).toBe(true)
            expect(result.updatedContext?.pendingTeleportTargetId).toBeDefined()
            expect(result.message).toContain("Select destination")
        })

        it("selecting a valid destination near Vale enters CONFIRMING_ACTION with a forecast", () => {
            const { engine, valeId, result: rescueResult } = setupValeSelectsRescue()
            const destination = getValidDestination(engine, valeId)

            const destinationContext = rescueResult.updatedContext!
            const result = processCommand(
                `${destination.row},${destination.col}`, engine, destinationContext
            )

            expect(result.action).toBe("executeAction")
            expect(result.updatedContext?.interactionPhase).toBe(
                InteractionPhase.CONFIRMING_ACTION
            )
            // Message shows the destination coordinates the target will land on
            expect(result.message).toContain(
                `(${destination.row}, ${destination.col})`
            )
            expect(result.message).toContain("Press Y to confirm or N/C to cancel.")
        })

        it("an out-of-range destination cancels the action back to BROWSING", () => {
            const { engine, result: rescueResult } = setupValeSelectsRescue()
            const destinationContext = rescueResult.updatedContext!
            // Fracta's tile (2,2) is far from Vale — not within MELEE range
            const result = processCommand("2,2", engine, destinationContext)
            expect(result.action).toBe("cancelAction")
            expect(result.message).toContain("out of range")
            expect(result.updatedContext?.interactionPhase).toBe(
                InteractionPhase.BROWSING
            )
            expect(result.updatedContext?.pendingActionIsSelectingTeleportDestination).toBeUndefined()
        })

        it("canceling from destination selection (non-coordinate input) returns to BROWSING", () => {
            const { engine, result: rescueResult } = setupValeSelectsRescue()
            const destinationContext = rescueResult.updatedContext!
            const result = processCommand("cancel", engine, destinationContext)
            expect(result.action).toBe("cancelAction")
            expect(result.updatedContext?.interactionPhase).toBe(
                InteractionPhase.BROWSING
            )
        })

        it("Y in CONFIRMING_ACTION teleports Fracta and shows her new position", () => {
            const { engine, valeId, result: rescueResult } = setupValeSelectsRescue()
            const destination = getValidDestination(engine, valeId)

            const destinationContext = rescueResult.updatedContext!
            const confirmResult = processCommand(
                `${destination.row},${destination.col}`, engine, destinationContext
            )

            const confirmContext = confirmResult.updatedContext!
            const result = processCommand("Y", engine, confirmContext)

            expect(result.action).toBe("executeAction")
            expect(result.updatedContext?.interactionPhase).toBe(
                InteractionPhase.BROWSING
            )
            // Result message reports where Fracta was moved
            expect(result.message).toContain("is moved to")
            expect(result.message).toContain(
                `(${destination.row}, ${destination.col})`
            )
        })

        it("selecting Rescue without enough AP reports the real reason instead of drilling into destination selection", () => {
            const { engine, context } = setupValeWithInsufficientAPForRescue()

            const result = processCommand("A2", engine, context)

            expect(result.action).toBe("selectAction")
            expect(result.message).toContain("Cannot use Rescue")
            expect(result.message).toContain("action point")
            expect(result.updatedContext).toBeUndefined()
        })
    })

    // Spends Vale's AP down to 1 via Gravity Pull (A1, 2 AP), leaving her without
    // enough AP for Rescue (2 AP), and returns her to BROWSING.
    const setupValeWithInsufficientAPForRescue = () => {
        const allFoursQueue = Array<number>(40).fill(4)
        const { engine, valeId } = createMovementMissionEngine(
            new RollGenerator(allFoursQueue)
        )
        const context: CommandContext = {
            selectedSquaddieId: valeId,
            interactionPhase: InteractionPhase.BROWSING,
            actingSquaddieId: undefined,
        }
        const gravityPullResult = processCommand("A1", engine, context)
        processCommand("Y", engine, gravityPullResult.updatedContext!)

        return { engine, valeId, context }
    }

    describe("debug flag commands", () => {
        const createEngine = () => {
            const { engine } = createSimplePlayerVsEnemyMission(
                new RollGenerator([4, 4]),
            )
            return engine
        }

        describe("DF - show debug flags", () => {
            it("lists all known flags with their OFF state by default", () => {
                const engine = createEngine()
                const result = processCommand("DF", engine)
                expect(result.action).toBe("showDebugFlags")
                // Each known flag appears, numbered from 1
                DEBUG_FLAG_NAMES.forEach((name, index) => {
                    expect(result.message).toContain(`${index + 1}. ${name}: OFF`)
                })
            })

            it("shows ON after a flag has been enabled", () => {
                const engine = createEngine()
                engine.setDebugFlag("enemyAlwaysEndsTheirTurn", true)
                const result = processCommand("DF", engine)
                expect(result.action).toBe("showDebugFlags")
                expect(result.message).toContain("enemyAlwaysEndsTheirTurn: ON")
            })

            it("returns an error message when no engine is provided", () => {
                const result = processCommand("DF")
                expect(result.action).toBe("showDebugFlags")
                expect(result.message).toContain("No engine available")
            })
        })

        describe("DS <n> - toggle debug flag", () => {
            it("toggles enemyAlwaysEndsTheirTurn from OFF to ON", () => {
                const engine = createEngine()
                const result = processCommand("DS 1", engine)
                expect(result.action).toBe("setDebugFlag")
                expect(result.message).toContain("enemyAlwaysEndsTheirTurn: ON")
            })

            it("toggles enemyAlwaysEndsTheirTurn from ON back to OFF", () => {
                const engine = createEngine()
                engine.setDebugFlag("enemyAlwaysEndsTheirTurn", true)
                const result = processCommand("DS 1", engine)
                expect(result.action).toBe("setDebugFlag")
                expect(result.message).toContain("enemyAlwaysEndsTheirTurn: OFF")
            })

            it("toggles revealHiddenMissionObjectives from OFF to ON", () => {
                const engine = createEngine()
                const result = processCommand("DS 2", engine)
                expect(result.action).toBe("setDebugFlag")
                expect(result.message).toContain(
                    "revealHiddenMissionObjectives: ON"
                )
            })

            it("returns an error for an out-of-range flag number", () => {
                const engine = createEngine()
                const result = processCommand("DS 99", engine)
                expect(result.action).toBe("setDebugFlag")
                expect(result.message).toContain("Invalid flag number")
            })

            it("returns an error when no number is provided", () => {
                const engine = createEngine()
                const result = processCommand("DS", engine)
                expect(result.action).toBe("setDebugFlag")
                expect(result.message).toContain("Invalid flag number")
            })

            it("returns an error message when no engine is provided", () => {
                const result = processCommand("DS 1")
                expect(result.action).toBe("setDebugFlag")
                expect(result.message).toContain("No engine available")
            })
        })
    })
})

function drainNonPlayerTurns(engine: MissionEngine) {
    for (let i = 0; i < 20; i++) {
        if (engine.getCurrentAffiliationTurn() === MissionAffiliationTurn.PLAYER_TURN) return
        if (engine.getReadiedAction() != undefined) {
            engine.useActionAndGetResults()
        } else {
            engine.transitionToNextPhase()
        }
    }
    throw new Error("[drainNonPlayerTurns] PLAYER_TURN not reached within iteration limit")
}
