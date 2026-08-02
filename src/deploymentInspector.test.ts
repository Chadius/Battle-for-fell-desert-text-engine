import { describe, it, expect } from "vitest"
import { DeploymentInspector } from "./deploymentInspector.js"
import { buildLockedDeploymentEngine, LockedDeploymentIds } from "./testUtils/deploymentFixture.js"

describe("DeploymentInspector", () => {
    describe("formatStatus", () => {
        it("lists every deployment coordinate along with its default assignment", () => {
            const engine = buildLockedDeploymentEngine()

            const status = DeploymentInspector.formatStatus(engine)

            expect(status).toContain(LockedDeploymentIds.lini.leaderCoordinateId)
            expect(status).toContain("Lini")
            expect(status).toContain(LockedDeploymentIds.vale.coordinateId)
            expect(status).toContain("Vale")
            expect(status).toContain(LockedDeploymentIds.openCoordinateId)
            expect(status).toContain("(open)")
        })

        it("lists Otto as unplaced since his coordinate has no request", () => {
            const engine = buildLockedDeploymentEngine()

            const status = DeploymentInspector.formatStatus(engine)

            expect(status).toContain("Unplaced squaddies:")
            expect(status).toContain("Otto")
        })

        it("marks locked coordinates", () => {
            const engine = buildLockedDeploymentEngine()

            const status = DeploymentInspector.formatStatus(engine)
            const leaderLine = status
                .split("\n")
                .find((line) => line.includes(LockedDeploymentIds.lini.leaderCoordinateId))

            expect(leaderLine).toContain("[locked]")
        })
    })

    describe("renderDeploymentMap", () => {
        it("includes the map name and a marker for each assigned coordinate", () => {
            const engine = buildLockedDeploymentEngine()

            const mapText = DeploymentInspector.renderDeploymentMap(engine)

            expect(mapText).toContain(LockedDeploymentIds.mapName)
            expect(mapText).toContain("LI") // Lini
            expect(mapText).toContain("VA") // Vale
            expect(mapText).toContain("??") // open coordinate
        })
    })

    describe("formatCampaignSquaddieDetails", () => {
        it("shows the squaddie's max hit points and action list", () => {
            const engine = buildLockedDeploymentEngine()
            const lini = engine.getCampaignDeploymentStatus().assignments[
                LockedDeploymentIds.lini.leaderCoordinateId
            ]

            const details = DeploymentInspector.formatCampaignSquaddieDetails(engine, lini)

            expect(details).toContain("Lini")
            expect(details).toContain("Max Hit Points:")
            expect(details).toContain("Scimitar")
        })

        it("marks the squaddie as Leader when applicable", () => {
            const engine = buildLockedDeploymentEngine()
            const lini = engine.getCampaignDeploymentStatus().assignments[
                LockedDeploymentIds.lini.leaderCoordinateId
            ]

            const details = DeploymentInspector.formatCampaignSquaddieDetails(engine, lini)

            expect(details).toContain("(Leader)")
        })
    })
})
