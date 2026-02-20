import { describe, it, expect } from "vitest"
import { buildMovementOverlay, buildRouteOverlay } from "./movementInspector.js"
import { CoordinateMovePathService, CoordinateMovePathMoveType } from "../logic/src/coordinateMap/path/path.js"

describe("movementInspector", () => {
    describe("buildMovementOverlay", () => {
        it("returns a Map keyed by row,col with AP cost as string value", () => {
            const options = [
                { destination: { row: 0, col: 2 }, actionPointCost: 1 },
            ]
            const overlay = buildMovementOverlay(options)
            expect(overlay.get("0,2")).toBe("1")
        })

        it("returns entries for multiple destinations", () => {
            const options = [
                { destination: { row: 0, col: 1 }, actionPointCost: 1 },
                { destination: { row: 0, col: 2 }, actionPointCost: 2 },
            ]
            const overlay = buildMovementOverlay(options)
            expect(overlay.get("0,1")).toBe("1")
            expect(overlay.get("0,2")).toBe("2")
        })

        it("returns empty Map for empty options array", () => {
            const overlay = buildMovementOverlay([])
            expect(overlay.size).toBe(0)
        })
    })

    describe("buildRouteOverlay", () => {
        it("marks a non-final step with **", () => {
            // The first step in a two-step path is not the destination
            const path = CoordinateMovePathService.new({
                steps: [
                    { row: 0, col: 0, moveType: CoordinateMovePathMoveType.START, moveCost: 0 },
                    { row: 0, col: 1, moveType: CoordinateMovePathMoveType.WALK, moveCost: 1 },
                ],
            })
            const overlay = buildRouteOverlay(path)
            expect(overlay.get("0,0")).toBe("**")
        })

        it("marks the last step as the destination with !!", () => {
            const path = CoordinateMovePathService.new({
                steps: [
                    { row: 0, col: 0, moveType: CoordinateMovePathMoveType.START, moveCost: 0 },
                    { row: 0, col: 1, moveType: CoordinateMovePathMoveType.WALK, moveCost: 1 },
                ],
            })
            const overlay = buildRouteOverlay(path)
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
            const overlay = buildRouteOverlay(path)
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
            const overlay = buildRouteOverlay(path)
            expect(overlay.get("1,3")).toBe("!!")
        })
    })
})
