"use strict";

const CARD_WIDTH = 1024;
const CARD_HEIGHT = 1536;
const DECK_THUMBNAIL_WIDTH = 256;
const DECK_THUMBNAIL_HEIGHT = 384;
// The source socket occupies roughly this footprint in the 1024 px-wide concept.
const SOCKET_SIZE = 288;
const SOCKET_GAP = 12;
// Preserve the source assets' 128:256 rune-to-socket scale from the reference.
const RUNE_SIZE = SOCKET_SIZE / 2;
// The extracted tile is at the original card's pixel scale. Keeping its native
// height preserves the concept art's thin core and compact glow profile.
const LINK_HEIGHT = 128;
const LINK_TILE_WIDTH = 96;
const SOCKET_GEM_SIZE = RUNE_SIZE;
const SOCKET_RUNE_ASSETS = [
  { name: "01", source: "game-assets/runes/rune-01.png" },
  { name: "02", source: "game-assets/runes/rune-02.png" },
  { name: "03", source: "game-assets/runes/rune-03.png" },
  { name: "04", source: "game-assets/runes/rune-04.png" },
  { name: "05", source: "game-assets/runes/rune-05.png" },
];
const RADIANT_RUNE_ASSETS = [
  { name: "01", source: "game-assets/runes/rune-01-radiant.png" },
  { name: "02", source: "game-assets/runes/rune-02-radiant.png" },
  { name: "03", source: "game-assets/runes/rune-03-radiant.png" },
  { name: "04", source: "game-assets/runes/rune-04-radiant.png" },
  { name: "05", source: "game-assets/runes/rune-05-radiant.png" },
];
const RUNE_STONE_ASSETS = [
  { name: "red", source: "game-assets/rune-stones/rune-stone-red.png" },
  { name: "green", source: "game-assets/rune-stones/rune-stone-green.png" },
  { name: "blue", source: "game-assets/rune-stones/rune-stone-blue.png" },
];
const SOCKET_COUNT_OPTIONS = [1, 2, 3, 4, 5, 6, 7];
const DEFAULT_GAME_SETTINGS = {
  startCardCount: 5,
  turnCardCount: 1,
  startStoneCount: 5,
  turnStoneCount: 3,
  socketCountWeights: Object.fromEntries(SOCKET_COUNT_OPTIONS.map((count) => [count, 1])),
  socketRuneWeights: Object.fromEntries(SOCKET_RUNE_ASSETS.map((rune) => [rune.name, 1])),
  stoneTypeWeights: Object.fromEntries(RUNE_STONE_ASSETS.map((stone) => [stone.name, 1])),
  stoneRuneWeights: Object.fromEntries(RADIANT_RUNE_ASSETS.map((rune) => [rune.name, 1])),
};
