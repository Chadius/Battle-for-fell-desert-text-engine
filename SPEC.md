# Battle for Fell Desert CLI — Technical Specification

## Overview

This project is a text-based CLI frontend that prototypes the player interface for the Battle for
Fell Desert, a turn-based strategy game. It exercises the game logic by calling the `MissionEngine`
(from the `logic` submodule) to issue commands, receive results, and advance the game state.

The test harness mission (via `MissionEngineTestHarness`) is the primary playable scenario: Lini
(player) versus the Slither Demon (enemy) on a 5×4 map. The win condition is defeating all enemies;
the lose condition is having all player squaddies defeated.

Missions can also be loaded from JSON campaign data on disk (`campaignLoader.ts`), including
movies/cutscenes (`movieCollectionLoader.ts`, `movieSceneInspector.ts`) that play between phases.

---

## Architecture

### Layers

```
index.ts
  └─ TextMissionRunner         (mission lifecycle: input routing, phase advancement, AI turns)
       ├─ CliPresenter         (all display-text rendering; CLI-specific)
       ├─ CommandProcessor     (input routing, context management)
       │    └─ Inspectors      (read-only data formatters)
       └─ MissionEngine        (game logic facade — in logic submodule)
            └─ MissionManager / Managers
```

### Runner / presenter split

`TextMissionRunner` is renderer-agnostic: it drives the mission (parses input, advances phases,
runs enemy AI, applies objective rewards, tracks the decision clock) and, as it goes, produces a
list of `RunnerEvent` values describing what the player should be told. It never formats display
text itself.

`CliPresenter` (`cliPresenter.ts`) owns every piece of CLI text. It holds only a reference to the
`MissionEngine`; anything runner-owned (opening phase events, the active overlay map, the current
movie scene) is passed in per call. Its surface:

- `welcomeText(initialPhaseEvents, currentScene)` — the opening screen (title, map name,
  deployment status or objectives, opening announcements).
- `mapText(overlayMap)` — the left-panel map: the overlay map when one is active, otherwise the
  freshly rendered grid with turn info and objectives.
- `render(events)` — turns a `RunnerEvent[]` into display text (each event to a line or block,
  empties dropped, joined by newlines).

This keeps a future browser renderer a matter of swapping `CliPresenter` for a
`RunnerEvent`-consuming equivalent, without touching mission logic.

### Key Types

- `RunnerEvent` (`runnerEvent.ts`) — a discriminated union of things the runner wants shown:
  `message` (pre-formatted pass-through text from `CommandProcessor` / deployment / enemy AI),
  `phaseAnnouncement` (phase + turn number; the presenter owns the phase→label map),
  `conditionExpired` (squaddie name + condition type), `movieScene` (a movie frame to display),
  `invalidMovieInput` (bad command or bad decision choice while a movie plays), and
  `missionSummary` (win/loss, turn count, survivor names). `ProcessInputResult.text` is still the
  rendered string — `render()` runs inside the runner before returning.
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
- It calls `transitionToNextPhase()` repeatedly, collecting `RunnerEvent`s (phase announcements,
  condition-expiry, enemy-AI narration), until the engine lands on an interactive phase
  (`PLAYER_TURN`, `ALLY_TURN`, `ENEMY_TURN`, `NONE_AFFILIATION_TURN`) or the phase stops changing.
- The collected events, plus the `CommandProcessor` result and any movie frame, are handed to
  `CliPresenter.render()` to produce `ProcessInputResult.text`.

### Commands (via `CommandProcessor`)

| Input | Action |
|---|---|
| `Q` | Quit |
| `M` | Render the map with terrain, squaddies, turn info, and objectives |
| `?` | List context-sensitive commands, current turn flow, and objectives summary |
| `P` | Show current phase and turn number |
| `O` | Show mission objectives and their status |
| `W` | List squaddies that can act this phase with location |
| `row, col` | Inspect a tile; selects the squaddie there if one is present |
| `L` | Show details for the selected squaddie (HP, AP, conditions with remaining duration, actions) |
| `A` | List available actions for the selected squaddie, numbered |
| `A<n>` | Select the numbered action (e.g. `A1`); enters `SELECTING_TARGET` for actions with targets |
| `AE` | End the selected squaddie's turn |
| `AM` | Show reachable tiles; enter `SELECTING_TARGET` to choose a destination |
| *(coordinate while in SELECTING_TARGET)* | Choose a target/destination; for combat actions, previews the forecast and enters `CONFIRMING_ACTION` |
| `Y` | (in `CONFIRMING_ACTION`) Confirm and execute the readied action; displays results |
| `N` / `C` | (in `CONFIRMING_ACTION`) Cancel back to target selection or browsing |
| `Z` | Undo the last undoable action |
| `DF` | List debug flags and their ON/OFF state |
| `DS <n>` | Toggle debug flag `<n>` (see `DEBUG_FLAG_NAMES` in `commandProcessor.ts`) |

Attempting to command a squaddie outside its affiliation's turn returns a clear error
(`"Cannot command X: it is not Y's turn."`) rather than failing silently.

### What is not yet implemented

**Missing runner capabilities:**

1. **Ally AI** — `isWaitingForHumanInput()` special-cases only `ENEMY_TURN` (skipping the wait
   when the enemy AI has preloaded an action via `getReadiedAction()`). `ALLY_TURN` has no such
   case, so allied squaddies still require a human to play them out manually via `W` + select +
   actions, the same as a player squaddie. `enemyAI.ts` has no ally counterpart.

---

## Gaps in the Game Logic

These items are missing or incomplete in the `logic` submodule and are needed for feature
completeness:

1. **Enemy AI system** — There is no module that decides what an enemy squaddie should do during
   its turn (which action to use, which target to pick, whether to move first). The engine has no
   `getRecommendedEnemyAction()` or similar method. (DONE)

2. **Ally AI system** — Same as enemies. Allied squaddies that are not player-controlled have no
   decision-making path. Still missing — see runner gap above.

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

- Extend action selection to cover non-default actions available on the test harness squaddies
  (implemented as numbered keys, e.g. `A1`, `A2` — see `combatActionIndex` in `actionKeyIndex.ts`).
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

### Phase 4 — Undo (DONE)

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

### Phase 6 — Polish and Robustness (DONE)

**Goal:** Clean up edge cases to make the play session feel complete.

- Guard against selecting a squaddie from the wrong affiliation and attempting to command it
  during the wrong phase. Display a clear error instead of silently failing. (DONE —
  `commandProcessor.ts`'s `handleSelectAction` checks phase affiliation before any mutating
  sub-command.)
- When a squaddie is defeated mid-combat, display a defeat message and remove it from the
  controllable list immediately. (DONE — `actionResultInspector.ts` prints
  `"<name> is knocked out!"` as part of the action result text.)
- Show conditions and their remaining duration in the squaddie detail view. (DONE —
  `squaddieDetailInspector.ts`'s `formatCondition()` appends `(N turns remaining)`.)
- Add a `help` or `?` command that also explains the turn flow and the objective win/loss
  conditions. (DONE — `?` prints the command list, turn flow, and an objectives summary.)
- Ensure the test harness map name is displayed when rendering the map. (DONE)

### Beyond the original plan

Work not covered by the phases above has since landed and is not reflected in the phase list:

- **Campaign/JSON mission loading** (`campaignLoader.ts`) — missions, squaddies, items, actions,
  and maps can be loaded from JSON files on disk instead of only the hardcoded test harness.
- **Movie/cutscene playback** (`movieCollectionLoader.ts`, `movieSceneInspector.ts`) — campaigns
  can define movies that play between phases; the runner detects `engine.isMoviePlaying()` and
  routes input accordingly instead of treating that time as an interactive phase.
- **Debug flags** (`DF` / `DS <n>` commands) — toggle engine-level debug behavior
  (`enemyAlwaysEndsTheirTurn`, `revealHiddenMissionObjectives`) at runtime.
- **Hidden mission objectives** — objectives can be hidden from the player until the
  `revealHiddenMissionObjectives` debug flag is set.
- **Teleport/forced-movement actions** (e.g. Rescue) — a two-phase target-then-destination
  selection flow (`pendingActionIsSelectingTeleportDestination`) distinct from normal movement
  and normal combat targeting.
- **Line/area targeting and flanking display** — `buildActionEffectMapText` renders bolt paths,
  aim coordinates, and hit targets on the map; sneak-attack/flanking status is surfaced in results.
- **Text substitution and decision-clock tracking** — `MissionTextSubstitutionToken` fills in
  dynamic text (e.g. squaddie names) in movie/scene text, and `DecisionClock` tracks how long the
  runner has been waiting on a human decision (`getElapsedDecisionTimeMs()`), pausing during
  movies and AI-driven turns.
- **Runner / presenter split** (`cliPresenter.ts`, `runnerEvent.ts`) — display-text rendering is
  factored out of `TextMissionRunner` into `CliPresenter`. The runner emits a `RunnerEvent[]` and
  the presenter renders it; the public `ProcessInputResult.text` string contract is unchanged. See
  the *Runner / presenter split* section under Architecture.
