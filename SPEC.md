# Battle for Fell Desert CLI — Technical Specification

## Overview

This project is a text-based CLI frontend that prototypes the player interface for the Battle for
Fell Desert, a turn-based strategy game. It exercises the game logic by calling the `MissionEngine`
(from the `logic` submodule) to issue commands, receive results, and advance the game state.

The test harness mission (via `MissionEngineTestHarness`) is the primary playable scenario: Lini
(player) versus the Slither Demon (enemy) on a 5×4 map. The win condition is defeating all enemies;
the lose condition is having all player squaddies defeated.

---

## Architecture

### Layers

```
index.ts
  └─ TextMissionRunner         (CLI loop, phase advancement)
       └─ CommandProcessor     (input routing, context management)
            └─ Inspectors      (read-only data formatters)
            └─ MissionEngine   (game logic facade — in logic submodule)
                 └─ MissionManager / Managers
```

### Key Types

- `CommandContext` — tracks the UI state: which squaddie is selected, what interaction phase
  the player is in, which action is pending.
- `InteractionPhase` — `BROWSING`, `SELECTING_ACTION`, `SELECTING_TARGET`, `CONFIRMING_ACTION`,
  `VIEWING_RESULTS`.
- `MissionAffiliationTurn` — the phase sequence driven by the logic: `TURN_START`, `PLAYER_TURN`,
  `ENEMY_TURN`, `TURN_END`, etc.

---

## What the MissionEngine Provides

The `MissionEngine` class (logic submodule) exposes these operations used by the runner:

| Method | Purpose |
|---|---|
| `getCurrentAffiliationTurn()` | Which affiliation phase is active |
| `getCurrentTurnNumber()` | The global turn counter |
| `transitionToNextPhase()` | Advance the phase state machine |
| `getSquaddiesWhoCanActThisPhase()` | IDs of squaddies that can still act |
| `getSquaddieInfo(id)` | HP, AP, affiliation, conditions for a squaddie |
| `getSquaddieAtCoordinate(coord)` | BattleSquaddieId at a tile |
| `getAllSquaddiePositions()` | All squaddies and their map positions |
| `getMapOverview()` | Full tile grid with movement costs and occupants |
| `getTerrainAtCoordinate(coord)` | Movement cost and stop rules for a tile |
| `getSquaddieActionValidity(id)` | Valid and invalid actions with reasons |
| `getMovementOptionsWithCosts(id)` | Reachable tiles and their AP costs |
| `getActionById(id)` | Full action definition |
| `readyAction({actor, targets, action})` | Stage an action for execution |
| `cancelReadiedAction()` | Discard the staged action |
| `useActionAndGetResults()` | Execute the staged action; returns results |
| `previewReadiedActionAndForecastResults()` | Probability forecast before committing |
| `undoLastPlayerUndoableAction()` | Reverse the most recent undoable action |
| `getInProgressMissionObjectives()` | Objectives not yet complete |
| `getCompletedAndRewardedMissionObjectives()` | Objectives already finished |
| `isDone()` | Whether the mission has ended |

---

## What the TextMissionRunner Does Today

### Phase management
- On construction and after each command, `advanceToInteractivePhase()` is called.
- It calls `transitionToNextPhase()` repeatedly, collecting announcement strings, until the engine
  lands on an interactive phase (`PLAYER_TURN`, `ALLY_TURN`, `ENEMY_TURN`, `NONE_AFFILIATION_TURN`)
  or the phase stops changing.

### Commands (via `CommandProcessor`)

| Input | Action |
|---|---|
| `Q` | Quit |
| `M` | Render the map with terrain, squaddies, turn info, and objectives |
| `?` | List context-sensitive commands |
| `P` | Show current phase and turn number |
| `O` | Show mission objectives and their status |
| `W` | List squaddies that can act this phase with location |
| `row, col` | Inspect a tile; selects the squaddie there if one is present |
| `L` | Show details for the selected squaddie (HP, AP, conditions, actions) |
| `A` | List available actions for the selected squaddie |
| `AE` | End the selected squaddie's turn |
| `AM` | Show reachable tiles; enter `SELECTING_TARGET` to choose a destination |
| *(coordinate while in SELECTING_TARGET)* | Execute movement to that tile |

### What is not yet implemented

**Missing runner capabilities:**

1. **Combat action execution** — The action list (from `L` or `A`) shows Scimitar, Heal, Claw, etc.,
   but there is no command to execute them. `actionKeyMap` only maps `E` and `M`. Issuing a combat
   action requires: selecting the action by key, entering target selection mode (choosing a
   target by coordinate or squaddie), optionally previewing the forecast, confirming, executing,
   and displaying the results.

2. **Action result display** — `useActionAndGetResults()` returns hit/miss outcomes, degree of
   success, damage dealt, and HP changes. None of this is rendered to the player today (movement
   is a special case that shows the route map but no stat changes).

3. **Mission end detection** — `engine.isDone()` is available but the runner never calls it.
   When all enemies are defeated or all player squaddies fall, the game continues silently rather
   than announcing a win or loss and halting the loop.

4. **Enemy AI** — `ENEMY_TURN` is listed as an interactive phase, so the runner stops and waits
   for user input. But no commands are routed to make enemies act. Enemies sit idle until the
   player manually ends their turns via `W` + select + `AE` — which requires selecting an enemy
   as if you controlled it, and the engine currently allows this.

5. **Ally AI** — Same problem as enemies. Allied squaddies (if any) have no automated behavior.

6. **Undo command** — `undoLastPlayerUndoableAction()` exists in the engine but there is no CLI
   command bound to it.

7. **Action forecast/preview** — `previewReadiedActionAndForecastResults()` is available but
   unused. A player has no way to inspect odds before committing.

8. **`CONFIRMING_ACTION` and `VIEWING_RESULTS` phases** — These interaction states are defined
   in `InteractionPhase` but are never entered. Confirmation before execution and a dedicated
   results view are not wired up.

---

## Gaps in the Game Logic

These items are missing or incomplete in the `logic` submodule and are needed for feature
completeness:

1. **Enemy AI system** — There is no module that decides what an enemy squaddie should do during
   its turn (which action to use, which target to pick, whether to move first). The engine has no
   `getRecommendedEnemyAction()` or similar method. (DONE)

2. **Ally AI system** — Same as enemies. Allied squaddies that are not player-controlled have no
   decision-making path.

3. **Squaddie controller / ownership model** — There is no concept of "who controls this
   squaddie." Affiliation determines which phase a squaddie acts in, but nothing in the engine
   specifies whether a given squaddie during its affiliation turn is controlled by the human
   player, an AI, or something else. The runner currently treats all active-phase squaddies as
   human-controlled by default. (DONE)

4. **Status effect processing** — Conditions appear in `SquaddieInfo.conditions` and are
   displayed, but it is unclear whether timed conditions (e.g., burning, slowed) are decremented
   or resolved at phase boundaries during `transitionToNextPhase()`.

---

## Implementation Plan

The goal: a human can sit down at the terminal and play the test harness mission to completion —
moving, attacking, seeing results, watching enemies act, and receiving a win or loss message.

### Phase 1 — Mission Completion Detection (DONE)

**Goal:** The game ends when objectives are met, instead of running forever.

- After every `useActionAndGetResults()` call and after every `transitionToNextPhase()` call,
  check `engine.isDone()`.
- If `isDone()` returns true, display a mission summary (objectives completed, turn count, which
  squaddies survived) and set `shouldQuit = true` in `ProcessInputResult`.
- Add a test: verify the runner returns `shouldQuit = true` after the last enemy is defeated.

### Phase 2 — Combat Action Execution (DONE)

**Goal:** The player can select and execute combat actions against valid targets.

- Extend `actionKeyMap` to include named keys for non-default actions available on the test
  harness squaddies (e.g., `AS` for Scimitar, `AH` for Heal).
- When an action with targets is selected, call `getSquaddieActionValidity()` to retrieve
  `targetCoordinates` for that action, then enter `SELECTING_TARGET` mode.
- Show the map with target tiles highlighted (similar to movement overlay).
- On coordinate entry, resolve the `BattleSquaddieId` at that tile, call `readyAction()`, then
  `useActionAndGetResults()`.
- Display the result: who was targeted, degree of success, damage or healing applied, and
  updated HP.

### Phase 3 — Action Forecast and Confirmation (DONE)

**Goal:** The player can preview hit probability before committing.

- After selecting a target, call `previewReadiedActionAndForecastResults()` and display the
  probability breakdown (chance of success, critical, failure).
- Enter `CONFIRMING_ACTION` phase. Accept `Y` to confirm or `N` / `C` to cancel back to
  `BROWSING`.
- Add `VIEWING_RESULTS` phase after execution completes so the player can review the outcome
  before the context clears.

### Phase 4 — Undo

**Goal:** The player can reverse their last action.

- Add a `Z` command (or `U`) that calls `undoLastPlayerUndoableAction()`.
- Display what was reversed (action name, actor, targets, stat changes restored).
- If undo is not available, display the reason returned by the engine.

### Phase 5 — Enemy AI (DONE)

**Goal:** Enemies act automatically on their turn; the player observes the results.

This phase requires additions to the `logic` submodule:

**Logic changes needed:**
- Add a squaddie controller field or a separate ownership map to `MissionState` (or expose it
  via `MissionEngine`). Initial values: `PLAYER` affiliation → human, `ENEMY` / `ALLY` / `NONE`
  affiliation → AI.
- Add `getRecommendedActionForSquaddie(squaddieId)` to `MissionEngine`. A minimal AI strategy:
  move toward the nearest foe, then use an offensive action if in range, otherwise end turn.

**Runner changes:**
- When the active phase is not `PLAYER_TURN`, check if the current phase squaddies are
  AI-controlled.
- For each AI-controlled squaddie that can act, call `getRecommendedActionForSquaddie()`,
  execute the action, and display the narrated result.
- After all AI squaddies have acted (or have no valid actions), call `transitionToNextPhase()`
  automatically.
- Keep the existing human-input loop only for `PLAYER_TURN` (and any phase where the active
  squaddies are marked as human-controlled).

### Phase 6 — Polish and Robustness

**Goal:** Clean up edge cases to make the play session feel complete.

- Guard against selecting a squaddie from the wrong affiliation and attempting to command it
  during the wrong phase. Display a clear error instead of silently failing.
- When a squaddie is defeated mid-combat, display a defeat message and remove it from the
  controllable list immediately.
- Show conditions and their remaining duration in the squaddie detail view.
- Add a `help` or `?` command that also explains the turn flow and the objective win/loss
  conditions.
- Ensure the test harness map name is displayed when rendering the map.
