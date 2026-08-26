# Requirement: `manifest.json` files for browser-based directory listing

**For:** the campaign data project (`campaignData/campaigns` — currently backed by
`/Users/chadserrant/pCloud Drive/My Games/BattleOfFellDesert/campaigns`)

**Requested by:** `fell-desert-cli`, the CLI/engine-runner project that consumes this data

## Background

`fell-desert-cli` currently reads this project's campaign/mission folders directly off disk using
Node's `readdirSync`, to answer two questions: "what campaigns exist?" and "what missions exist in
this campaign?" That works today because the CLI runs under Node, which has full filesystem
access.

A browser build of the same game is planned. Browsers have no filesystem access and no
`readdirSync` equivalent — client-side code can only `fetch()` a file whose exact path it already
knows. A static file host (the deployment target) has no "list the contents of this folder"
endpoint at all. So directory *discovery* has to be replaced with a file that already states what
the directory contains.

## What's needed

One `manifest.json` file per folder that currently gets listed via `readdirSync`, placed as a
sibling of the folders it describes:

1. **`campaignData/campaigns/manifest.json`** — lists every campaign folder directly under
   `campaigns/`.
2. **`campaignData/campaigns/<campaignName>/missions/manifest.json`** — one per campaign, listing
   every mission folder under that campaign's `missions/` directory. E.g.:
   - `campaignData/campaigns/test/missions/manifest.json`
   - `campaignData/campaigns/templeDefense/missions/manifest.json`
3. **`.../resources/manifest.json`** — one per `resources/` folder, listing every resource
   *category* subfolder (e.g. `dialogPortraits`, `backgrounds`) directly under it. A `resources/`
   folder can exist at the campaign level and, independently, at the mission level, so this
   manifest is needed wherever a `resources/` folder is present:
   - `campaignData/campaigns/templeDefense/resources/manifest.json` (campaign level; this folder
     already exists today and contains `dialogPortraits/`)
   - `campaignData/campaigns/<campaignName>/missions/<missionName>/resources/manifest.json`
     (mission level, wherever a mission has its own `resources/` folder)

### Format

A JSON array of folder names (strings only, no paths, no trailing slashes), matching exactly what
the current Node code produces: subdirectories only (not files), sorted alphabetically.

```json
["templeDefense", "test"]
```

```json
["movement", "sneakAttack", "targetPractice", "testHarness"]
```

If a listed campaign/mission folder is later renamed, added, or removed, its manifest must be
updated to match — a stale manifest means the browser build silently can't discover that folder,
even though the folder itself is otherwise complete and correct.

### Scope check

Three folder types need this treatment — `campaignData/campaigns/` itself, each campaign's
`missions/` subfolder, and any `resources/` folder (at campaign or mission level) — are the only
places `fell-desert-cli` currently calls `readdirSync` on. (An earlier version of this doc missed
the `resources/` case.) Nothing else in this data structure (mission contents, army/glossary files,
the contents of a resource category folder itself) is discovered by directory listing; those are
all read by exact, already-known filename, so they need no manifest and no other change.

## Not required

- No change to `campaign.json`, `squaddies.json`, mission JSON, resource files, or any other
  existing content — this is purely additive.
- No change needed for the current Node/CLI workflow — it will keep using `readdirSync` directly
  and doesn't need to read these manifests. This is exclusively for the future browser build's
  benefit.
- No opinion here on *how* the manifests get generated (hand-maintained vs. a small script that
  walks the tree and writes them, run whenever campaign/mission folders change) — that's an
  implementation detail for this project to decide, as long as the manifest accurately reflects the
  current folder contents whenever it's read.
