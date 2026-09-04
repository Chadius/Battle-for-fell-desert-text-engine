import { describe, it, expect, beforeEach } from "vitest"
import { TextMissionRunner } from "./textMissionRunner.js"
import type { ProcessInputResult } from "./textMissionRunner.js"
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
import { MissionAffiliationTurn } from "../logic/src/mission/missionTurn.js"
import { SquaddieAffiliation } from "../logic/src/affiliation/affiliation.js"
import { ResourceManifestEntryService } from "../logic/src/resource/resourceManifest.js"
import { ResourceManifestCollectionService } from "../logic/src/resource/resourceManifestCollection.js"
import {
    buildEngineWithFullyResolvedDeployment,
    buildEngineWithTwoOpenCoordinates,
    buildLockedDeploymentEngine,
} from "./testUtils/deploymentFixture.js"
import { glossaryManagerWith } from "./testUtils/glossaryFixture.js"

// Single IMAGE-scene movie. Optional caption and resourceManifestEntryId control what the scene displays.
const makeImageMovie = (opts: { caption?: string; resourceManifestEntryId?: string } = {}): Movie => ({
    id: "test-image-movie",
    firstSceneId: "scene-1",
    scenes: [
        {
            type: MovieSceneType.IMAGE,
            data: MovieSceneImageService.new({ id: "scene-1", ...opts }),
        },
    ],
})

// Single CONVERSATION scene with a DECISION line; options use descriptive string IDs (not numeric)
// so tests can verify positional display (1, 2) is distinct from the underlying decisionId.
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
                                decisionId: "option-a",
                                text: { "en-us": { text: "Option A" } },
                            },
                            {
                                decisionId: "option-b",
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

// Single CONVERSATION scene with one dialog line carrying a portrait pointing at resourceManifestEntryId.
const makeConversationMovieWithPortrait = (text: string, resourceManifestEntryId: string): Movie => ({
    id: "test-portrait-movie",
    firstSceneId: "scene-1",
    scenes: [
        {
            type: MovieSceneType.CONVERSATION,
            data: {
                id: "scene-1",
                nextSceneId: undefined,
                lines: [
                    {
                        type: "DIALOG" as const,
                        text: { "en-us": { text } },
                        portrait: { resourceManifestEntryId, position: "LEFT" as const },
                    },
                ],
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

        it("resolves glossary terms for G when a glossaryManager was supplied to the runner", () => {
            const engine = new MissionEngineTestHarness()
            const glossaryManager = glossaryManagerWith([
                {
                    termId: "condition.ARMOR",
                    type: "SQUADDIE_CONDITION_TYPE",
                    name: "Armor",
                    definition: "Reduces the chance you get hit.",
                },
            ])
            const runner = new TextMissionRunner(engine, Date.now, glossaryManager)

            const result = runner.processInput("G")

            expect(result.text).toContain("Armor - Reduces the chance you get hit.")
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
        let result: ProcessInputResult

        beforeEach(() => {
            const engine = new MissionEngineTestHarness()
            const runner = new TextMissionRunner(engine)
            engine.defeatSlitherDemon()

            runner.processInput("0, 0")
            result = runner.processInput("AE")
        })

        it("returns shouldQuit true with Mission Complete when all enemies are defeated", () => {
            expect(result.shouldQuit).toBe(true)
            expect(result.text).toContain("Mission Complete!")
        })

        it("includes turn number and survivor name in the mission summary", () => {
            expect(result.text).toContain("Completed on turn 0.")
            expect(result.text).toContain("Survivors: Lini")
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

        describe("when a PLAY_MOVIE reward is triggered by a PHASE_REACHED objective already satisfied at construction", () => {
            it("shows the movie instead of silently skipping past it during phase advancement", () => {
                const { runner } = makeRunnerWithPhaseReachedMovieObjective("Intro speech")

                expect(runner.getWelcomeText()).toContain("Intro speech")
            })

            it("holds off on the objectives list until the movie finishes", () => {
                const { runner } = makeRunnerWithPhaseReachedMovieObjective("Intro speech")

                expect(runner.getWelcomeText()).not.toContain("Objective:")
            })
        })

        describe("when a movie is playing", () => {
            it("flags unrecognised input as invalid and re-shows the scene prompt", () => {
                const engine = new MissionEngineTestHarness()
                const runner = new TextMissionRunner(engine)
                engine.playMovie(makeImageMovie())

                const result = runner.processInput("0, 0")

                expect(result.text).toContain(`"0, 0" is not a valid command while a movie is playing.`)
                expect(result.text).toContain("[Enter/N to continue, S to stop movie]")
            })

            describe("when the movie scene is an image", () => {
                it("shows '[Image] No description given' and the caption when no resource entry is present", () => {
                    const engine = new MissionEngineTestHarness()
                    const runner = new TextMissionRunner(engine)
                    engine.playMovie(makeImageMovie({ caption: "Move your squaddie forward." }))

                    const result = runner.processInput("M")

                    expect(result.text).toContain("[Image] No description given")
                    expect(result.text).toContain("Move your squaddie forward.")
                })

                it("shows '[Image]' followed by the description from the resource manifest", () => {
                    const engine = new MissionEngineTestHarness()
                    const runner = new TextMissionRunner(engine)
                    engine.registerResourceCollections(makeImageResourceCollection())
                    engine.playMovie(
                        makeImageMovie({ resourceManifestEntryId: BATTLE_OVERVIEW_RESOURCE_ID })
                    )

                    const result = runner.processInput("M")

                    expect(result.text).toContain("[Image] A wide view of the fell desert battlefield")
                })

                it("shows both the description label and the caption when both are provided", () => {
                    const engine = new MissionEngineTestHarness()
                    const runner = new TextMissionRunner(engine)
                    engine.registerResourceCollections(makeImageResourceCollection())
                    engine.playMovie(
                        makeImageMovie({ resourceManifestEntryId: BATTLE_OVERVIEW_RESOURCE_ID, caption: "The desert stretches endlessly." })
                    )

                    const result = runner.processInput("M")

                    expect(result.text).toContain("[Image] A wide view of the fell desert battlefield")
                    expect(result.text).toContain("The desert stretches endlessly.")
                })
            })

            describe("when the movie scene is a conversation with a portrait", () => {
                it("shows '[Portrait]' followed by the description from the resource manifest", () => {
                    const engine = new MissionEngineTestHarness()
                    const runner = new TextMissionRunner(engine)
                    engine.registerResourceCollections(makePortraitResourceCollection())
                    engine.playMovie(
                        makeConversationMovieWithPortrait("Hello there.", PORTRAIT_RESOURCE_ID)
                    )

                    const result = runner.processInput("M")

                    expect(result.text).toContain("[Portrait] A grizzled desert scout.")
                    expect(result.text).toContain("Hello there.")
                })

                it("omits the portrait line when no matching resource entry is present", () => {
                    const engine = new MissionEngineTestHarness()
                    const runner = new TextMissionRunner(engine)
                    engine.playMovie(
                        makeConversationMovieWithPortrait("Hello there.", "missing-portrait")
                    )

                    const result = runner.processInput("M")

                    expect(result.text).not.toContain("[Portrait]")
                    expect(result.text).toContain("Hello there.")
                })
            })

            describe("when a two-line conversation movie is playing", () => {
                let engine: MissionEngineTestHarness
                let runner: TextMissionRunner

                beforeEach(() => {
                    engine = new MissionEngineTestHarness()
                    runner = new TextMissionRunner(engine)
                    engine.playMovie(makeConversationMovie(["First line", "Second line"]))
                })

                it("advances to the next dialog line when Enter is sent", () => {
                    const result = runner.processInput("")

                    expect(result.text).toContain("Second line")
                })

                it("advances to the next dialog line when N is sent", () => {
                    const result = runner.processInput("N")

                    expect(result.text).toContain("Second line")
                })

                it("quits immediately when Q is sent", () => {
                    const result = runner.processInput("Q")

                    expect(result.shouldQuit).toBe(true)
                })
            })

            describe("when dialogue text references TIME_ELAPSED", () => {
                it("formats the accumulated decision time as m:ss", () => {
                    let currentMs = 0
                    const engine = new MissionEngineTestHarness()
                    const runner = new TextMissionRunner(engine, () => currentMs)

                    currentMs += 65000
                    runner.processInput("0, 0")

                    engine.playMovie(
                        makeConversationMovie(["Elapsed: {timeFormat(TIME_ELAPSED, m:ss)}"])
                    )
                    const result = runner.processInput("M")

                    expect(result.text).toContain("Elapsed: 1:05")
                })
            })

            describe("when the mission is done and a single-scene movie is playing", () => {
                let engine: MissionEngineTestHarness
                let runner: TextMissionRunner

                beforeEach(() => {
                    engine = new MissionEngineTestHarness()
                    runner = new TextMissionRunner(engine)
                    engine.defeatSlitherDemon()
                    engine.markMissionObjectiveAsRewarded(
                        MissionEngineTestHarnessIds.objectives.defeatAllEnemies
                    )
                    engine.playMovie(makeConversationMovie(["Victory scene"]))
                })

                it("shows the mission summary and quits when the last dialog line is confirmed", () => {
                    const result = runner.processInput("")

                    expect(result.shouldQuit).toBe(true)
                    expect(result.text).toContain("Mission Complete!")
                })

                it("shows the mission summary and quits when S is sent", () => {
                    const result = runner.processInput("S")

                    expect(result.shouldQuit).toBe(true)
                    expect(result.text).toContain("Mission Complete!")
                })
            })

            describe("when a decision scene is playing", () => {
                let engine: MissionEngineTestHarness
                let runner: TextMissionRunner

                beforeEach(() => {
                    engine = new MissionEngineTestHarness()
                    runner = new TextMissionRunner(engine)
                    engine.playMovie(makeDecisionMovie())
                })

                it("shows the choice list and a hint footer when an unrecognised option is entered", () => {
                    const result = runner.processInput("99")

                    expect(result.text).toContain('"99"')
                    expect(result.text).toContain("1) Option A")
                    expect(result.text).toContain("2) Option B")
                    expect(result.text).toContain("[Type the option number to choose, S to stop]")
                })

                it("ends the movie when the player types the position number of a decision option", () => {
                    const result = runner.processInput("1")

                    expect(result.text).not.toContain("1) Option A")
                })

                it("still shows the choice list when S is entered during a decision scene", () => {
                    const result = runner.processInput("S")

                    expect(result.text).toContain("1) Option A")
                })

                it("does not show an error message when S is entered during a decision scene", () => {
                    const result = runner.processInput("S")

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

    describe("decision clock", () => {
        // A controllable stand-in for Date.now(): advance() simulates wall-clock time passing
        // between prompts without needing real sleeps in the test.
        const makeClock = () => {
            let currentMs = 0
            return {
                now: () => currentMs,
                advance: (ms: number) => {
                    currentMs += ms
                },
            }
        }

        it("accumulates time spent waiting for player input during the player's turn", () => {
            const engine = new MissionEngineTestHarness()
            const clock = makeClock()
            const runner = new TextMissionRunner(engine, clock.now)

            clock.advance(5000)
            runner.processInput("0, 0")
            clock.advance(3000)
            runner.processInput("M")

            expect(runner.getElapsedDecisionTimeMs()).toBe(8000)
        })

        it("does not attribute any elapsed time to the automatic enemy turn", () => {
            const engine = new MissionEngineTestHarness()
            const clock = makeClock()
            const runner = new TextMissionRunner(engine, clock.now)

            clock.advance(4000)
            runner.processInput("0, 0")
            clock.advance(2000)
            runner.processInput("AE")

            expect(runner.getElapsedDecisionTimeMs()).toBe(6000)

            clock.advance(1500)
            runner.processInput("M")

            expect(runner.getElapsedDecisionTimeMs()).toBe(7500)
        })

        it("does not count time spent while a movie is playing", () => {
            // The movie must start as a consequence of processInput (a PLAY_MOVIE reward
            // firing mid-action), matching how the real app triggers movies. The runner never
            // sees engine state change except through processInput, so that's the only
            // realistic way to exercise the clock pausing for dialogue.
            const engine = new MissionEngineTestHarness()
            registerVictoryMovieObjective(engine, "Victory scene")
            const clock = makeClock()
            const runner = new TextMissionRunner(engine, clock.now)

            clock.advance(4000)
            runner.processInput("0, 0")
            engine.defeatSlitherDemon()
            clock.advance(2000)
            const triggerResult = runner.processInput("AE")

            expect(triggerResult.text).toContain("Victory scene")
            const elapsedWhenMovieStarted = runner.getElapsedDecisionTimeMs()
            expect(elapsedWhenMovieStarted).toBe(6000)

            clock.advance(10000)
            runner.processInput("")

            expect(runner.getElapsedDecisionTimeMs()).toBe(elapsedWhenMovieStarted)
        })
    })

    describe("campaign squaddie deployment", () => {
        it("shows deployment status instead of the normal welcome/map while deployment is pending", () => {
            const engine = buildLockedDeploymentEngine()

            const runner = new TextMissionRunner(engine)

            expect(runner.getWelcomeText()).toContain("Deploy your squad")
            expect(runner.getMapText()).toContain("Deployment")
        })

        it("does not place any squaddies on the map until deployment is finalized", () => {
            const engine = buildLockedDeploymentEngine()

            new TextMissionRunner(engine)

            expect(engine.getAllSquaddiePositions()).toEqual([])
        })

        it("shows deployment status when W is entered before deployment is finalized", () => {
            const engine = buildLockedDeploymentEngine()
            const runner = new TextMissionRunner(engine)

            const result = runner.processInput("W")

            expect(result.text).toContain("Otto")
        })

        it("quits when Q is entered during deployment", () => {
            const engine = buildLockedDeploymentEngine()
            const runner = new TextMissionRunner(engine)

            const result = runner.processInput("Q")

            expect(result.shouldQuit).toBe(true)
        })

        it("starts the mission once deployment is finalized", () => {
            const engine = buildLockedDeploymentEngine()
            const runner = new TextMissionRunner(engine)

            runner.processInput("F")

            expect(engine.isCampaignSquaddieDeploymentInProgress()).toBe(false)
            expect(engine.getAllSquaddiePositions().length).toBeGreaterThan(0)
            expect(runner.getMapText()).not.toContain("— Deployment")
        })

        it("auto-finalizes when every coordinate is already resolved and nothing is unplaced", () => {
            const engine = buildEngineWithFullyResolvedDeployment()

            const runner = new TextMissionRunner(engine)

            expect(engine.isCampaignSquaddieDeploymentInProgress()).toBe(false)
            expect(engine.getAllSquaddiePositions().length).toBe(1)
            expect(runner.getWelcomeText()).not.toContain("Deploy your squad")
        })

        describe("when a PLAY_MOVIE reward is satisfied before deployment begins", () => {
            const buildEngineWithPreDeploymentMovie = () =>
                buildEngineWithTwoOpenCoordinates({
                    movies: [makeConversationMovie(["Welcome to the desert."])],
                    objectives: [
                        MissionObjectiveService.new({
                            id: "pre-deployment-briefing",
                            rewards: [
                                MissionObjectiveRewardService.newPlayMovieReward(
                                    "test-movie"
                                ),
                            ],
                            criteria: [
                                MissionObjectiveCriteriaService.newPhaseReachedCriteria(
                                    {
                                        turnCount: 0,
                                        missionAffiliationTurn:
                                            MissionAffiliationTurn.TURN_START,
                                    }
                                ),
                            ],
                        }),
                    ],
                })

            it("shows the movie instead of the deployment screen", () => {
                const engine = buildEngineWithPreDeploymentMovie()

                const runner = new TextMissionRunner(engine)

                expect(runner.getWelcomeText()).toContain("Welcome to the desert.")
                expect(runner.getWelcomeText()).not.toContain("Deploy your squad")
            })

            it("routes input to the movie instead of deployment commands while it plays", () => {
                const engine = buildEngineWithPreDeploymentMovie()
                const runner = new TextMissionRunner(engine)

                const result = runner.processInput("W")

                expect(result.text).toContain("Welcome to the desert.")
                expect(result.text).not.toContain("Alice")
            })

            it("shows the deployment screen once the movie finishes", () => {
                const engine = buildEngineWithPreDeploymentMovie()
                const runner = new TextMissionRunner(engine)

                runner.processInput("")

                expect(runner.getWelcomeText()).toContain("Deploy your squad")
            })
        })
    })
})

// Resource ID shared between makeImageMovie call sites and makeImageResourceCollection.
const BATTLE_OVERVIEW_RESOURCE_ID = "battle-overview"

// Resource collection containing one image entry with an en-us description.
const makeImageResourceCollection = () => {
    const entry = ResourceManifestEntryService.new({
        id: BATTLE_OVERVIEW_RESOURCE_ID,
        label: "Battle Overview",
        description: {
            "en-us": { text: "A wide view of the fell desert battlefield" },
        },
        type: "IMAGE",
    })
    return [
        ResourceManifestCollectionService.add(
            ResourceManifestCollectionService.new(),
            BATTLE_OVERVIEW_RESOURCE_ID,
            entry
        ),
    ]
}

// Resource ID shared between makeConversationMovieWithPortrait call sites and makePortraitResourceCollection.
const PORTRAIT_RESOURCE_ID = "npc-scout-portrait"

// Resource collection containing one portrait entry with an en-us description.
const makePortraitResourceCollection = () => {
    const entry = ResourceManifestEntryService.new({
        id: PORTRAIT_RESOURCE_ID,
        label: "Desert Scout Portrait",
        description: {
            "en-us": { text: "A grizzled desert scout." },
        },
        type: "IMAGE",
    })
    return [
        ResourceManifestCollectionService.add(
            ResourceManifestCollectionService.new(),
            PORTRAIT_RESOURCE_ID,
            entry
        ),
    ]
}

// Registers a PLAY_MOVIE objective tied to defeating all enemies onto an existing engine.
const registerVictoryMovieObjective = (
    engine: MissionEngineTestHarness,
    dialogLine: string
): void => {
    engine.registerMovie(makeConversationMovie([dialogLine]))
    engine.addObjective(
        MissionObjectiveService.new({
            id: "play-victory-movie",
            rewards: [MissionObjectiveRewardService.newPlayMovieReward("test-movie")],
            criteria: [
                MissionObjectiveCriteriaService.newAllSquaddiesDefeatedCriteria({
                    affiliations: [SquaddieAffiliation.ENEMY],
                }),
            ],
        })
    )
}

// Registers a PLAY_MOVIE objective tied to defeating all enemies and returns the configured engine and runner.
const makeRunnerWithVictoryMovieObjective = (
    dialogLine: string
): { runner: TextMissionRunner; engine: MissionEngineTestHarness } => {
    const engine = new MissionEngineTestHarness()
    registerVictoryMovieObjective(engine, dialogLine)
    return { runner: new TextMissionRunner(engine), engine }
}

// Registers a PLAY_MOVIE objective tied to a PHASE_REACHED criteria already satisfied at the
// mission's starting turn/phase, and returns the configured engine and runner.
const makeRunnerWithPhaseReachedMovieObjective = (
    dialogLine: string
): { runner: TextMissionRunner; engine: MissionEngineTestHarness } => {
    const movie = makeConversationMovie([dialogLine])
    const engine = new MissionEngineTestHarness()
    engine.registerMovie(movie)
    engine.addObjective(
        MissionObjectiveService.new({
            id: "intro-speech",
            rewards: [MissionObjectiveRewardService.newPlayMovieReward("test-movie")],
            criteria: [
                MissionObjectiveCriteriaService.newPhaseReachedCriteria({
                    turnCount: 0,
                    missionAffiliationTurn: MissionAffiliationTurn.TURN_START,
                }),
            ],
        })
    )
    return { runner: new TextMissionRunner(engine), engine }
}
