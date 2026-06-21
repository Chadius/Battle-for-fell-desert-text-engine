import { describe, it, expect } from "vitest"
import { TextMissionRunner } from "./textMissionRunner.js"
import {
    MissionEngineTestHarness,
    MissionEngineTestHarnessIds,
} from "../logic/src/testUtils/mission/missionEngineTestHarness.js"
import {
    SquaddieConditionDecaysAt,
    SquaddieConditionService,
    SquaddieConditionSource,
    SquaddieConditionType,
} from "../logic/src/proficiency/squaddieCondition.js"
import type { Movie } from "../logic/src/movie/movie.js"
import { MovieSceneType } from "../logic/src/movie/movieScene.js"
import { MovieSceneImageService } from "../logic/src/movie/movieSceneImage.js"
import { MissionObjectiveService } from "../logic/src/mission/missionObjective.js"
import { MissionObjectiveRewardService } from "../logic/src/mission/missionObjectiveReward.js"
import { MissionObjectiveCriteriaService } from "../logic/src/mission/missionObjectiveCriteria.js"
import { SquaddieAffiliation } from "../logic/src/affiliation/affiliation.js"

// Minimal single-IMAGE-scene movie. No caption or description, so
// currentSceneText() returns only the "[Enter/N to continue, S to stop movie]" prompt.
const makeImageMovie = (): Movie => ({
    id: "test-movie",
    firstSceneId: "scene-1",
    scenes: [
        {
            type: MovieSceneType.IMAGE,
            data: MovieSceneImageService.new({
                id: "scene-1",
                resourceManifestEntryId: "placeholder",
            }),
        },
    ],
})

// Single CONVERSATION scene with a DECISION line; options use numeric string IDs.
const makeDecisionMovie = (): Movie => ({
    id: "test-decision-movie",
    firstSceneId: "decision-scene",
    scenes: [
        {
            type: MovieSceneType.CONVERSATION,
            data: {
                id: "decision-scene",
                nextSceneId: undefined,
                lines: [
                    {
                        type: "DECISION" as const,
                        prompt: { "en-us": { text: "What do you choose?" } },
                        options: [
                            {
                                decisionId: "1",
                                text: { "en-us": { text: "Option A" } },
                            },
                            {
                                decisionId: "2",
                                text: { "en-us": { text: "Option B" } },
                            },
                        ],
                    },
                ],
            },
        },
    ],
})

// Single CONVERSATION scene with the given dialog lines (en-us text strings).
const makeConversationMovie = (lines: string[]): Movie => ({
    id: "test-movie",
    firstSceneId: "scene-1",
    scenes: [
        {
            type: MovieSceneType.CONVERSATION,
            data: {
                id: "scene-1",
                nextSceneId: undefined,
                lines: lines.map((text) => ({
                    type: "DIALOG" as const,
                    text: { "en-us": { text } },
                })),
            },
        },
    ],
})

describe("TextMissionRunner", () => {
    describe("getWelcomeText", () => {
        it("returns a string containing the game title", () => {
            const engine = new MissionEngineTestHarness()
            const runner = new TextMissionRunner(engine)
            expect(runner.getWelcomeText()).toContain("Battle of Fell Desert CLI")
        })

        it("includes objective text when the engine has objectives", () => {
            const engine = new MissionEngineTestHarness()
            const runner = new TextMissionRunner(engine)
            expect(runner.getWelcomeText()).toContain("Objective:")
        })

        it("includes the map name from the engine", () => {
            const engine = new MissionEngineTestHarness()
            const runner = new TextMissionRunner(engine)
            expect(runner.getWelcomeText()).toContain("Map: Test Harness Map")
        })
    })

    describe("processInput", () => {
        it("returns shouldQuit true with goodbye text for Q", () => {
            const engine = new MissionEngineTestHarness()
            const runner = new TextMissionRunner(engine)
            const result = runner.processInput("Q")
            expect(result.shouldQuit).toBe(true)
            expect(result.text).toBe("Goodbye!")
        })

        it("returns shouldQuit false with map text for M", () => {
            const engine = new MissionEngineTestHarness()
            const runner = new TextMissionRunner(engine)
            const result = runner.processInput("M")
            expect(result.shouldQuit).toBe(false)
            expect(result.text).toContain("Test Harness Map")
        })

        it("updates internal context when a coordinate with a squaddie is inspected, allowing L to show details", () => {
            const engine = new MissionEngineTestHarness()
            const runner = new TextMissionRunner(engine)

            runner.processInput("0, 0")

            const lookResult = runner.processInput("L")
            expect(lookResult.shouldQuit).toBe(false)
            expect(lookResult.text).toContain("Lini")
        })
    })

    describe("AM movement integration", () => {
        it("shows AP cost digits on movement map after AM command", () => {
            const engine = new MissionEngineTestHarness()
            const runner = new TextMissionRunner(engine)

            runner.processInput("0, 0")
            runner.processInput("AM")
            expect(runner.getMapText()).toMatch(/[123]/)
        })

        it("shows moves to message and route map after entering a valid destination", () => {
            const engine = new MissionEngineTestHarness()
            const runner = new TextMissionRunner(engine)

            runner.processInput("0, 0")
            runner.processInput("AM")
            const result = runner.processInput("0, 1")
            expect(result.text).toContain("moves to")
        })
    })

    describe("condition expiration messages", () => {
        it("announces when a TURN_END condition expires after ending the squaddie turn", () => {
            const engine = new MissionEngineTestHarness()
            const runner = new TextMissionRunner(engine)

            const liniId = engine.getLiniSquaddieId()
            engine.missionManager!.inBattleSquaddieManager!.addConditionsToSquaddie(
                {
                    ...liniId,
                    conditions: [
                        SquaddieConditionService.new({
                            type: SquaddieConditionType.ARMOR,
                            amount: { amount: 2 },
                            duration: {
                                duration: 1,
                                decaysAt: SquaddieConditionDecaysAt.TURN_END,
                            },
                            source: SquaddieConditionSource.SPIRITUAL,
                        }),
                    ],
                }
            )

            runner.processInput("0, 0")
            const result = runner.processInput("AE")

            expect(result.text).toContain("Lini")
            expect(result.text).toContain("Armor")
            expect(result.text).toContain("expired")
        })
    })

    describe("mission completion", () => {
        it("returns shouldQuit true with Mission Complete when all enemies are defeated", () => {
            const engine = new MissionEngineTestHarness()
            const runner = new TextMissionRunner(engine)

            const slitherDemonId = engine.getSlitherDemonSquaddieId()
            engine.missionManager!.inBattleSquaddieManager!.dealDamageToSquaddie({
                ...slitherDemonId,
                damage: { amount: 100, type: undefined },
            })

            runner.processInput("0, 0")
            const result = runner.processInput("AE")

            expect(result.shouldQuit).toBe(true)
            expect(result.text).toContain("Mission Complete!")
        })

        it("includes turn number and survivor name in the mission summary", () => {
            const engine = new MissionEngineTestHarness()
            const runner = new TextMissionRunner(engine)

            const slitherDemonId = engine.getSlitherDemonSquaddieId()
            engine.missionManager!.inBattleSquaddieManager!.dealDamageToSquaddie({
                ...slitherDemonId,
                damage: { amount: 100, type: undefined },
            })

            runner.processInput("0, 0")
            const result = runner.processInput("AE")

            expect(result.text).toContain("turn")
            expect(result.text).toContain("Lini")
        })
    })

    describe("movie mode", () => {
        describe("when a PLAY_MOVIE reward is triggered by completing an objective", () => {
            it("shows the first movie scene instead of ending the mission immediately", () => {
                const { runner, engine } = makeRunnerWithVictoryMovieObjective("Victory scene")
                // Select Lini while the enemy is still alive so no mission completion fires yet
                runner.processInput("0, 0")
                // Kill the enemy after context is set; AE will then trigger the PLAY_MOVIE reward
                engine.defeatSlitherDemon()

                const result = runner.processInput("AE")

                expect(result.text).toContain("Victory scene")
            })
        })

        describe("when a movie is playing", () => {
            it("shows the movie scene prompt when a game command is sent during movie playback", () => {
                const engine = new MissionEngineTestHarness()
                const runner = new TextMissionRunner(engine)
                engine.playMovie(makeImageMovie(), [])

                const result = runner.processInput("M")

                expect(result.text).toContain("[Enter/N to continue, S to stop movie]")
            })

            it("advances to the next dialog line when Enter is sent", () => {
                const engine = new MissionEngineTestHarness()
                const runner = new TextMissionRunner(engine)
                engine.playMovie(makeConversationMovie(["First line", "Second line"]), [])

                const result = runner.processInput("")

                expect(result.text).toContain("Second line")
            })

            it("advances to the next dialog line when N is sent", () => {
                const engine = new MissionEngineTestHarness()
                const runner = new TextMissionRunner(engine)
                engine.playMovie(makeConversationMovie(["First line", "Second line"]), [])

                const result = runner.processInput("N")

                expect(result.text).toContain("Second line")
            })

            it("quits immediately when Q is sent", () => {
                const engine = new MissionEngineTestHarness()
                const runner = new TextMissionRunner(engine)
                engine.playMovie(makeConversationMovie(["First line", "Second line"]), [])

                const result = runner.processInput("Q")

                expect(result.shouldQuit).toBe(true)
            })

            it("shows the mission summary and quits when the last dialog line is confirmed and the mission is done", () => {
                const engine = new MissionEngineTestHarness()
                const runner = new TextMissionRunner(engine)
                engine.defeatSlitherDemon()
                engine.markMissionObjectiveAsRewarded(
                    MissionEngineTestHarnessIds.objectives.defeatAllEnemies
                )
                // Single-line movie — confirming it ends the movie immediately
                engine.playMovie(makeConversationMovie(["Victory scene"]), [])

                const result = runner.processInput("")

                expect(result.shouldQuit).toBe(true)
                expect(result.text).toContain("Mission Complete!")
            })

            it("stops the movie and shows the mission summary when S is sent and the mission is done", () => {
                const engine = new MissionEngineTestHarness()
                const runner = new TextMissionRunner(engine)
                engine.defeatSlitherDemon()
                engine.markMissionObjectiveAsRewarded(
                    MissionEngineTestHarnessIds.objectives.defeatAllEnemies
                )
                engine.playMovie(makeConversationMovie(["Victory scene"]), [])

                const result = runner.processInput("S")

                expect(result.shouldQuit).toBe(true)
                expect(result.text).toContain("Mission Complete!")
            })

            describe("decision scenes", () => {
                it("shows the choice list and a hint footer when an unrecognised option is entered", () => {
                    const engine = new MissionEngineTestHarness()
                    const runner = new TextMissionRunner(engine)
                    engine.playMovie(makeDecisionMovie(), [])

                    const result = runner.processInput("99")

                    expect(result.text).toContain('"99"')
                    expect(result.text).toContain("1) Option A")
                    expect(result.text).toContain("2) Option B")
                    expect(result.text).toContain("[Type the option number to choose, S to stop]")
                })

                it("ends the movie when a valid decision ID is entered", () => {
                    const engine = new MissionEngineTestHarness()
                    const runner = new TextMissionRunner(engine)
                    engine.playMovie(makeDecisionMovie(), [])

                    runner.processInput("1")

                    expect(engine.isMoviePlaying()).toBe(false)
                })

                it("keeps the movie playing and shows choices without an error when S is sent during a decision scene", () => {
                    const engine = new MissionEngineTestHarness()
                    const runner = new TextMissionRunner(engine)
                    engine.playMovie(makeDecisionMovie(), [])

                    const result = runner.processInput("S")

                    expect(engine.isMoviePlaying()).toBe(true)
                    expect(result.text).toContain("1) Option A")
                    expect(result.text).not.toContain("is not a valid choice")
                })
            })
        })
    })

    describe("phase announcements", () => {
        describe("getWelcomeText", () => {
            it("contains the turn start announcement for the initial turn", () => {
                const engine = new MissionEngineTestHarness()
                const runner = new TextMissionRunner(engine)
                expect(runner.getWelcomeText()).toContain("Turn 0 start")
            })

            it("contains the player turn announcement after advancing through startup phases", () => {
                const engine = new MissionEngineTestHarness()
                const runner = new TextMissionRunner(engine)
                expect(runner.getWelcomeText()).toContain("Player Turn")
            })
        })

        describe("processInput", () => {
            it("announces enemy turn after Lini ends her turn", () => {
                const engine = new MissionEngineTestHarness()
                const runner = new TextMissionRunner(engine)

                runner.processInput("0, 0")
                const result = runner.processInput("AE")

                expect(result.text).toContain("Enemy Turn")
            })
        })
    })
})

// Registers a PLAY_MOVIE objective tied to defeating all enemies and returns the configured engine and runner.
const makeRunnerWithVictoryMovieObjective = (
    dialogLine: string
): { runner: TextMissionRunner; engine: MissionEngineTestHarness } => {
    const movie = makeConversationMovie([dialogLine])
    const engine = new MissionEngineTestHarness()
    engine.registerMovie(movie)
    engine.addObjective(
        MissionObjectiveService.new({
            id: "play-victory-movie",
            rewards: [MissionObjectiveRewardService.newPlayMovieReward("test-movie")],
            criteria: [
                MissionObjectiveCriteriaService.newSquaddiesDefeatedCriteria({
                    affiliations: [SquaddieAffiliation.ENEMY],
                }),
            ],
        })
    )
    return { runner: new TextMissionRunner(engine), engine }
}
