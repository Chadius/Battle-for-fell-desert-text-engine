# Overview

This project is a text-based engine to play a turn based strategy game called The Battle of Fell Desert.

The game logic is located at https://github.com/Chadius/Battle-for-fell-desert-logic.git .
This is the new version of the previous project located at https://github.com/Chadius/Torrin-TBS .

One person is writing this program in TypeScript.

We use Test-Driven Development to write new features.

Avoid adding new libraries, always ask if a package should be added.

Code changes need to be very confined and relatively minimal.

## TypeScript conventions

Filenames are written in camelCase, where the first letter is lower case and the beginning of words are upper.

Avoid the `any` type. Create a new type to support the argument. Export the type if multiple files will use it.

Prefer undefined over null, and use `==` when comparing to undefined. If you need to make a difference between them,
add a boolean value, so it is unnecessary.

Use Named Exports.

## Types and Interfaces

Use PascalCase to name them. The first letter of each word should be capitalized.

Types should be used if we expect a future Union of different Types. It is also used for simple concepts.

Interfaces should be used by default, especially if the object has nested fields.

If we're creating a new type based on an existing type (for example, a Serialized type of object), it's
preferred to use a Type that Inherits from the Interface and removes/replaces fields.

## Folder conventions

`src` - This is the top level of our application files.
`logic` - Refers to the game logic. This is a git submodule, so you should not edit this directly. If you ever need to
make a change to the logic, prompt me first. I have a local copy of the logic submodule and should make edits in there.
Then you can update this submodule with the changes.

## Error handling

Prepend the error message with the name of the non-private function. For example:

`[InBattleSquaddieManager.DealDamageToSquaddie] No manager is defined`

Indicates I tried to call DealDamageToSquaddie on InBattleSquaddieManager, but the manager is undefined.

This will make it easier for me to debug.

## Variable naming

Use verbose names in camelCase when necessary. Avoid abbreviations except for Id. If the meaning is implied, you don't
need a full description.

For example, `OutOfBattleSquaddieAttributeSheet.id` refers to the OutOfBattleSquaddieAttributeSheet's id field, so the
name is clear.

But when InBattleSquaddie needs to know about it, we use `attributeSheetId` since there are other ID objects
like `InBattleSquaddie.id`, so this is used to disambiguate.

## Documentation

The test descriptions and variable/function names should be used to document as much as possible.

To help me understand what code is generated, please continue adding comments above the code blocks.
I will remove them from the committed code, but it will help me understand why it is written that way.

Avoid trivial comments, like adding "Given/When/Then" in test code.

SonarQube has a warning when a function exceeds a complexity of 15. That's a good indicator that a function should be
broken into several helper functions.

## Reducing code complexity

If an object has multiple optional fields and independent work can be done on each, use multiple helper functions
instead of multiple if statements. This reduces complexity and makes it easier to read.

For example, use serialize() and deserialize() to convert components. If they have multiple independent fields,
call serialize<FieldName>() and deserialize<FieldName>() multiple times. They should return the modified object.

# MissionRunner and MissionEngine

This application will use MissionRunner objects to interact with MissionEngine objects.

As much as possible, the MissionRunner should be stateless. It should only hold references to the MissionEngine and
other managers. This makes it easier to test and swap out components.

The MissionRunner will only interact with MissionEngine objects. This will keep game logic contained and make it easier
to test and swap out components.

# Test files

Test files use the extension `test.ts` . All tests use the vitest library. Use `npm run test` to run the entire test
suite.

Use one `describe` block, usually with the name of the object/class under test. You can nest `describe` blocks within.

Try to avoid mocking objects if possible. I'd rather you make simple and specific examples of underlying objects
and make large test files. Mocked objects break when the functions change. You can also make test classes and test
objects as needed.
