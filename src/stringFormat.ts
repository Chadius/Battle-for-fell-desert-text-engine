// Converts an ALL_CAPS_ENUM name (e.g. "TRAINING_WHEELS") into a human-readable
// title-case string (e.g. "Training Wheels").
export const humanizeEnumName = (name: string): string => {
    return name
        .split("_")
        .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
        .join(" ")
}
