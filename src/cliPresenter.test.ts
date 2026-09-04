import { describe, it, expect } from "vitest"
import { CliPresenter } from "./cliPresenter.js"
import { MissionEngineTestHarness } from "../logic/src/testUtils/mission/missionEngineTestHarness.js"
import { MissionAffiliationTurn } from "../logic/src/mission/missionTurn.js"
import { SquaddieConditionType } from "../logic/src/proficiency/squaddieCondition.js"
import type { RunnerEvent } from "./runnerEvent.js"

describe("CliPresenter", () => {
    describe("the welcome screen", () => {
        it("shows the game title and the map name from the engine", () => {
            const text = welcomeText()
            expect(text).toContain("Battle of Fell Desert CLI")
            expect(text).toContain("Map: Test Harness Map")
        })

        it("lists the in-progress mission objectives", () => {
            const engine = new MissionEngineTestHarness()
            expect(engine.getInProgressMissionObjectives().length).toBeGreaterThan(0)

            expect(new CliPresenter(engine).welcomeText([], undefined)).toContain("Objective:")
        })

        it("renders the supplied opening phase events", () => {
            const text = welcomeText({
                phaseEvents: [{ kind: "message", text: "Turn 0 start" }],
            })
            expect(text).toContain("Turn 0 start")
        })
    })

    describe("the map panel", () => {
        it("renders the plain map when no overlay is active", () => {
            expect(mapText()).toContain("Test Harness Map")
        })

        it("returns the overlay map verbatim when one is active", () => {
            expect(mapText("OVERLAY")).toBe("OVERLAY")
        })
    })

    describe("rendering runner events", () => {
        it("labels a player-turn-start announcement", () => {
            expect(
                render([
                    {
                        kind: "phaseAnnouncement",
                        phase: MissionAffiliationTurn.PLAYER_TURN_START,
                        turnNumber: 1,
                    },
                ])
            ).toBe("Player Turn")
        })

        it("numbers the turn on a turn-start announcement", () => {
            expect(
                render([
                    {
                        kind: "phaseAnnouncement",
                        phase: MissionAffiliationTurn.TURN_START,
                        turnNumber: 3,
                    },
                ])
            ).toBe("Turn 3 start")
        })

        it("shows nothing for a phase with no player-facing label", () => {
            expect(
                render([
                    {
                        kind: "phaseAnnouncement",
                        phase: MissionAffiliationTurn.PLAYER_TURN,
                        turnNumber: 1,
                    },
                ])
            ).toBe("")
        })

        it("names the squaddie and the condition when a condition expires", () => {
            expect(
                render([
                    {
                        kind: "conditionExpired",
                        squaddieName: "Lini",
                        conditionType: SquaddieConditionType.ARMOR,
                    },
                ])
            ).toBe("Lini's Armor expired")
        })

        it("reports an unrecognized movie command with the offending input", () => {
            expect(
                render([{ kind: "invalidMovieInput", input: "0, 0", reason: "command" }])
            ).toContain(`"0, 0" is not a valid command while a movie is playing.`)
        })

        it("reports an invalid decision choice with the offending input", () => {
            expect(
                render([{ kind: "invalidMovieInput", input: "99", reason: "choice" }])
            ).toContain(`"99" is not a valid choice.`)
        })

        it("summarizes a completed mission with the turn count and survivors", () => {
            const text = render([
                {
                    kind: "missionSummary",
                    isFailure: false,
                    turnNumber: 4,
                    survivorNames: ["Lini"],
                },
            ])
            expect(text).toContain("Mission Complete!")
            expect(text).toContain("Completed on turn 4.")
            expect(text).toContain("Survivors: Lini")
        })

        it("marks a failed mission", () => {
            expect(
                render([
                    { kind: "missionSummary", isFailure: true, turnNumber: 2, survivorNames: [] },
                ])
            ).toContain("Mission Failed!")
        })

        it("joins the events with newlines and drops the ones that render empty", () => {
            const text = render([
                { kind: "message", text: "Lini moves to (0, 1)." },
                {
                    kind: "phaseAnnouncement",
                    phase: MissionAffiliationTurn.PLAYER_TURN,
                    turnNumber: 1,
                },
                { kind: "message", text: "" },
                {
                    kind: "phaseAnnouncement",
                    phase: MissionAffiliationTurn.ENEMY_TURN_START,
                    turnNumber: 1,
                },
            ])
            expect(text).toBe("Lini moves to (0, 1).\nEnemy Turn")
        })
    })
})

function welcomeText({ phaseEvents = [] }: { phaseEvents?: RunnerEvent[] } = {}): string {
    return new CliPresenter(new MissionEngineTestHarness()).welcomeText(phaseEvents, undefined)
}

function mapText(overlayMap?: string): string {
    return new CliPresenter(new MissionEngineTestHarness()).mapText(overlayMap)
}

function render(events: RunnerEvent[]): string {
    return new CliPresenter(new MissionEngineTestHarness()).render(events)
}
