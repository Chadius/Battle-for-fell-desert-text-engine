# Browser Presentation Layer — Options

The CLI already proves that the `logic` submodule can drive a full playthrough through a thin,
mostly stateless presentation layer (`TextMissionRunner` → `CommandProcessor` → `Inspectors` →
`MissionEngine`). The question isn't really "HTML5 vs Canvas" in the abstract — it's "what does a
*new renderer* look like, and how much of the CLI's shape survives the move to a browser?"

Two things about this game make the decision easier than it looks:

- **It's turn-based, not real-time.** Nothing needs a `requestAnimationFrame` loop ticking 60
  times a second. A render is a reaction to a state change (a command was processed, an AI acted,
  a phase transitioned), not a continuous simulation. That removes most of Canvas's usual
  argument for existing.
- **The map is a staggered hex grid** (see `docs/targeting.md`). Hex tiles are mildly annoying in
  pure CSS (you can fake it with `nth-child` offsets and clip-path hexagons) and free in Canvas/SVG
  (you're just drawing polygons at computed centers).

That reframes the decision as **DOM vs SVG vs Canvas as a *rendering target***, with the game
brain — `CommandContext`, `InteractionPhase` state machine, `CommandProcessor` — staying almost
identical to what already exists. The Inspectors are the only layer that's CLI-specific (they
format engine data into strings); everything upstream of them (engine calls, phase advancement,
context/state tracking) is already renderer-agnostic.

---

## What carries over unchanged

```
CommandContext            → still tracks selected squaddie, InteractionPhase, pending action
InteractionPhase           → still BROWSING / SELECTING_ACTION / SELECTING_TARGET / CONFIRMING_ACTION / VIEWING_RESULTS
CommandProcessor           → still validates affiliation/phase before mutating, still routes to MissionEngine
MissionEngine calls        → unchanged: readyAction, useActionAndGetResults, previewReadiedActionAndForecastResults, etc.
```

What changes is only the **input mapping** (keystrokes → clicks/taps) and the **output mapping**
(formatted strings → DOM/SVG/Canvas draw calls). In other words: write a `WebMissionRunner`
alongside `TextMissionRunner`, not instead of it — same brain, new face. This also means the CLI
stays useful as a debugging/scripting tool even after a GUI exists.

---

## Approach A — DOM + SVG (no Canvas at all)

Render the hex grid as an `<svg>` with one `<polygon>` per tile and one nested `<g>` per squaddie
sprite; render menus, HUD, dialogs, and the action list as ordinary HTML. Click handlers on
`<polygon>` elements map directly to the same `(row, col)` coordinate input the CLI already
accepts.

**Why this fits the game well:**
- Every tile and unit is a real DOM node — free hit-testing (no manual point-in-hexagon math),
  free hover states (`:hover`), free accessibility (`role="button"`, `aria-label="Slither Demon,
  12/20 HP"`, tab order, screen-reader announcements on state change).
- CSS transitions/`@keyframes` cover the animation needs of a turn-based game fine (move a unit
  along a path, flash on hit, fade out on defeat). You don't need a physics/animation engine for
  "slide from tile A to tile B."
- Layout concerns (which you flagged as HTML's weak point) are actually smaller here than for a
  typical web app: the map is a fixed-aspect SVG viewport, and the UI chrome (action list, HUD,
  confirm dialog) is normal flexbox/grid — the kind of layout HTML is good at, not the kind that
  fights you.
- The turn-based, discrete-input nature of the game matches HTML's request/response mental model
  almost exactly: player acts → state updates → re-render. No divergent "game loop vs. UI thread"
  synchronization problem to solve.

**Where it costs you:** highly stylized combat effects (particle bursts, screen shake, elaborate
crit animations) are more work in SVG/CSS than in a raster canvas or a game lib. If the visual
ambition is "clean tactics-game UI," this is cheap. If it's "flashy juice on every hit," it gets
expensive.

There's a second cost that only shows up once maps get large: **viewport/scrolling.** A hex map
that doesn't fit on screen needs a camera — render only the visible region, pan/scroll around a
map that's bigger than the viewport. With one `<polygon>` per tile, every tile is a real DOM node
that exists (and costs layout/paint/hit-test time, and adds to the accessibility tree) whether
it's on screen or not, unless you build your own virtualization layer on top of SVG to mount/unmount
off-screen tiles — at which point you're re-implementing the thing Canvas gives you for free
(draw only what's inside the current viewport rect; off-screen tiles cost nothing because they're
never drawn). `viewBox` panning/zooming helps with the *transform* but not with the node-count
problem underneath it. This is the concrete reason viewport/scrolling pushes against a pure-SVG
approach for any map bigger than a screenful — see Approach B.

The old p5.js prototype already had to solve this — its README documents four separate ways to
scroll the map (mouse-to-edge, click-drag, shift+arrow keys, mouse wheel) — so it's a confirmed
requirement, not a hypothetical.

## Approach B — Hybrid: Canvas map + DOM chrome

Draw the hex grid and unit sprites on a single `<canvas>` (redraw-on-state-change, not a game
loop), and layer ordinary HTML on top/beside it for menus, HUD, dialogs, and combat-log text.
This is the common pattern for browser tactics games (Into the Breach's web prototype era, most
Slay the Spire–likes) for a reason.

**Why this fits:**
- You get full raster control over the map — tile art, unit sprites, lighting, animated effects —
  without needing pixel control over *menus*, where DOM is strictly better (text layout, focus
  management, resizing, accessibility).
- Accessibility gets solved the same way roguelikes/tactics games usually solve it: the canvas is
  the *visual* representation, but an off-screen or `aria-live` DOM structure (or a "list view"
  toggle) carries the same information your `L`/`W`/`M` inspectors already produce as text. You
  already have the data model for this — the Inspectors format exactly what a screen-reader
  fallback view would need.
- Click-to-tile math is a bit of manual work (invert your hex-to-pixel projection), but it's a
  solved, small problem — not a blocker.
- Viewports/scrolling are the normal case for canvas, not a special one: a camera offset (`(x, y)`
  pan) plus a clip to the visible tile range, and you only ever draw what's on screen. Off-screen
  tiles cost nothing — no DOM nodes exist for them to begin with. Panning is just changing the
  offset and redrawing, the same shape as the old p5.js prototype's mouse-edge/drag/keyboard/wheel
  scrolling, minus the hand-rolled hit-testing.

**Where it costs you:** two rendering systems to keep in sync (canvas redraw + DOM state), and
you own animation timing/easing yourself instead of getting it from CSS or a library.

## Approach C — Full game-engine Canvas/WebGL (Kaplay, Phaser, PixiJS)

Adopt a game library and build the whole thing — map, units, menus, dialogs — inside its canvas,
using its scene/entity/sprite system.

**Why you'd want it:** if the visual ambition grows toward "this looks and feels like a real
tactics game" (juicy hit animations, camera pans, particle effects, sound-synced feedback), these
libraries give you that toolkit for free, and you get a real game loop if the scope ever grows
beyond strictly turn-based (e.g., real-time movement previews, animated AI "thinking").

**Why it's the heaviest option for *this* project specifically:**
- You inherit a full game loop and scene graph for a game that structurally doesn't need one —
  most of that machinery sits idle waiting for the next discrete player command.
- Menus/dialogs/forms built inside a canvas game engine are consistently the weakest part of these
  libraries. You'd likely end up building an HTML overlay for UI anyway (converging back toward
  Approach B) while paying the engine's bundle size and learning curve for the map rendering you
  could've gotten from Canvas 2D directly.
- Accessibility is the hardest to retrofit here, same reason as pure Canvas, compounded by the
  engine owning input handling.
- It's also a step away from "avoid adding new libraries" — worth being deliberate about before
  taking it on, versus Approaches A/B which need nothing beyond what a browser gives you (SVG/DOM)
  or one small vanilla Canvas 2D wrapper.

---

## Comparison

| | A: DOM+SVG | B: Canvas+DOM hybrid | C: Game engine (Kaplay/Phaser/Pixi) |
|---|---|---|---|
| Fits turn-based, no-game-loop reality | Best | Good | Fighting the grain |
| Accessibility | Native, ~free | Needs a parallel DOM/ARIA layer (you already have the data via Inspectors) | Hardest to retrofit |
| Hex-grid layout | SVG polygons — no fight | Canvas draw — no fight | No fight, but inside engine's coordinate system |
| Large/scrolling maps (viewport) | Needs hand-built virtualization to avoid off-screen DOM cost | Native — only draw what's in the camera rect | Native, engine has camera/viewport built in |
| Visual ceiling (juice/effects) | Lower | High | Highest |
| New dependencies | None | None (or a tiny helper) | A game library + its ecosystem |
| Menus/dialogs/forms | Native HTML | Native HTML | Weak spot of most engines |
| Engineering novelty vs. CLI's brain | Lowest — new renderer only | Low-medium | Highest — input/scene model changes too |

---

## Recommendation

*(Superseded by the "new requirements" addendum below, and further reinforced by the viewport
point above — kept for the reasoning trail.)* ~~Start with Approach A (DOM + SVG), treating it as
a straight port, and migrate the map to Canvas later if the visual ambition outgrows flat SVG.~~

Go straight to **Approach B (Canvas map + DOM chrome)**: keep
`CommandContext`/`InteractionPhase`/`CommandProcessor` exactly as they are, write a
`WebMissionRunner` that maps clicks to the same coordinate/command inputs the CLI parses, and
replace the *Inspectors'* string output with a Canvas map render plus DOM/HTML for menus, HUD, and
dialogs. Three independent requirements all land on B rather than A, so there's no "start simple,
migrate later" step to take:

- **Viewport/scrolling.** Any map too big for one screen needs a camera. Canvas draws only what's
  in the visible rect for free; SVG needs hand-built virtualization to avoid paying DOM/layout/
  accessibility-tree cost for off-screen tiles. The old p5.js prototype already needed four
  scrolling input methods, so this isn't hypothetical.
- **Movement animation.** Multi-step tweens/easing (not just an A-to-B slide) are what
  Canvas + `requestAnimationFrame` is for; CSS transitions get fought past simple cases.
- **Large sprites.** Many DOM/SVG `<image>` nodes with big raster art costs more (layout/paint per
  element) than a canvas blitting into a shared buffer.

Accessibility — Approach A's main advantage — isn't lost, just moved: the CLI's `L`/`W`/`M`
Inspectors already format exactly the data a parallel `aria-live`/list-view DOM layer needs
alongside the canvas, so that data model doesn't need to be invented, only re-rendered.

Reach for Approach C only if the project's ambitions shift toward something more real-time or
visually elaborate than a hex tactics game with discrete turns — at that point the engine's game
loop and effects toolkit start paying for themselves instead of sitting idle.

---

## Addendum — animation/movies/large sprites + itch.io hosting

Two follow-up requirements (movement animation, movie playback, large sprite support) and a
distribution target (itch.io, as a static zip with `index.html`) came up after the initial
recommendation. Short version: **itch.io hosting doesn't discriminate between Approaches A/B/C —
it's neutral.** The new feature requirements are what push the choice toward **Approach B
(Canvas map + DOM chrome)**, which is what was picked.

### Why itch.io doesn't affect the A/B/C choice

itch.io just serves the extracted zip as a static file tree at a URL, inside an iframe. That's
true whether the zip contains a hand-rolled DOM+Canvas app, a bundled Phaser/Kaplay build, or
plain SVG/HTML. Nothing about itch requires a server, and nothing about itch prefers canvas over
DOM — plenty of itch HTML5 games are pure DOM (visual novels, interactive fiction, `bitsy`
games). A few real constraints apply evenly to all three approaches, and are worth designing
around regardless of which one you land on:

- **No backend, ever.** Anything the CLI currently does synchronously on disk has to become
  something the browser build fetches or bundles instead. Concretely: **`campaignLoader.ts`
  currently reads campaign/movie/army/glossary JSON via `node:fs`
  (`readFileSync`/`readdirSync`) and `node:path`.** That code path can't run in a browser at all,
  itch or not — it needs a fetch()-based loader that pulls the same JSON from static files
  shipped alongside `index.html`. This is a prerequisite for a browser build in general, not
  something specific to the presentation-layer decision, but it's the first thing that'll break
  if untouched.
- **Relative paths only.** itch mounts your game under a path it controls, not `/`. Whatever
  bundler you use (Vite, esbuild, etc.) needs to emit root-relative-free output — e.g. Vite's
  `base: "./"` — so asset/script URLs resolve inside itch's iframe.
- **Static ≠ "all loaded upfront."** The zip is just how itch *hosts* the build; once uploaded,
  the browser fetches files from it like any normal website, on demand, with normal HTTP
  semantics (including range requests). A `<video>` element streaming a movie file, or a `fetch()`
  for a sprite sheet only needed in one mission, still loads lazily — you don't need to inline
  everything into one JS bundle to keep the initial load light.
- **Sizing/fullscreen.** itch lets the page author configure a fixed embed size or "automatically
  scale" the iframe, and offers a fullscreen button that calls the Fullscreen API on your page.
  Either way, wrap the whole app (canvas + DOM chrome) in one container element so fullscreen and
  resize handling apply to both layers together, and make sure the canvas resize handler accounts
  for `devicePixelRatio` so sprite art doesn't blur when itch's frame is scaled up.

None of that argues for or against DOM, SVG, or Canvas — it's baseline browser-deployment work
any of the three approaches would need.

### Why the new requirements point at Approach B specifically

- **Movement animation** — tweening a sprite's position across a path, easing it into an attack
  and back — is exactly what `<canvas>` + `requestAnimationFrame` is for. CSS transitions (the
  Approach A story) can do simple slides, but multi-step paths with easing/timing control get
  fought rather than helped by CSS once the animation isn't "A to B."
- **Large sprite support** — many DOM/SVG `<image>` nodes with big raster art gets expensive
  (layout/paint cost per element); a canvas just blits into a shared buffer. This is the actual
  ceiling Approach A runs into at scale, more than accessibility or layout.
- **Movie playback** maps directly onto an HTML `<video>` element — which is DOM, not canvas, and
  fits naturally in the hybrid's "canvas for the map, DOM for everything that isn't the map"
  split. It also lines up with what the runner already does: `engine.isMoviePlaying()` currently
  reroutes CLI input during cutscenes instead of treating that time as an interactive phase — in
  the browser, that's the same signal used to swap the `<video>` overlay in and pause canvas
  input, so the existing phase-routing logic carries over unchanged.

So the hybrid choice holds up, and gets a bit more clearly correct once movement animation, movie
playback, and large sprites are in scope — those three land on Canvas, `<video>`, and Canvas
respectively, which is exactly Approach B's split. The one piece of work that's real regardless
of the presentation approach is retiring `campaignLoader.ts`'s `node:fs` usage in favor of
fetch-based loading before any of this can run in a browser at all.

---

## Sketch — `campaignLoader.ts` as fetch-based

`campaignLoader.ts` today does two things per function: **decide which file(s) to read**, and
**actually read them** via `readFileSync`/`readdirSync`. Only the second part is Node-specific.
The parsing/merging/fallback logic (`displayName?.[locale] ?? folderName`, merging campaign JSON
under `campaignData`, warning on `addSquaddiesFromJson` errors, etc.) is pure and stays exactly as
it is today. So the shape of the change mirrors the presentation-layer decision: **keep the brain,
swap the I/O boundary.**

### 1. Extract the I/O into a small interface

```ts
// campaignDataSource.ts
export interface CampaignDataSource {
    // Returns the file's text, or undefined if it doesn't exist.
    readTextFile(path: string): Promise<string | undefined>
    // Returns subfolder names at path, or [] if path doesn't exist / can't be listed.
    listDirectories(path: string): Promise<string[]>
}
```

Every `campaignLoader.ts` function takes a `dataSource: CampaignDataSource` parameter and becomes
`async`, replacing `existsSync`/`readFileSync`/`readdirSync` calls with
`dataSource.readTextFile(...)`/`dataSource.listDirectories(...)`. Path joining stops using
`node:path.join` (OS-specific separators) in favor of a trivial forward-slash `joinPath()` helper,
since these are now logical/URL paths, not filesystem paths.

Two examples of what the converted functions look like — the rest follow the same pattern:

```ts
export const loadCampaignDisplayName = async (
    dataSource: CampaignDataSource,
    campaignFolderPath: string,
    folderName: string,
    locale = "en-US"
): Promise<string> => {
    const raw = await dataSource.readTextFile(joinPath(campaignFolderPath, "campaign.json"))
    if (raw == undefined) return folderName
    return JSON.parse(raw)?.displayName?.[locale] ?? folderName
}

export const loadMissionFromFolder = async (
    dataSource: CampaignDataSource,
    engine: MissionEngine,
    campaignFolderPath: string,
    missionFolderPath: string
): Promise<{ isValid: boolean; errors: string[] }> => {
    const readJson = async (folderPath: string, filename: string): Promise<unknown> => {
        const raw = await dataSource.readTextFile(joinPath(folderPath, filename))
        if (raw == undefined) {
            throw new Error(`[loadMissionFromFolder] Missing required file: ${joinPath(folderPath, filename)}`)
        }
        return JSON.parse(raw)
    }

    // Six-plus network round trips over HTTP is worth avoiding serially — fire them together.
    // (Node's synchronous readFileSync never had this cost, so this is new with fetch.)
    const [squaddies, attributeSheets, items, maps, actions, missionState, campaignSquaddies, campaignAttributeSheets, campaignItems, campaignActions] =
        await Promise.all([
            readJson(missionFolderPath, "squaddies.json"),
            readJson(missionFolderPath, "attributeSheets.json"),
            readJson(missionFolderPath, "items.json"),
            readJson(missionFolderPath, "maps.json"),
            readJson(missionFolderPath, "actions.json"),
            readJson(missionFolderPath, "missionState.json"),
            readJson(campaignFolderPath, "squaddies.json"),
            readJson(campaignFolderPath, "attributeSheets.json"),
            readJson(campaignFolderPath, "items.json"),
            readJson(campaignFolderPath, "actions.json"),
        ])

    const loadResult = engine.loadMissionFromJson({
        squaddies, attributeSheets, items, maps, actions, missionState,
        campaignData: {
            squaddies: campaignSquaddies,
            attributeSheets: campaignAttributeSheets,
            items: campaignItems,
            actions: campaignActions,
        },
    })
    return loadResult.isValid ? engine.finalizeLoadingMission() : loadResult
}
```

`loadMoviesFromFolder`, `loadArmyFromFolder`, and `loadGlossaryFromFolder` convert the same way:
`existsSync(path) ? readFileSync(path, "utf-8") : undefined` becomes
`await dataSource.readTextFile(path)`, checked against `undefined` instead of `existsSync`.

### 2. Two implementations of `CampaignDataSource`

**Node (CLI, tests, dev workflow) — thin wrapper around what's there today:**

```ts
// nodeCampaignDataSource.ts
import { readdirSync, readFileSync, existsSync } from "node:fs"

export const nodeCampaignDataSource: CampaignDataSource = {
    async readTextFile(path) {
        return existsSync(path) ? readFileSync(path, "utf-8") : undefined
    },
    async listDirectories(path) {
        if (!existsSync(path)) return []
        return readdirSync(path, { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name)
            .sort()
    },
}
```

**Browser (itch build) — fetch against static files bundled next to `index.html`:**

```ts
// fetchCampaignDataSource.ts
export const fetchCampaignDataSource: CampaignDataSource = {
    async readTextFile(path) {
        const response = await fetch(path)
        return response.ok ? response.text() : undefined
    },
    async listDirectories(path) {
        // See "the directory-listing problem" below — this can't hit the filesystem directly.
        const manifest = await this.readTextFile(joinPath(path, "manifest.json"))
        return manifest == undefined ? [] : JSON.parse(manifest)
    },
}
```

### 3. The directory-listing problem

`listAvailableCampaigns`/`listAvailableMissions` rely on `readdirSync` to *discover* folder names
at runtime. Plain static hosting (itch included) has no directory-listing endpoint — `fetch()`
can only retrieve a file whose exact path it already knows. There's no fetch equivalent of
`readdirSync`.

The fix is a small **manifest file per listable folder** — e.g.
`campaignData/campaigns/manifest.json` containing `["test", "templeDefense"]`, and one
`missions/manifest.json` per campaign — that `listDirectories` reads instead of enumerating the
filesystem. Two ways to keep it from becoming hand-maintained drift:

- A tiny Node script (`npm run generate-manifests`, run in CI/pre-build) that walks
  `campaignData/` with `readdirSync` once and writes the manifest JSON files — the Node data
  source stays manifest-free and keeps using `readdirSync` directly (no behavior change for the
  CLI/dev workflow), only the browser build consumes manifests.
- If a bundler is adopted for the browser build (Vite is the natural fit here), Vite's
  `import.meta.glob()` can enumerate matching files at *build time* and produce the same kind of
  static map automatically, without a hand-authored or generated manifest file at all. Worth
  revisiting once the bundler choice is made; the manifest-file approach above works either way
  and doesn't commit to a bundler yet.

### 4. Impact on callers

`index.ts` is already `async` end-to-end (top-level `await`, `async function` throughout), so
every call site just gains `await` and a `nodeCampaignDataSource` argument — e.g.
`loadArmyFromFolder(campaignFolderPath)` becomes
`await loadArmyFromFolder(nodeCampaignDataSource, campaignFolderPath)`. No control-flow
restructuring needed.

`campaignLoader.test.ts` currently calls these functions directly against real fixture folders
under `campaignData/campaigns/test` — no mocking, per the project's testing conventions. That
stays true: tests inject `nodeCampaignDataSource` and `await` the calls, still reading the same
real fixture files on disk. The `CampaignDataSource` interface is small enough that a future
in-memory test double (a `Map<string, string>` behind the same interface) is an option if some
tests want to stop touching disk entirely — not required, just available once the seam exists.
