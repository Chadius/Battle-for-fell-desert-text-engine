import { describe, it, expect } from "vitest"
import { MovementInspector } from "./movementInspector.js"
import { CoordinateMovePathService, CoordinateMovePathMoveType } from "../logic/src/coordinateMap/path/path.js"

describe("movementInspector", () => {
    describe("buildMovementOverlay", () => {
        it("returns a Map keyed by row,col with AP cost as string value", () => {
            const options = [
                { destination: { row: 0, col: 2 }, actionPointCost: 1 },
            ]
            const overlay = MovementInspector.buildMovementOverlay(options)
            expect(overlay.get("0,2")).toBe("1")
        })

        it("returns entries for multiple destinations", () => {
            const options = [
                { destination: { row: 0, col: 1 }, actionPointCost: 1 },
                { destination: { row: 0, col: 2 }, actionPointCost: 2 },
            ]
            const overlay = MovementInspector.buildMovementOverlay(options)
            expect(overlay.get("0,1")).toBe("1")
            expect(overlay.get("0,2")).toBe("2")
        })

        it("returns empty Map for empty options array", () => {
            const overlay = MovementInspector.buildMovementOverlay([])
            expect(overlay.size).toBe(0)
        })
    })

    describe("buildActionEffectOverlay", () => {
        it("places HT at each target position", () => {
            const overlay = MovementInspector.buildActionEffectOverlay(
                { row: 0, col: 0 },
                [{ row: 1, col: 2 }, { row: 3, col: 4 }]
            )
            expect(overlay.get("1,2")).toBe("HT")
            expect(overlay.get("3,4")).toBe("HT")
        })

        it("places <> at aim coordinate when no target is there", () => {
            const overlay = MovementInspector.buildActionEffectOverlay(
                { row: 0, col: 0 },
                [{ row: 1, col: 2 }]
            )
            expect(overlay.get("0,0")).toBe("<>")
        })

        it("leaves aim coordinate as HT when a target occupies the aim coordinate", () => {
            const overlay = MovementInspector.buildActionEffectOverlay(
                { row: 1, col: 2 },
                [{ row: 1, col: 2 }]
            )
            expect(overlay.get("1,2")).toBe("HT")
        })

        it("skips target positions with undefined row or col", () => {
            const overlay = MovementInspector.buildActionEffectOverlay(
                { row: 0, col: 0 },
                [
                    { row: undefined, col: 1 },
                    { row: 2, col: undefined },
                    { row: 3, col: 4 },
                ]
            )
            expect(overlay.get("3,4")).toBe("HT")
            expect(overlay.size).toBe(2) // aim + one valid target
        })

        it("marks intermediate line cells with // when lineCoordinates provided", () => {
            const overlay = MovementInspector.buildActionEffectOverlay(
                { row: 0, col: 4 },
                [],
                [{ row: 0, col: 1 }, { row: 0, col: 2 }, { row: 0, col: 3 }, { row: 0, col: 4 }]
            )
            expect(overlay.get("0,1")).toBe("//")
            expect(overlay.get("0,2")).toBe("//")
            expect(overlay.get("0,3")).toBe("//")
        })

        it("aim coordinate overrides // on a line cell", () => {
            const overlay = MovementInspector.buildActionEffectOverlay(
                { row: 0, col: 3 },
                [],
                [{ row: 0, col: 1 }, { row: 0, col: 2 }, { row: 0, col: 3 }]
            )
            expect(overlay.get("0,3")).toBe("<>")
        })

        it("HT overrides // when a target is on the line", () => {
            const overlay = MovementInspector.buildActionEffectOverlay(
                { row: 0, col: 4 },
                [{ row: 0, col: 2 }],
                [{ row: 0, col: 1 }, { row: 0, col: 2 }, { row: 0, col: 3 }, { row: 0, col: 4 }]
            )
            expect(overlay.get("0,2")).toBe("HT")
        })
    })

    describe("buildRouteOverlay", () => {
        it("marks a non-final step with **", () => {
            const path = CoordinateMovePathService.new({
                steps: [
                    { row: 0, col: 0, moveType: CoordinateMovePathMoveType.START, moveCost: 0 },
                    { row: 0, col: 1, moveType: CoordinateMovePathMoveType.WALK, moveCost: 1 },
                ],
            })
            const overlay = MovementInspector.buildRouteOverlay(path)
            expect(overlay.get("0,0")).toBe("**")
        })

        it("marks the last step as the destination with !!", () => {
            const path = CoordinateMovePathService.new({
                steps: [
                    { row: 0, col: 0, moveType: CoordinateMovePathMoveType.START, moveCost: 0 },
                    { row: 0, col: 1, moveType: CoordinateMovePathMoveType.WALK, moveCost: 1 },
                ],
            })
            const overlay = MovementInspector.buildRouteOverlay(path)
            expect(overlay.get("0,1")).toBe("!!")
        })

        it("maps intermediate WALK steps to ** and the final step to !!", () => {
            const path = CoordinateMovePathService.new({
                steps: [
                    { row: 0, col: 0, moveType: CoordinateMovePathMoveType.START, moveCost: 0 },
                    { row: 0, col: 1, moveType: CoordinateMovePathMoveType.WALK, moveCost: 1 },
                    { row: 0, col: 2, moveType: CoordinateMovePathMoveType.WALK, moveCost: 1 },
                ],
            })
            const overlay = MovementInspector.buildRouteOverlay(path)
            expect(overlay.get("0,0")).toBe("**")
            expect(overlay.get("0,1")).toBe("**")
            expect(overlay.get("0,2")).toBe("!!")
        })

        it("marks the only step as the destination when path has one step", () => {
            const path = CoordinateMovePathService.new({
                steps: [
                    { row: 1, col: 3, moveType: CoordinateMovePathMoveType.START, moveCost: 0 },
                ],
            })
            const overlay = MovementInspector.buildRouteOverlay(path)
            expect(overlay.get("1,3")).toBe("!!")
        })
    })
})
