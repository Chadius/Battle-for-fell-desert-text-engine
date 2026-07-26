import { describe, it, expect } from "vitest"
import {
    initialDeploymentContext,
    processDeploymentCommand,
    type DeploymentContext,
} from "./deploymentCommandProcessor.js"
import {
    buildEngineWithTwoOpenCoordinates,
    buildTargetPracticeEngine,
    TargetPracticeCampaignSquaddieIds,
    TargetPracticeDeploymentCoordinateIds,
    TwoOpenCoordinatesIds,
} from "./testUtils/deploymentFixture.js"

const contextSelectingCoordinate = (coordinateId: string): DeploymentContext => ({
    selectedCoordinateId: coordinateId,
    selectedCampaignSquaddieId: undefined,
})

describe("processDeploymentCommand", () => {
    it("quits on Q", () => {
        const engine = buildTargetPracticeEngine()

        const result = processDeploymentCommand("Q", engine, initialDeploymentContext())

        expect(result.action).toBe("quit")
    })

    it("shows the deployment map on M", () => {
        const engine = buildTargetPracticeEngine()

        const result = processDeploymentCommand("M", engine, initialDeploymentContext())

        expect(result.action).toBe("showMap")
        expect(result.message).toContain("Target Practice")
    })

    it("shows help text on ?", () => {
        const engine = buildTargetPracticeEngine()

        const result = processDeploymentCommand("?", engine, initialDeploymentContext())

        expect(result.action).toBe("showCommands")
        expect(result.message).toContain("Finalize deployment")
    })

    it("shows deployment status on W", () => {
        const engine = buildTargetPracticeEngine()

        const result = processDeploymentCommand("W", engine, initialDeploymentContext())

        expect(result.action).toBe("showStatus")
        expect(result.message).toContain("Gloria")
    })

    describe("selecting a coordinate", () => {
        it("lists unplaced squaddies when selecting the open coordinate", () => {
            const engine = buildTargetPracticeEngine()

            const result = processDeploymentCommand("3,0", engine, initialDeploymentContext())

            expect(result.action).toBe("selectCoordinate")
            expect(result.message).toContain("Gloria")
        })

        it("reports the occupying squaddie when selecting an already-assigned coordinate", () => {
            const engine = buildTargetPracticeEngine()

            const result = processDeploymentCommand("1,1", engine, initialDeploymentContext())

            expect(result.action).toBe("selectCoordinate")
            expect(result.message).toContain("Teros")
        })

        it("reports an error for a coordinate that isn't a deployment slot", () => {
            const engine = buildTargetPracticeEngine()

            const result = processDeploymentCommand("4,4", engine, initialDeploymentContext())

            expect(result.action).toBe("echo")
            expect(result.message).toContain("not a deployment coordinate")
        })
    })

    describe("selecting an unplaced squaddie by number", () => {
        it("selects the squaddie directly when nothing is selected yet", () => {
            const engine = buildTargetPracticeEngine()

            const result = processDeploymentCommand("1", engine, initialDeploymentContext())

            expect(result.action).toBe("selectSquaddie")
            expect(result.message).toContain("Gloria selected")
        })

        it("deploys the selected squaddie once a coordinate is entered", () => {
            const engine = buildTargetPracticeEngine()
            const afterSelect = processDeploymentCommand("1", engine, initialDeploymentContext())

            const result = processDeploymentCommand("3,0", engine, afterSelect.updatedContext!)

            expect(result.action).toBe("deploySquaddie")
            expect(result.message).toContain("Gloria")
            expect(
                engine.getCampaignDeploymentStatus().assignments[
                    TargetPracticeDeploymentCoordinateIds.openSlot
                ]?.id
            ).toBe(TargetPracticeCampaignSquaddieIds.gloria)
        })

        it("also deploys when the coordinate is selected before the squaddie number", () => {
            const engine = buildTargetPracticeEngine()
            const afterSelect = processDeploymentCommand("3,0", engine, initialDeploymentContext())

            const result = processDeploymentCommand("1", engine, afterSelect.updatedContext!)

            expect(result.action).toBe("deploySquaddie")
            expect(
                engine.getCampaignDeploymentStatus().assignments[
                    TargetPracticeDeploymentCoordinateIds.openSlot
                ]?.id
            ).toBe(TargetPracticeCampaignSquaddieIds.gloria)
        })

        it("reports an error instead of deploying onto an already-occupied coordinate", () => {
            const engine = buildTargetPracticeEngine()
            const afterSelect = processDeploymentCommand("1", engine, initialDeploymentContext())

            const result = processDeploymentCommand("1,1", engine, afterSelect.updatedContext!)

            expect(result.action).toBe("echo")
            expect(result.message).toContain("already has Teros")
        })

        it("reports an error for an unknown squaddie number", () => {
            const engine = buildTargetPracticeEngine()

            const result = processDeploymentCommand("99", engine, initialDeploymentContext())

            expect(result.action).toBe("echo")
            expect(result.message).toContain("No unplaced squaddie numbered 99")
        })
    })

    describe("unassigning with X", () => {
        it("clears the assignment at an unlocked coordinate", () => {
            const engine = buildEngineWithTwoOpenCoordinates()
            const context = contextSelectingCoordinate(TwoOpenCoordinatesIds.slotA)

            const result = processDeploymentCommand("X", engine, context)

            expect(result.action).toBe("undeploySquaddie")
            expect(
                engine.getCampaignDeploymentStatus().assignments[TwoOpenCoordinatesIds.slotA]
            ).toBeUndefined()
        })

        it("requires a coordinate to be selected first", () => {
            const engine = buildTargetPracticeEngine()

            const result = processDeploymentCommand("X", engine, initialDeploymentContext())

            expect(result.action).toBe("echo")
            expect(result.message).toContain("Select a coordinate first")
        })

        it("reports an error instead of unassigning a locked, satisfied coordinate", () => {
            const engine = buildTargetPracticeEngine()
            const context = contextSelectingCoordinate(
                TargetPracticeDeploymentCoordinateIds.valeSpecificSlot
            )

            const result = processDeploymentCommand("X", engine, context)

            expect(result.action).toBe("echo")
            expect(result.message).toContain("locked")
            expect(
                engine.getCampaignDeploymentStatus().assignments[
                    TargetPracticeDeploymentCoordinateIds.valeSpecificSlot
                ]?.id
            ).toBe(TargetPracticeCampaignSquaddieIds.vale)
        })
    })

    describe("moving and swapping", () => {
        it("swaps two occupied, unlocked coordinates", () => {
            const engine = buildEngineWithTwoOpenCoordinates()
            const context = contextSelectingCoordinate(TwoOpenCoordinatesIds.slotA)

            const result = processDeploymentCommand("0,1", engine, context)

            expect(result.action).toBe("moveOrSwap")
            const status = engine.getCampaignDeploymentStatus()
            expect(status.assignments[TwoOpenCoordinatesIds.slotA]?.id).toBe(
                TwoOpenCoordinatesIds.bob
            )
            expect(status.assignments[TwoOpenCoordinatesIds.slotB]?.id).toBe(
                TwoOpenCoordinatesIds.alice
            )
        })

        it("moves a squaddie to an open coordinate, vacating its old one", () => {
            const engine = buildEngineWithTwoOpenCoordinates()
            const context = contextSelectingCoordinate(TwoOpenCoordinatesIds.slotA)

            const result = processDeploymentCommand("0,2", engine, context)

            expect(result.action).toBe("moveOrSwap")
            const status = engine.getCampaignDeploymentStatus()
            expect(status.assignments[TwoOpenCoordinatesIds.slotC]?.id).toBe(
                TwoOpenCoordinatesIds.alice
            )
            expect(status.assignments[TwoOpenCoordinatesIds.slotA]).toBeUndefined()
        })

        it("reports an error instead of moving a locked, satisfied coordinate away", () => {
            const engine = buildTargetPracticeEngine()
            const context = contextSelectingCoordinate(
                TargetPracticeDeploymentCoordinateIds.terosLeaderSlot
            )

            const result = processDeploymentCommand("2,3", engine, context)

            expect(result.action).toBe("echo")
            expect(result.message).toContain("locked")
        })
    })

    describe("looking at a squaddie with L", () => {
        it("shows the selected unplaced squaddie's stats and actions", () => {
            const engine = buildTargetPracticeEngine()
            const afterSelect = processDeploymentCommand("1", engine, initialDeploymentContext())

            const result = processDeploymentCommand("L", engine, afterSelect.updatedContext!)

            expect(result.action).toBe("lookAtSquaddie")
            expect(result.message).toContain("Gloria")
            expect(result.message).toContain("Longsword")
        })

        it("shows the deployed squaddie's stats when its coordinate is selected", () => {
            const engine = buildTargetPracticeEngine()
            const afterSelect = processDeploymentCommand("1,1", engine, initialDeploymentContext())

            const result = processDeploymentCommand("L", engine, afterSelect.updatedContext!)

            expect(result.action).toBe("lookAtSquaddie")
            expect(result.message).toContain("Teros")
        })

        it("requires a squaddie or coordinate to be selected first", () => {
            const engine = buildTargetPracticeEngine()

            const result = processDeploymentCommand("L", engine, initialDeploymentContext())

            expect(result.action).toBe("echo")
        })

        it("reports that an open coordinate has nobody to inspect", () => {
            const engine = buildTargetPracticeEngine()
            const afterSelect = processDeploymentCommand("3,0", engine, initialDeploymentContext())

            const result = processDeploymentCommand("L", engine, afterSelect.updatedContext!)

            expect(result.action).toBe("echo")
            expect(result.message).toContain("open")
        })
    })

    describe("finalizing deployment", () => {
        it("finalizes deployment and places campaign squaddies on the map", () => {
            const engine = buildTargetPracticeEngine()

            const result = processDeploymentCommand("F", engine, initialDeploymentContext())

            expect(result.action).toBe("finalize")
            expect(engine.isCampaignSquaddieDeploymentInProgress()).toBe(false)
        })
    })
})
