In these diagrams, A is the actor and T is the target. These take place on a hexagon grid with staggered rows. Odd
numbered rows are shifted 1/2 tile to the right and Even rows are to the left.

## General settings

### Coordinate system

We use `(q,r)` or `(row, col)` to represent the two axes.

- `r/row` is a horizontal axis. Positive values move towards the right.
- `q/col` is a vertically aligned axis. Because of the staggered rows, positive values will move down right on even rows
  and
  down left on odd rows. Negative values will move up left on even rows and up right on odd rows.

The topleft corner is `(0,0)` and moves down and to the right. Coordinates cannot be negative, and are considered off
map.

### Map diagrams

I've drawn maps to help demonstrate scenarios.
To draw hex maps, each tile is 2 characters wide. This lets us stagger the rows with an extra character padding the odd
numbered rows (rows start at 0.)

Terrain is split into 5 types:

- Normal terrain has a movement cost of 1 and you can stop on it. Represented with a "1 " or ". "
- Rough terrain has a movement cost of 2 and you can stop on it. Represented with a "2 " or "~ "
- Pits have a movement cost of 1 and you cannot stop on it. Some squaddies cannot pass on it. Represented with a "- "
  or " _ "
- Walls do not have a movement by default and you cannot move through or stop on them. Represented with any other
  character (
  default is "  " or "# ").

By default, targeting has these overrides:

- movement cost is always 1, even on Rough terrain
- can move through pits
- cannot move through walls

### Range

Ranges have a minimum and maximum range and the type of action shape defines how it is used.

### Terrain considerations

By default, actions can cross pits but not pass through walls.

If we have the option to move through walls, they cost 1 movement.

#### Line of Sight effects

Selecting the target coordinate by default will respect pits and walls. This means if a target hides behind a wall they
cannot be targeted.

```
A # T
 . . . 
. . . 
```

In this example, the squaddie cannot point at the target T because the wall at `(0,1)` is in the way.

```
. # T
 . . . 
. A . 
```

This would work because the wall is not blocking the line of sight.
We'll have to trace a line from the intended target to the actor to ensure we can hit them.

### Some actions require the target to be directly selected

By default, you have to select a valid squaddie as the primary target.

Some actions will allow you to select empty space as long as there is a target in the area of effect. This could be used
to throw a grenade like projectile where the main purpose is to throw the weapon near the target.

## Bloom

The user selects a specific point on the map that is within minimum and maximum range. Then the area spreads out from
that point, to a maximum of the area of effect size. It will try to move around uncrossable terrain.

### Area of Effect Size is none

If the area of effect size is undefined or 0, this means only the target is affected.

#### Aim over pits

By default you can aim over pits. The action ranges from 0 to 2. The actor and target are separated by a pit. The target
is valid. If we couldn't aim over pits this would not be valid.

```
. A _ T 
```

#### Blocked by walls

Walls by default block targeting. The action ranges from 0 to 2, but the actor cannot reach the target because the wall
is in the way.

```
. A # T 
 . . . . 
```

Note if the action could pass through walls, the 0 to 2 range action would target.

### Area of Effect Size is positive

From the targeted coordinate, we will begin spreading out and find all coordinates. The maximum distance from the target
is set by the area of effect size. On wide open maps, this will create a spreading effect. With obstacles the Bloom will
spend distance crawling around obstacles to hit what's behind them.

For example, if the area of effect size is 1 and the terrain is wide open, I'd expect 7 coordinates: the targeted
coordinate and the 6 coordinates surrounding it.

```
. . B B 
 . B X B 
. . B B 
```

size 2 adds 12 more coordinates.

```
 . B B B . 
. B B B B 
 B B X B B 
. B B B B 
 . B B B .
```

#### Reaching around obstacles

The bloom explosion can crawl around corners. Here's an example where we'd like to reach the target T, but we use X as
the targeted coordinate.

```
. X # T 
 . . . . 
```

We need an Area of Effect Size of at least 3 to accomplish this. It will spread from `(0,1) -> (1, 1) -> (1,2) -> (0,3)`

Here's a visual diagram that shows T is in range.

```
. B0 # B3 
 . B1 B2 . 
```

## Line

Line based targeting draws a line from the actor to the target. It extends the entire range of the action. Any other
squaddies on that line are affected.

### Line length depends on range

```
. A T1T2T3. T4
```

With this example map, the Actor A has potentially 4 targets. T1, T2, T3 are next to each other and T4 is 5 tiles away.

If the action is range 2, and the user selects T2 as my target, we will draw a line from `(0,1)` to `(0,3)`. This will
hit T1 and T2. If the user selects T1 instead, the line is still from `(0,1)` to `(0,3)` - it has to extend to the full
range of the action. T1 and T2 are still affected. T3 and T4 are out of range.

### Line can be stopped by terrain

```
. A T1# T2. T3
```

This action has range 4, but by default it cannot pass through walls. Since actor A would have to draw a line through
the wall at `(0,3)`, this means the user cannot select T2 or T3 as targets.

### Area of Effect Size determines width

Lines by default are around 1 tile wide. The Area of Effect Size can affect the width. If it is undefined or 0 the line
is 1 pixel wide as before.

### Area of Effect Size is positive

If the Area of Effect Size is positive, the line is now a rectangle. It will extend perpendicularly on both sides by the
amount. So if the Area of Effect Size is 1, it will be 3 pixels wide.

```
. . . .
 . E E .
. A L T
 . . E E
. . . .
```

In this example, the action is range 0-2. The Actor A selects Target T. We draw a line from L to T. The line extends 1
tile
perpendicularly on both sides by the Area of Effect Size. So up to 6 tiles are in the effect.

#### Which way is perpendicular?

On a hexagonal grid, a rectangle can extend in 6 directions. To determine the diagonal lines, we use the dot product of
each direction. Then we take the 2 smallest and use them as the diagonal.

The dot product multiplies the q components of the line and the direction, the r components are multiplied and both
components are added. Then we get the absolute value of the result.

Two lines are diagonal if the dot product is 0. We'll select the two directions that minimize the dot product.

#### What if it's length 0?

This is a degenerate case. The line is undefined in this case, so any drawing will work.
We'll default to up left and down right directions just to be consistent.

#### What about blocking terrain?

While the lines must respect blocking terrain, the width is still important. Most likely we'll have to raycast and draw
lines from each candidate to make sure the wall isn't blocking them.

```
. . . . . .
 . E E E . .
. A T1# T2.
 . . E E # T3
. . . . . .
```

For example, take an action with a line ranged 0 to 4 tiles. It has an area of effect size of 1. It cannot go through
walls. T1 is targeted. The line goes to the right but stops at the wall tile at `(2,2)`.

However, we still need to consider the effect spreading and how it interacts with blocking terrain. T2 is directly
behind a wall that connects A and T1, so line of sight rules mean it will not be a target.

If we drew the line from `(2,1)` to `(2,5)` and expand it, we have new areas marked E on the map. `(1,4)` is blocked by
the wall at `(2,2)`, so it's not part of the area.
