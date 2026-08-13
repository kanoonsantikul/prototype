"use strict";

function playCardFromHand(card) {
  const cost = cardEnergyCost(card);

  if (!canPayEnergyCost(combatEnergy, cost)) {
    setStatus(`Not enough energy (${formatEnergyCost(cost)}).`);
    return false;
  }

  combatEnergy = spendEnergyCost(combatEnergy, cost);
  hand = hand.filter((candidate) => candidate.id !== card.id);
  discardPile.push(card);
  clearCardUiBindings([card]);

  renderCombatEnergy();
  renderCardBrowser(selectedCardId === card.id ? hand[0]?.id : selectedCardId);
  updatePhaseChrome();
  setStatus(`Played card for ${formatEnergyCost(cost)}.`);
  return true;
}

function reshuffleDiscardIntoDrawPile() {
  if (drawPile.length > 0 || discardPile.length === 0) return;
  drawPile = shuffled(discardPile);
  discardPile = [];
}

function drawCards(count) {
  const drawn = [];

  for (let index = 0; index < count; index += 1) {
    reshuffleDiscardIntoDrawPile();
    if (drawPile.length === 0) break;
    drawn.push(drawPile.shift());
  }

  return drawn;
}

function beginCombatTurn() {
  if (!isCombat() || deck.length === 0) return;

  clearCardUiBindings(hand);
  discardPile.push(...hand);
  hand = [];
  combatTurn += 1;
  combatEnergy = createTurnEnergy(gameSettings.energyPerTurn);

  const drawn = drawCards(gameSettings.combatHandSize);
  hand = drawn;
  renderCardBrowser(hand[0]?.id);
  updatePhaseChrome();
  setStatus(
    drawn.length > 0
      ? `Turn ${combatTurn}: drew ${drawn.length}, gained ${combatEnergy} energy. Drag a card onto combat to play it.`
      : `Turn ${combatTurn}: no cards left to draw. Gained ${combatEnergy} energy.`,
  );
}

function startCombat() {
  if (!loadedAssets || !isDeckBuilding() || deck.length === 0) return;

  resetPointerDrag();
  clearDropFeedback();
  phase = PHASE_COMBAT;
  combatTurn = 0;
  hand = [];
  discardPile = [];
  combatEnergy = 0;
  drawPile = shuffled(deck);
  selectRandomEnemy();
  resetFighterTrackers();
  redrawCombat();
  closeSettings();
  beginCombatTurn();
}

function endTurn() {
  if (!loadedAssets || !isCombat() || deck.length === 0) return;

  resetPointerDrag();
  clearDropFeedback();
  beginCombatTurn();
}

function endCombat() {
  if (!loadedAssets || !isCombat() || deck.length === 0) return;

  resetPointerDrag();
  clearDropFeedback();

  clearCardUiBindings(hand);
  hand = [];
  drawPile = [];
  discardPile = [];
  combatEnergy = 0;
  combatTurn = 0;
  phase = PHASE_DECK_BUILDING;

  const firstNewCardIndex = deck.length;
  const newCards = Array.from(
    { length: gameSettings.rewardCardCount },
    (_, index) => {
      const card = createRandomCard(loadedAssets, firstNewCardIndex + index, gameSettings, nextCardId);
      nextCardId += 1;
      return card;
    },
  );
  deck.push(...newCards);

  const newGems = createRandomGems(
    loadedAssets.runeStones,
    loadedAssets.radiantRunes,
    loadedAssets.mods,
    gameSettings.rewardStoneCount,
    gameSettings,
    nextGemId,
  );
  nextGemId += newGems.length;
  sideGems.push(...newGems);

  const preferredCardId = newCards.at(-1)?.id || selectedCardId;
  renderCardBrowser(preferredCardId);
  renderSideRuneStones();
  closeSettings();
  updatePhaseChrome();

  const cardLabel = `${newCards.length} card${newCards.length === 1 ? "" : "s"}`;
  const stoneLabel = `${newGems.length} stone${newGems.length === 1 ? "" : "s"}`;
  setStatus(`Combat ended. Gained ${cardLabel} and ${stoneLabel}. Socket stones, then start combat again.`);
}

function startNewGame() {
  if (!loadedAssets) return;

  resetPointerDrag();
  dropTarget = null;
  selectedCardId = null;
  activeCardCanvas.classList.remove("drop-valid", "drop-invalid");
  phase = PHASE_DECK_BUILDING;
  combatTurn = 0;
  nextCardId = 1;
  nextGemId = 1;
  hand = [];
  drawPile = [];
  discardPile = [];
  combatEnergy = 0;

  deck = Array.from(
    { length: gameSettings.startCardCount },
    (_, index) => {
      const card = createRandomCard(loadedAssets, index, gameSettings, nextCardId);
      nextCardId += 1;
      return card;
    },
  );
  sideGems = createRandomGems(
    loadedAssets.runeStones,
    loadedAssets.radiantRunes,
    loadedAssets.mods,
    gameSettings.startStoneCount,
    gameSettings,
    nextGemId,
  );
  nextGemId += sideGems.length;
  selectRandomEnemy();
  resetFighterTrackers();

  renderCardBrowser();
  renderSideRuneStones();
  redrawCombat();
  closeSettings();
  updatePhaseChrome();
  setStatus("Socket matching rune stones into your cards, then start combat.");
}
