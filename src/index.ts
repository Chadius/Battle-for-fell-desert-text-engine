import * as readline from "node:readline"
import { MissionEngineTestHarness } from "../logic/src/testUtils/mission/missionEngineTestHarness.js"
import { processCommand, InteractionPhase } from "./commandProcessor.js"
import type { CommandContext } from "./commandProcessor.js"

const engine = new MissionEngineTestHarness()

console.log("Battle of Fell Desert CLI")
console.log("=========================")
console.log("Game engine initialized.")
console.log("Enter 'Q' to quit, '?' for commands.\n")

let currentContext: CommandContext = {
    selectedSquaddieId: undefined,
    interactionPhase: InteractionPhase.BROWSING,
    actingSquaddieId: undefined,
}

const prompt = (rl: readline.Interface): void => {
    rl.question("> ", (answer) => {
        const result = processCommand(answer, engine, currentContext)
        console.log(result.message)

        if (result.updatedContext != undefined) {
            currentContext = result.updatedContext
        }

        if (result.action === "quit") {
            rl.close()
            return
        }

        prompt(rl)
    })
}

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
})

prompt(rl)
