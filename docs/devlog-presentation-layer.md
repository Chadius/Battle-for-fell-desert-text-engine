# Game overview: Battle for Fell Desert

This is a turn-based strategy game. You will choose from up to 10 squaddies, deploy up to 4 with a set leader. They travel a hexagonal map, taking turns with enemy and ally factions. Actions are resolved using random dice to hit/resist and set effects. Your squaddies level up and gain new powers over time.

You can play the demo here INSERT LINK HERE that was made using p5.js, a very lightweight multimedia library. Emphasis on lightweight, we'll get back to that in a minute. For now though let's look at its requirements.

## Platform

We're going to keep this simple. I'm running this game on a web browser.

Executables are hard for me to justify since I'd have to convince people to install the game and make sure it's compatible on their hardware. And then I'd have to update it.

It's much easier to put it out on the web.

## UI

There are a lot of menus and many decisions players have to make.

- Select a Squaddie to move
- Select where to move the squaddie
- Select an action (and get feedback if it's not usable)
- Preview the results of the action
- Confirm or Cancel

And that's just spending a squaddie's actions! What about item management? Or leveling up?

## Draw a Hex grid with icon animation

Hex grid maps present a few challenges, like drawing the hexes. Do I draw squares or actual hexagons?

INSERT ART OF SQUARES IN HEX FORMATION vs HEXAGONS IN FORMATION

Squares are easier and less perfomant to draw but hexagons are more accurate and may be easier for players to understand.

I also want to add icons for the Squaddies to represent their locations.

## Movies and large sprites

Large images, custom videos and multimedia music - all are possible and on the table.

## Accessibility

Need to handle languages, need to let the user highlight and change text. Some people will let the game animate and then read the post-action report to see what happened. Keyboard/Mouse/Controller support would be great.

# Review existing engine

I have a p5.js implementation of the combat engine. Turns out I reached the limits quickly.

## Limited multimedia support

p5.js assumes you want to load everything at once. So the in battle sprites, out of battle portraits, every movie... all of them. No way to easily load and manage a subset. And no matter what, console warnings leak. Not a fan.

## No UI support

The menus had to be drawn by hand. Clicking on a button had to be coded by hand (it's way harder than it looks!) I wish this were just built in. UI has a lot of usability concerns managed already. Reinventing the wheel is PAINFUL.

## Handcrafted Animation/Physics

The attack animations with sliding heads? That's me doing manual lerp calculations frame by frame. It was fun to make a library that could generate distance over time calculations but that was quite the diversion. What happens when I want to add projectiles or custom animation?

I feel a hybrid approach would do well on this. I want HTML to leverage its UI, but I also want a more custom interface for sprites, the map, cutscenes, dialogs and movies.

# Landing on a hybrid architecture

The old TypeScript project itself saw this coming. Its own `TECHNICAL.md` picked p5.js for one
reason — "web interface so users don't have to download or install, compatible on multiple
browsers" — and then listed the exact costs above as the tradeoff: "No built-in UI means I have to
build a lot from scratch." It even left itself a note on the way out: "It may be possible to swap
out graphics engines in the future if I keep it cleanly separated." That's the seam this rewrite
is standing on.

The CLI rewrite (`fell-desert-cli`, this project) already did that separation, just not on
purpose — it happened because a text interface forces it. `CommandContext` tracks what's selected
and what phase of interaction we're in. `InteractionPhase` (`BROWSING` → `SELECTING_ACTION` →
`SELECTING_TARGET` → `CONFIRMING_ACTION` → `VIEWING_RESULTS`) is the same state machine that used
to live inside p5.js's hand-rolled click handlers, except now it's plain TypeScript with no
rendering opinions baked in. `CommandProcessor` validates whose turn it is and routes to
`MissionEngine`. None of that code asks "how do I draw a button" — it never had to, because the
CLI's answer to "draw a button" is "print some text." That's the accident that makes a browser port
tractable: the brain and the face were already split.

So the question this doc thread worked through (see `browser-presentation-options.md` for the full
comparison) wasn't "pick a new p5.js" — it was "what renders `CommandContext`'s state now, and how
much of it can be *given away* instead of hand-built." Three options were on the table:

- **A — DOM + SVG.** Every hex tile and unit is a real DOM node. Free hit-testing, free `:hover`,
  free `aria-label`s. This directly answers the "No UI support" complaint above — buttons,
  confirm/cancel, item menus, all become actual `<button>`s instead of hand-coded click-region
  math.
- **B — Canvas map + DOM chrome.** Canvas owns the hex grid and sprites; ordinary HTML owns menus,
  HUD, and dialogs. This is p5.js's canvas half, kept, with the UI half handed to the browser.
- **C — Full game engine (Phaser/Kaplay/PixiJS).** Everything, including menus, lives inside the
  engine's scene graph — closest to "replace p5.js with a bigger p5.js," and correspondingly it
  inherits the same "menus are the weak spot" problem, just inside a heavier dependency.

The pick was **B**, and your draft's own "Review existing engine" section is most of the reason
why:

- *"No UI support"* → solved by DOM chrome, same as Approach A would. Buttons, confirm/cancel,
  item lists, leveling menus are native HTML elements with built-in keyboard/mouse handling —
  nothing left to hand-code.
- *"Handcrafted Animation/Physics"* → this is the one place Approach A falls short and B doesn't.
  CSS transitions are fine for an A-to-B slide but fight you once an attack animation needs
  multi-step easing, a projectile arc, or a camera nudge. Canvas + `requestAnimationFrame` is
  exactly the tool for that — you keep writing tween code, but only for the map layer, not for
  every button in every menu like p5.js forced you to.
- *"Limited multimedia support"* → this splits two ways. Movie playback maps straight onto an
  HTML `<video>` element (DOM, not canvas) — which conveniently lines up with a signal the runner
  already has: `engine.isMoviePlaying()` currently reroutes CLI input during cutscenes instead of
  treating it as an interactive phase. In the browser, that's the same flag used to swap in a
  `<video>` overlay and pause canvas input. Large sprites and lazy loading are the other half —
  p5.js's "load everything up front" behavior goes away because nothing here loads through it
  anymore; the browser build fetches JSON/images on demand instead (see the
  `CampaignDataSource`/fetch sketch at the end of `browser-presentation-options.md` — this was
  already a requirement for itch.io static hosting regardless of A/B/C).
- **Hex drawing** (squares vs. true hexagons) stops being a tradeoff under B. Canvas draws real
  hexagon polygons at computed centers for free — no `clip-path` fighting, no squares-as-a-hack.
- **Accessibility** is the one place B costs something A wouldn't: the canvas map has no DOM nodes
  for a screen reader to read. The mitigation is that the CLI's Inspectors (`L`, `W`, `M`) already
  format exactly the data a parallel `aria-live` or "list view" fallback would need — that data
  model doesn't need to be invented, only re-rendered as an off-screen or toggleable DOM structure
  alongside the canvas.

Net effect: the hybrid isn't a new idea bolted onto the old p5.js engine, it's what's left of
p5.js's canvas half once its DOM half is deleted and replaced with real HTML — with the
`CommandContext`/`InteractionPhase`/`CommandProcessor` state machine, already proven out by the
CLI, sitting underneath both.

## Next steps

1. Extract `campaignLoader.ts` off `node:fs` and onto the `CampaignDataSource` interface (Node
   implementation first, no behavior change) — this is required before any browser build can load
   campaign data at all, independent of A/B/C.
2. Write `WebMissionRunner` alongside `TextMissionRunner`: same `CommandContext` /
   `InteractionPhase`, new input mapping (clicks instead of keystrokes).
3. Replace the CLI's string-formatting Inspectors with a Canvas map renderer + DOM chrome for
   everything else, reusing the same engine calls (`readyAction`, `useActionAndGetResults`,
   `previewReadiedActionAndForecastResults`, ...) unchanged.
4. Land the `aria-live`/list-view accessibility fallback early rather than as an afterthought,
   since the data it needs already exists in the Inspector layer.
