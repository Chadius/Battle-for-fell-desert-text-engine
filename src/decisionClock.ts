// A stopwatch: accumulates elapsed time across start/stop cycles. Time only
// accrues while running; querying while stopped returns the accumulated total.
export class DecisionClock {
    private readonly now: () => number
    private startedAtMs: number | undefined = undefined
    private accumulatedMs = 0

    constructor(now: () => number = Date.now) {
        this.now = now
    }

    start(): void {
        this.startedAtMs ??= this.now()
    }

    stop(): void {
        if (this.startedAtMs == undefined) return
        this.accumulatedMs = this.elapsedMs()
        this.startedAtMs = undefined
    }

    elapsedMs(): number {
        if (this.startedAtMs == undefined) return this.accumulatedMs
        return this.accumulatedMs + (this.now() - this.startedAtMs)
    }
}
