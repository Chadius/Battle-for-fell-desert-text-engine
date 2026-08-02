import {
    MissionAffiliationTurn,
    type TMissionAffiliationTurn,
} from "../logic/src/mission/missionTurn.js"

export const missionAffiliationTurnDisplayNames: Record<
    TMissionAffiliationTurn,
    string
> = {
    [MissionAffiliationTurn.TURN_START]: "Start of Turn",
    [MissionAffiliationTurn.PLAYER_TURN_START]: "Player Turn Start",
    [MissionAffiliationTurn.PLAYER_TURN]: "Player Turn",
    [MissionAffiliationTurn.PLAYER_TURN_END]: "Player Turn End",
    [MissionAffiliationTurn.ALLY_TURN_START]: "Ally Turn Start",
    [MissionAffiliationTurn.ALLY_TURN]: "Ally Turn",
    [MissionAffiliationTurn.ALLY_TURN_END]: "Ally Turn End",
    [MissionAffiliationTurn.ENEMY_TURN_START]: "Enemy Turn Start",
    [MissionAffiliationTurn.ENEMY_TURN]: "Enemy Turn",
    [MissionAffiliationTurn.ENEMY_TURN_END]: "Enemy Turn End",
    [MissionAffiliationTurn.NONE_AFFILIATION_TURN_START]: "Neutral Turn Start",
    [MissionAffiliationTurn.NONE_AFFILIATION_TURN]: "Neutral Turn",
    [MissionAffiliationTurn.NONE_AFFILIATION_TURN_END]: "Neutral Turn End",
    [MissionAffiliationTurn.TURN_END]: "End of Turn",
}
