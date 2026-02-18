import * as readline from "node:readline"
import { MissionEngineTestHarness } from "../logic/src/testUtils/mission/missionEngineTestHarness.js"
import { TextMissionRunner } from "./textMissionRunner.js"

const engine = new MissionEngineTestHarness()
const runner = new TextMissionRunner(engine)

console.log(runner.getWelcomeText())

const prompt = (rl: readline.Interface): void => {
    rl.question("> ", (answer) => {
        const result = runner.processInput(answer)
        console.log(result.text)

        if (result.shouldQuit) {
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
