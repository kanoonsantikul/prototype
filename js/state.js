"use strict";

let loadedAssets = null;
let gameSettings = structuredClone(DEFAULT_GAME_SETTINGS);
let gameMode = GAME_MODE_SANDBOX;
let phase = PHASE_DECK_BUILDING;
let deck = [];
let drawPile = [];
let discardPile = [];
let hand = [];
let sideGems = [];
let combatEnergy = 0;
let currentEnemy = null;
let currentEncounter = [];
let selectedEnemyId = null;
let combatHero = null;
let combatEnemies = [];
let combatTurn = 0;
let encounterWave = 1;
let persistedHeroHp = null;
let selectedCardId = null;
let nextCardId = 1;
let nextGemId = 1;
let draggingGemId = null;
let draggingCardId = null;
let draggingCardSource = null;
let draggingPointerId = null;
let draggingToken = null;
let dragPreview = null;
let dropTarget = null;
let combatDropHover = false;

function isDeckBuilding() {
  return phase === PHASE_DECK_BUILDING;
}

function isCombat() {
  return phase === PHASE_COMBAT;
}

function visibleCards() {
  return isCombat() ? hand : deck;
}

function setStatus(message) {
  gameStatus.textContent = message;
}

function selectedCard() {
  return visibleCards().find((card) => card.id === selectedCardId) || null;
}

function clearCardUiBindings(cards) {
  for (const card of cards) {
    card.deckButton = null;
    card.deckMeta = null;
    card.thumbnailCanvas = null;
    card.thumbnailContext = null;
  }
}
