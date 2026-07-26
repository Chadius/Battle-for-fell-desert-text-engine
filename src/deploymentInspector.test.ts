import { describe, it, expect } from "vitest"
import { DeploymentInspector } from "./deploymentInspector.js"
import {
    buildTargetPracticeEngine,
    TargetPracticeDeploymentCoordinateIds,
} from "./testUtils/deploymentFixture.js"

describe("DeploymentInspector", () => {
    describe("formatStatus", () => {
        it("lists every deployment coordinate along with its default assignment", () => {
            const engine = buildTargetPracticeEngine()

            const status = DeploymentInspector.formatStatus(engine)

            expect(status).toContain(TargetPracticeDeploymentCoordinateIds.terosLeaderSlot)
            expect(status).toContain("Teros")
            expect(status).toContain(TargetPracticeDeploymentCoordinateIds.valeSpecificSlot)
            expect(status).toContain("Vale")
            expect(status).toContain(TargetPracticeDeploymentCoordinateIds.openSlot)
            expect(status).toContain("(open)")
        })

        it("lists Gloria as unplaced since her coordinate has no request", () => {
            const engine = buildTargetPracticeEngine()

            const status = DeploymentInspector.formatStatus(engine)

            expect(status).toContain("Unplaced squaddies:")
            expect(status).toContain("Gloria")
        })

        it("marks locked coordinates", () => {
            const engine = buildTargetPracticeEngine()

            const status = DeploymentInspector.formatStatus(engine)
            const terosLine = status
                .split("\n")
                .find((line) => line.includes(TargetPracticeDeploymentCoordinateIds.terosLeaderSlot))

            expect(terosLine).toContain("[locked]")
        })
    })

    describe("renderDeploymentMap", () => {
        it("includes the map name and a marker for each assigned coordinate", () => {
            const engine = buildTargetPracticeEngine()

            const mapText = DeploymentInspector.renderDeploymentMap(engine)

            expect(mapText).toContain("Target Practice")
            expect(mapText).toContain("TE") // Teros
            expect(mapText).toContain("VA") // Vale
            expect(mapText).toContain("??") // open coordinate
        })
    })

    describe("formatCampaignSquaddieDetails", () => {
        it("shows the squaddie's max hit points and action list", () => {
            const engine = buildTargetPracticeEngine()
            const gloria = engine
                .getCampaignDeploymentStatus()
                .unplacedEligibleCampaignSquaddies.find(
                    (squaddie) => squaddie.name === "Gloria"
                )!

            const details = DeploymentInspector.formatCampaignSquaddieDetails(engine, gloria)

            expect(details).toContain("Gloria")
            expect(details).toContain("Max Hit Points:")
            expect(details).toContain("Longsword")
        })

        it("marks the squaddie as Leader when applicable", () => {
            const engine = buildTargetPracticeEngine()
            const teros = Object.values(engine.getCampaignDeploymentStatus().assignments).find(
                (squaddie) => squaddie.name === "Teros"
            )!

            const details = DeploymentInspector.formatCampaignSquaddieDetails(engine, teros)

            expect(details).toContain("(Leader)")
        })
    })
})
