import { join } from "node:path"
import { writeFileSync } from "node:fs"
import { MissionEngineTestHarness } from "../../../logic/src/testUtils/mission/missionEngineTestHarness.js"

// Writes the six JSON files campaignLoader.ts's loadMissionFromFolder reads by name, generated
// from MissionEngineTestHarness (the logic submodule's own stable, versioned test scenario), so
// this fixture can never drift out of sync with the engine's validation schema.
export const writeMissionEngineTestHarnessFolder = (destinationPath: string): void => {
    writeFileSync(
        join(destinationPath, "squaddies.json"),
        JSON.stringify(MissionEngineTestHarness.serializeSquaddies())
    )
    writeFileSync(
        join(destinationPath, "attributeSheets.json"),
        JSON.stringify(MissionEngineTestHarness.serializeAttributeSheets())
    )
    writeFileSync(join(destinationPath, "items.json"), JSON.stringify([]))
    writeFileSync(
        join(destinationPath, "maps.json"),
        JSON.stringify(MissionEngineTestHarness.serializeMaps())
    )
    writeFileSync(
        join(destinationPath, "actions.json"),
        JSON.stringify(MissionEngineTestHarness.serializeActions())
    )
    writeFileSync(
        join(destinationPath, "missionState.json"),
        JSON.stringify(MissionEngineTestHarness.serializeMissionState())
    )
}
