import { describe, it, expect } from "vitest"
import { DecisionClock } from "./decisionClock.js"

// A controllable stand-in for Date.now(): advance() simulates wall-clock time passing
// without needing real sleeps in the test.
const makeClock = () => {
    let currentMs = 0
    return {
        now: () => currentMs,
        advance: (ms: number) => {
            currentMs += ms
        },
    }
}

describe("DecisionClock", () => {
    it("reports zero elapsed time before start() is called", () => {
        const clock = makeClock()
        const decisionClock = new DecisionClock(clock.now)

        expect(decisionClock.elapsedMs()).toBe(0)
    })

    it("accumulates time while running", () => {
        const clock = makeClock()
        const decisionClock = new DecisionClock(clock.now)

        decisionClock.start()
        clock.advance(5000)

        expect(decisionClock.elapsedMs()).toBe(5000)
    })

    it("stops accumulating once stopped", () => {
        const clock = makeClock()
        const decisionClock = new DecisionClock(clock.now)

        decisionClock.start()
        clock.advance(5000)
        decisionClock.stop()
        clock.advance(10000)

        expect(decisionClock.elapsedMs()).toBe(5000)
    })

    it("resumes accumulating from where it left off after restarting", () => {
        const clock = makeClock()
        const decisionClock = new DecisionClock(clock.now)

        decisionClock.start()
        clock.advance(2000)
        decisionClock.stop()
        clock.advance(1000)
        decisionClock.start()
        clock.advance(3000)

        expect(decisionClock.elapsedMs()).toBe(5000)
    })

    it("ignores a redundant start() call while already running", () => {
        const clock = makeClock()
        const decisionClock = new DecisionClock(clock.now)

        decisionClock.start()
        clock.advance(1000)
        decisionClock.start()
        clock.advance(1000)

        expect(decisionClock.elapsedMs()).toBe(2000)
    })

    it("ignores a redundant stop() call while already stopped", () => {
        const clock = makeClock()
        const decisionClock = new DecisionClock(clock.now)

        decisionClock.start()
        clock.advance(1000)
        decisionClock.stop()
        decisionClock.stop()

        expect(decisionClock.elapsedMs()).toBe(1000)
    })
})
