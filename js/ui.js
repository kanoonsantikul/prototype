"use strict";

function updatePhaseChrome() {
  const deckBuilding = isDeckBuilding();

  gameBoard.dataset.phase = phase;
  gameBoard.classList.toggle("phase-deck-building", deckBuilding);
  gameBoard.classList.toggle("phase-combat", !deckBuilding);

  phaseEyebrow.textContent = deckBuilding ? "Phase 1" : "Phase 2";
  phaseTitle.textContent = deckBuilding ? "Deck building" : "Combat";
  cardBrowserLabel.textContent = deckBuilding ? "Your deck" : "Your hand";
  cardList.setAttribute("aria-label", deckBuilding ? "Cards in your deck" : "Cards in your hand");

  startCombatButton.hidden = !deckBuilding;
  startCombatButton.disabled = !deckBuilding || deck.length === 0;
  endTurnButton.hidden = deckBuilding;
  endTurnButton.disabled = deckBuilding || deck.length === 0;
  endCombatButton.hidden = deckBuilding;
  endCombatButton.disabled = deckBuilding || deck.length === 0;
  combatTurnLabel.hidden = deckBuilding;
  combatTurnLabel.textContent = deckBuilding ? "Turn 0" : `Turn ${combatTurn}`;

  if (deckBuilding) {
    deckCount.textContent = `${deck.length} cards · ${sideGems.length} stones`;
  } else {
    deckCount.textContent = `Hand ${hand.length} · Energy ${combatEnergy} · Draw ${drawPile.length} · Discard ${discardPile.length}`;
  }

  renderCombatEnergy();
}

function redrawActiveCard() {
  const card = selectedCard();
  if (!card) {
    activeCardContext.setTransform(1, 0, 0, 1, 0, 0);
    activeCardContext.clearRect(0, 0, activeCardCanvas.width, activeCardCanvas.height);
    return;
  }
  drawActiveCard(card, activeCardCanvas, activeCardContext, loadedAssets, dropTarget);
}

function selectRandomEnemy() {
  if (!loadedAssets?.enemies?.length) {
    currentEnemy = null;
    return null;
  }

  currentEnemy = randomItem(loadedAssets.enemies);
  return currentEnemy;
}

function resetFighterTrackers() {
  heroNameLabel.textContent = HERO_NAME;
  enemyNameLabel.textContent = currentEnemy?.label || "Enemy";
  heroHpInput.value = DEFAULT_FIGHTER_STATS.heroHp;
  enemyHpInput.value = DEFAULT_FIGHTER_STATS.enemyHp;
  heroNotesInput.value = DEFAULT_FIGHTER_STATS.heroNotes;
  enemyNotesInput.value = DEFAULT_FIGHTER_STATS.enemyNotes;
}

function updateFighterLabels() {
  heroNameLabel.textContent = HERO_NAME;
  enemyNameLabel.textContent = currentEnemy?.label || "Enemy";
}

function redrawCombat() {
  updateFighterLabels();
  drawCombat(combatCanvas, combatContext, loadedAssets, currentEnemy);
}

function renderCombatEnergy() {
  const showEnergy = isCombat();
  combatEnergyList.hidden = !showEnergy;

  if (!showEnergy) {
    combatEnergyList.replaceChildren();
    return;
  }

  const token = document.createElement("div");
  const label = document.createElement("span");

  token.className = "energy-token energy-token--pool";
  token.setAttribute("aria-label", `${combatEnergy} energy`);
  token.title = `${combatEnergy} energy`;

  label.className = "energy-token-count";
  label.textContent = String(combatEnergy);

  token.append(label);
  combatEnergyList.replaceChildren(token);
}

function renderCardMods(card = selectedCard()) {
  const mods = card ? socketedMods(card) : [];
  const fragment = document.createDocumentFragment();

  for (const mod of mods) {
    const item = document.createElement("li");
    item.className = "card-mod-item";
    item.textContent = formatModLabel(mod.text, mod.cost);
    item.title = formatModLabel(mod.text, mod.cost);
    fragment.append(item);
  }

  cardModsList.replaceChildren(fragment);
  cardModCount.textContent = String(mods.length);
  cardModsList.classList.toggle("is-empty", mods.length === 0);
}

function cardMetaText(card) {
  if (!card) return "";
  if (!isCombat()) return cardProgress(card);

  const cost = cardEnergyCost(card);
  const affordable = canPayEnergyCost(combatEnergy, cost);
  return `${formatEnergyCost(cost)}${affordable ? "" : " · lacking"}`;
}

function updateActiveCardDetails(card = selectedCard()) {
  activeCardDetails.textContent = cardMetaText(card);
  if (card?.deckMeta) card.deckMeta.textContent = cardMetaText(card);
  renderCardMods(card);
}

function selectCard(cardId, announce = true) {
  const cards = visibleCards();
  const card = cards.find((candidate) => candidate.id === cardId);
  if (!card) return;

  selectedCardId = card.id;
  dropTarget = null;
  activeCardCanvas.classList.remove("drop-valid", "drop-invalid");

  for (const candidate of cards) {
    candidate.deckButton?.setAttribute("aria-pressed", String(candidate.id === card.id));
  }

  activeCardName.textContent = "";
  updateActiveCardDetails(card);
  redrawActiveCard();

  if (announce) {
    setStatus("");
  }
}


function renderSideRuneStones() {
  const fragment = document.createDocumentFragment();

  for (const gem of sideGems) {
    const row = document.createElement("div");
    const token = document.createElement("canvas");
    const tokenContext = token.getContext("2d");
    const modLabel = document.createElement("span");

    row.className = "rune-stone-item";
    row.dataset.gemId = gem.id;
    row.dataset.runeType = gem.rune.name;
    row.setAttribute("role", "listitem");
    row.setAttribute(
      "aria-label",
      `${gem.stone.name} rune stone with rune ${gem.rune.name}; ${formatModLabel(gem.mod, gemEnergyCost(gem))}; drag to matching socket`,
    );

    token.width = 128;
    token.height = 128;
    token.className = "rune-token";
    token.draggable = false;
    token.setAttribute("aria-hidden", "true");

    modLabel.className = "rune-mod";
    modLabel.textContent = formatModLabel(gem.mod, gemEnergyCost(gem));
    modLabel.title = formatModLabel(gem.mod, gemEnergyCost(gem));

    drawGem(tokenContext, gem, token.width);
    row.addEventListener("pointerdown", (event) => handleGemPointerDown(event, gem));
    row.addEventListener("pointermove", handleGemPointerMove);
    row.addEventListener("pointerup", handleGemPointerUp);
    row.addEventListener("pointercancel", handleGemPointerCancel);

    row.append(token, modLabel);
    fragment.append(row);
  }

  runeStoneList.replaceChildren(fragment);
  stoneCount.textContent = String(sideGems.length);
}

function renderCardBrowser(preferredCardId = selectedCardId) {
  const cards = visibleCards();
  clearCardUiBindings(deck);
  const fragment = document.createDocumentFragment();

  cards.forEach((card) => {
    const button = document.createElement("button");
    const thumbnail = document.createElement("canvas");
    const name = document.createElement("span");
    const meta = document.createElement("span");

    button.type = "button";
    button.className = "deck-card";
    button.setAttribute("aria-pressed", "false");
    button.setAttribute(
      "aria-label",
      isCombat()
        ? `Play or select ${card.name}; cost ${formatEnergyCost(cardEnergyCost(card))}`
        : `Select ${card.name} with ${card.sockets.length} sockets`,
    );

    thumbnail.width = DECK_THUMBNAIL_WIDTH;
    thumbnail.height = DECK_THUMBNAIL_HEIGHT;
    thumbnail.className = "deck-thumbnail";
    thumbnail.setAttribute("aria-hidden", "true");

    name.className = "deck-card-name";
    name.textContent = "";
    meta.className = "deck-card-meta";
    meta.textContent = cardMetaText(card);

    card.deckButton = button;
    card.deckMeta = meta;
    card.thumbnailCanvas = thumbnail;
    card.thumbnailContext = thumbnail.getContext("2d");

    button.addEventListener("click", () => selectCard(card.id));
    if (isCombat()) {
      button.addEventListener("pointerdown", (event) => handleCardPointerDown(event, card, "hand"));
      button.addEventListener("pointermove", handleCardPointerMove);
      button.addEventListener("pointerup", handleCardPointerUp);
      button.addEventListener("pointercancel", handleCardPointerCancel);
    }
    button.append(thumbnail, meta);
    fragment.append(button);
  });

  cardList.replaceChildren(fragment);
  cards.forEach((card) => drawDeckThumbnail(card, loadedAssets));
  updatePhaseChrome();

  if (cards.length === 0) {
    selectedCardId = null;
    activeCardName.textContent = "";
    updateActiveCardDetails(null);
    redrawActiveCard();
    return;
  }

  const cardToSelect = cards.find((card) => card.id === preferredCardId) || cards[0];
  selectCard(cardToSelect.id, false);
}
