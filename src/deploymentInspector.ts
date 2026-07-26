import type { MissionEngine } from "../logic/src/mission/missionEngine/missionEngine.js"
import type { CampaignSquaddie } from "../logic/src/campaign/army/campaignSquaddie.js"
import type {
    CampaignSquaddieDeploymentCoordinate,
    CampaignSquaddieDeploymentCoordinateRequest,
} from "../logic/src/mission/campaignSquaddieDeploymentCoordinate.js"
import { renderGridLines, renderLegend } from "./mapRenderer.js"

export type DeploymentStatus = ReturnType<
    MissionEngine["getCampaignDeploymentStatus"]
>

export const allCoordinatesOf = (
    status: DeploymentStatus
): CampaignSquaddieDeploymentCoordinate[] => [
    ...status.openCoordinates,
    ...status.deployedCoordinates,
]

// Falls back to the raw id for a SPECIFIC_SQUADDIE request whose target isn't currently
// deployed or unplaced-and-eligible (e.g. injured) -- there's no general roster lookup.
const nameForCampaignSquaddieId = (
    status: DeploymentStatus,
    campaignSquaddieId: string
): string =>
    status.unplacedEligibleCampaignSquaddies.find(
        (squaddie) => squaddie.id === campaignSquaddieId
    )?.name ??
    Object.values(status.assignments).find(
        (squaddie) => squaddie.id === campaignSquaddieId
    )?.name ??
    campaignSquaddieId

const formatRequestLabel = (
    status: DeploymentStatus,
    request: CampaignSquaddieDeploymentCoordinateRequest
): string => {
    if (request.type === "LEADER") return "requests: Leader"
    if (request.type === "SPECIFIC_SQUADDIE") {
        return `requests: ${nameForCampaignSquaddieId(status, request.campaignSquaddieId)}`
    }
    return ""
}

const formatCoordinateLine = (
    coordinate: CampaignSquaddieDeploymentCoordinate,
    status: DeploymentStatus
): string => {
    const assigned = status.assignments[coordinate.id]
    const assignment = assigned != undefined ? assigned.name : "(open)"
    const lockLabel = coordinate.locked ? " [locked]" : ""
    const requestLabel = formatRequestLabel(status, coordinate.request)
    const suffix = requestLabel.length > 0 ? ` ${requestLabel}` : ""

    return `  ${coordinate.id} (${coordinate.coordinate.row},${coordinate.coordinate.col})${lockLabel}: ${assignment}${suffix}`
}

const formatStatus = (engine: MissionEngine): string => {
    const status = engine.getCampaignDeploymentStatus()

    const lines: string[] = ["Deployment coordinates:"]
    for (const coordinate of allCoordinatesOf(status)) {
        lines.push(formatCoordinateLine(coordinate, status))
    }

    if (status.unplacedEligibleCampaignSquaddies.length > 0) {
        lines.push("", "Unplaced squaddies:")
        status.unplacedEligibleCampaignSquaddies.forEach((squaddie, index) => {
            const leaderLabel = squaddie.isLeader ? " (Leader)" : ""
            lines.push(`  ${index + 1}. ${squaddie.name}${leaderLabel}`)
        })
    }

    return lines.join("\n")
}

// Two-letter marker for a placed squaddie ("??" for a still-open coordinate).
const overlayMarkerForCoordinate = (
    coordinate: CampaignSquaddieDeploymentCoordinate,
    status: DeploymentStatus
): string => {
    const assigned = status.assignments[coordinate.id]
    if (assigned == undefined) return "??"
    return assigned.name.slice(0, 2).toUpperCase()
}

const buildMapOverlay = (engine: MissionEngine): Map<string, string> => {
    const status = engine.getCampaignDeploymentStatus()

    const overlay = new Map<string, string>()
    for (const coordinate of allCoordinatesOf(status)) {
        const key = `${coordinate.coordinate.row},${coordinate.coordinate.col}`
        overlay.set(key, overlayMarkerForCoordinate(coordinate, status))
    }
    return overlay
}

// Renders the map during pre-mission deployment. No squaddies are on the map yet (campaign
// squaddies aren't placed as InBattleSquaddie until deployment is finalized), so this builds
// its own overlay-only grid instead of reusing renderMap()'s turn/affiliation header.
const renderDeploymentMap = (engine: MissionEngine): string => {
    const overview = engine.getMapOverview()
    const summary = engine.getSerializedInMissionSummary()
    const overlay = buildMapOverlay(engine)

    const header =
        summary.mapName != undefined
            ? `${summary.mapName} (${overview.width} columns x ${overview.height} rows) — Deployment`
            : `Deployment (${overview.width} columns x ${overview.height} rows)`

    const gridLines = renderGridLines(overview, new Map(), {
        turnNumber: 0,
        currentAffiliation: undefined,
        squaddieAffiliations: new Map(),
        tileOverlays: overlay,
    })

    return [header, ...gridLines, ...renderLegend()].join("\n")
}

const formatAttributeScores = (attributeScores: Record<string, number>): string =>
    Object.entries(attributeScores)
        .map(([key, value]) => `${key} ${value >= 0 ? "+" : ""}${value}`)
        .join(", ")

// "2 AP" / "all AP" — ActionPointCost is either a fixed number or the literal "all".
const formatActionPointCost = (spent: number | "all" | undefined): string | undefined => {
    if (spent == undefined) return undefined
    return spent === "all" ? "all AP" : `${spent} AP`
}

const formatActionEffectSummary = (
    effect: ReturnType<MissionEngine["getActionById"]>["effectOnTarget"]
): string | undefined => {
    const success = effect?.SUCCESS
    if (success?.damage != undefined) return `${success.damage.raw} damage`
    if (success?.healing != undefined) return `${success.healing.raw} healing`
    return undefined
}

const formatActionSummary = (engine: MissionEngine, actionId: string): string => {
    const action = engine.getActionById(actionId)
    const costLabel = formatActionPointCost(action.effectOnActor.SUCCESS.actionPoints?.spent)
    const effectLabel = formatActionEffectSummary(action.effectOnTarget)

    const details = [action.targeting.range, costLabel, effectLabel].filter(
        (part): part is string => part != undefined
    )
    const detailsSuffix = details.length > 0 ? ` (${details.join(", ")})` : ""

    return `  - ${action.name}${detailsSuffix}`
}

// Shows a campaign squaddie's static out-of-battle definition (max HP, attributes, actions) --
// used to inspect a squaddie during deployment, before they exist as an InBattleSquaddie.
const formatCampaignSquaddieDetails = (
    engine: MissionEngine,
    campaignSquaddie: CampaignSquaddie
): string => {
    const details = engine.getOutOfBattleSquaddieDetails(campaignSquaddie.outOfBattleSquaddieId)
    if (details == undefined) {
        return `${campaignSquaddie.name}: no details available.`
    }

    const { squaddie, attributeSheet } = details
    const leaderLabel = campaignSquaddie.isLeader ? " (Leader)" : ""
    const lines: string[] = [
        `${squaddie.name}${leaderLabel}`,
        `  Max Hit Points: ${attributeSheet.maxHitPoints}`,
        `  Attributes: ${formatAttributeScores(attributeSheet.attributeScores)}`,
        `  Movement: ${attributeSheet.movement.movementPointsPerAction} per action`,
    ]

    if (squaddie.actionIds.length > 0) {
        lines.push("Actions:")
        squaddie.actionIds.forEach((actionId) =>
            lines.push(formatActionSummary(engine, actionId))
        )
    }

    return lines.join("\n")
}

export const DeploymentInspector = {
    formatStatus: (engine: MissionEngine) => formatStatus(engine),
    renderDeploymentMap: (engine: MissionEngine) => renderDeploymentMap(engine),
    formatCampaignSquaddieDetails: (engine: MissionEngine, campaignSquaddie: CampaignSquaddie) =>
        formatCampaignSquaddieDetails(engine, campaignSquaddie),
}
