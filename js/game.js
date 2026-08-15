"use strict";

function summarizeCombatLogs(logs) {
  return logs.filter(Boolean).slice(0, 4).join(" ");
}

function finishRealCombatIfSettled(reason = "") {
  const outcome = combatOutcome();
  if (!outcome) return false;

  if (outcome === "win") {
    setStatus(reason || "Victory. Rewards granted.");
    endCombat("win");
    return true;
  }

  setStatus(reason || "Defeat. No rewards.");
  endCombat("loss");
  return true;
}

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

  if (isRealGame()) {
    const resolutionLogs = applyCardEffects(card, combatHero);
    renderCombatEnergy();
    renderCardBrowser(selectedCardId === card.id ? hand[0]?.id : selectedCardId);
    updatePhaseChrome();
    redrawCombat();

    const summary = summarizeCombatLogs(resolutionLogs);
    if (finishRealCombatIfSettled(summary || "Combat ended.")) return true;
    setStatus(summary || `Played ${card.name} for ${formatEnergyCost(cost)}.`);
    return true;
  }

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

  const turnLogs = [];
  if (isRealGame() && combatHero) {
    turnLogs.push(...startOfTurnEffects(combatHero));
    if (finishRealCombatIfSettled(summarizeCombatLogs(turnLogs))) return;
  }

  const drawn = drawCards(gameSettings.combatHandSize);
  hand = drawn;
  renderCardBrowser(hand[0]?.id);
  updatePhaseChrome();
  redrawCombat();

  const prefix = turnLogs.length ? `${summarizeCombatLogs(turnLogs)} ` : "";
  setStatus(
    drawn.length > 0
      ? `${prefix}Turn ${combatTurn}: drew ${drawn.length}, gained ${combatEnergy} energy. Drag a card onto combat to play it.`
      : `${prefix}Turn ${combatTurn}: no cards left to draw. Gained ${combatEnergy} energy.`,
  );
}

function startCombat() {
  if (!loadedAssets || !isDeckBuilding() || deck.length === 0) return;

  resetPointerDrag();
  clearDropFeedback();
  lockSocketedGems(deck);
  phase = PHASE_COMBAT;
  combatTurn = 0;
  hand = [];
  discardPile = [];
  combatEnergy = 0;
  drawPile = shuffled(deck);
  if (!currentEncounter.length) selectEncounter(encounterWave);
  if (isRealGame()) initializeRealCombat();
  resetFighterTrackers();
  redrawCombat();
  closeSettings();
  beginCombatTurn();
}

function endTurn() {
  if (!loadedAssets || !isCombat() || deck.length === 0) return;

  resetPointerDrag();
  clearDropFeedback();

  if (isRealGame() && combatHero) {
    expireStatuses(combatHero);
    const enemyLogs = resolveEnemyTurn();
    redrawCombat();
    if (finishRealCombatIfSettled(summarizeCombatLogs(enemyLogs))) return;
    if (enemyLogs.length) setStatus(summarizeCombatLogs(enemyLogs));
  }

  beginCombatTurn();
}

function endCombat(outcome = isRealGame() ? "retreat" : "sandbox") {
  if (!loadedAssets || !isCombat() || deck.length === 0) return;

  resetPointerDrag();
  clearDropFeedback();

  if (isRealGame()) persistHeroAfterCombat(outcome);
  if (outcome === "win" || outcome === "sandbox") encounterWave += 1;
  if (outcome === "loss") {
    encounterWave = 1;
    persistedHeroHp = HERO_COMBAT_STATS.hp;
  }

  clearCardUiBindings(hand);
  hand = [];
  drawPile = [];
  discardPile = [];
  combatEnergy = 0;
  combatTurn = 0;
  combatHero = null;
  combatEnemies = [];
  selectedEnemyId = null;
  phase = PHASE_DECK_BUILDING;
  selectEncounter(encounterWave);

  const grantRewards = outcome !== "loss" && outcome !== "retreat";
  const newCards = grantRewards
    ? Array.from(
      { length: gameSettings.rewardCardCount },
      (_, index) => {
        const card = createRandomCard(loadedAssets, deck.length + index, gameSettings, nextCardId);
        nextCardId += 1;
        return card;
      },
    )
    : [];
  deck.push(...newCards);

  const newGems = grantRewards
    ? createRandomGems(
      loadedAssets.runeStones,
      loadedAssets.radiantRunes,
      loadedAssets.mods,
      gameSettings.rewardStoneCount,
      gameSettings,
      nextGemId,
    )
    : [];
  nextGemId += newGems.length;
  sideGems.push(...newGems);

  const preferredCardId = newCards.at(-1)?.id || selectedCardId;
  resetFighterTrackers();
  renderCardBrowser(preferredCardId);
  renderSideRuneStones();
  closeSettings();
  updatePhaseChrome();
  redrawCombat();

  if (outcome === "loss" || outcome === "retreat") {
    setStatus(outcome === "retreat"
      ? "Retreated. No rewards. Next fight stays at this wave."
      : "Defeat. Wave reset. Socket stones and try again.");
    return;
  }

  const cardLabel = `${newCards.length} card${newCards.length === 1 ? "" : "s"}`;
  const stoneLabel = `${newGems.length} stone${newGems.length === 1 ? "" : "s"}`;
  const prefix = outcome === "win" ? `Wave ${encounterWave - 1} cleared. ` : "Combat ended. ";
  setStatus(`${prefix}Gained ${cardLabel} and ${stoneLabel}. Next fight is wave ${encounterWave}.`);
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
  combatHero = null;
  combatEnemies = [];
  currentEncounter = [];
  selectedEnemyId = null;
  encounterWave = 1;
  persistedHeroHp = HERO_COMBAT_STATS.hp;

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
  selectEncounter(encounterWave);
  resetFighterTrackers();

  renderCardBrowser();
  renderSideRuneStones();
  redrawCombat();
  closeSettings();
  updatePhaseChrome();
  setStatus(
    isRealGame()
      ? "Real game: socket matching stones, then start combat. Mods will deal damage, apply statuses, and fight back."
      : "Sandbox: socket matching rune stones into your cards, then start combat.",
  );
}

function setGameMode(nextMode) {
  if (nextMode !== GAME_MODE_SANDBOX && nextMode !== GAME_MODE_REAL) return;
  if (gameMode === nextMode) return;
  if (isCombat()) {
    setStatus("Finish combat before switching modes.");
    return;
  }

  gameMode = nextMode;
  updatePhaseChrome();
  redrawCombat();
  setStatus(
    isRealGame()
      ? "Real game ready. Socket stones, then start combat to resolve mods and enemy attacks."
      : "Sandbox ready. Combat is a tracker — play cards without automatic resolution.",
  );
}
