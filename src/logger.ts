import { appendFileSync } from "node:fs"

let logFilePath: string | undefined

export const initLogger = (filePath: string): void => {
    logFilePath = filePath
    const ts = new Date().toISOString()
    appendFileSync(filePath, `\n[${ts}] Session started\n`)
}

export const appendLog = (message: string): void => {
    if (logFilePath == undefined) return
    const ts = new Date().toISOString()
    appendFileSync(logFilePath, `[${ts}] ${message}\n`)
}
