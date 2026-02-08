export type CommandAction = "quit" | "echo"

export interface CommandResult {
    action: CommandAction
    message: string
}

export const processCommand = (rawInput: string): CommandResult => {
    const normalizedInput = rawInput.trim().toUpperCase()

    if (normalizedInput === "Q") {
        return { action: "quit", message: "Goodbye!" }
    }

    return { action: "echo", message: `You entered: ${rawInput}` }
}
