"use strict";

function updatePhaseChrome() {
  const deckBuilding = isDeckBuilding();
  const realGame = isRealGame();

  gameBoard.dataset.phase = phase;
  gameBoard.dataset.mode = gameMode;
  gameBoard.classList.toggle("phase-deck-building", deckBuilding);
  gameBoard.classList.toggle("phase-combat", !deckBuilding);
  gameBoard.classList.toggle("mode-real", realGame);
  gameBoard.classList.toggle("mode-sandbox", !realGame);

  phaseEyebrow.textContent = realGame
    ? (deckBuilding ? `Real game · wave ${encounterWave}` : `Live combat · wave ${encounterWave}`)
    : (deckBuilding ? "Phase 1" : "Phase 2");
  phaseTitle.textContent = deckBuilding ? "Deck building" : "Combat";
  cardBrowserLabel.textContent = deckBuilding ? "Your deck" : "Your hand";
  cardList.setAttribute("aria-label", deckBuilding ? "Cards in your deck" : "Cards in your hand");

  startCombatButton.hidden = !deckBuilding;
  startCombatButton.disabled = !deckBuilding || deck.length === 0;
  endTurnButton.hidden = deckBuilding;
  endTurnButton.disabled = deckBuilding || deck.length === 0;
  endCombatButton.hidden = deckBuilding;
  endCombatButton.disabled = deckBuilding || deck.length === 0;
  endCombatButton.textContent = realGame ? "Retreat" : "End combat";
  combatTurnLabel.hidden = deckBuilding;
  combatTurnLabel.textContent = deckBuilding ? "Turn 0" : `Turn ${combatTurn}`;

  if (deckBuilding) {
    deckCount.textContent = `${deck.length} cards · ${sideGems.length} stones`;
  } else {
    deckCount.textContent = `Hand ${hand.length} · Energy ${combatEnergy} · Draw ${drawPile.length} · Discard ${discardPile.length}`;
  }

  renderCombatEnergy();
  updateModeSwitch();
  if (!deckBuilding) updateFighterTrackers();
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

function selectEncounter(wave = encounterWave) {
  currentEncounter = generateEncounter(wave);
  currentEnemy = currentEncounter[0] || null;
  selectedEnemyId = null;
  return currentEncounter;
}

function renderStatusChips(list, fighter) {
  const labels = statusLabels(fighter);
  const fragment = document.createDocumentFragment();
  for (const label of labels) {
    const item = document.createElement("li");
    item.className = "fighter-status";
    item.textContent = label;
    fragment.append(item);
  }
  list.replaceChildren(fragment);
  list.hidden = labels.length === 0;
}

function visibleEncounter() {
  if (isRealGame() && isCombat() && combatEnemies.length) return combatEnemies;
  return currentEncounter;
}

function encounterPortraitSources() {
  if (isRealGame() && isCombat() && combatEnemies.length) {
    return combatEnemies
      .filter((fighter) => fighter.alive)
      .map((fighter) => ({
        id: fighter.id,
        label: fighter.name,
        image: fighter.asset?.image,
      }));
  }
  return visibleEncounter().map((enemy) => ({
    id: enemy.id || enemy.name,
    label: enemy.label,
    image: enemy.image,
  }));
}

function createEnemyTrackerCard(enemy, options = {}) {
  const { live = false, selected = false, sandbox = false } = options;
  const card = document.createElement("article");
  card.className = "fighter-card fighter-card--enemy";
  if (selected) card.classList.add("is-selected");
  if (!enemy.alive && live) card.classList.add("is-defeated");
  card.dataset.enemyId = enemy.id || "";

  const header = document.createElement("header");
  header.className = "fighter-card-header";
  const name = document.createElement("h3");
  name.textContent = enemy.name || enemy.label || "Enemy";
  const hpField = document.createElement("label");
  hpField.className = "fighter-hp-field";
  const hpCaption = document.createElement("span");
  hpCaption.textContent = "HP";
  const hpInput = document.createElement("input");
  hpInput.type = "text";
  hpInput.inputMode = "numeric";
  hpInput.autocomplete = "off";
  hpInput.spellcheck = false;
  hpInput.setAttribute("aria-label", `${name.textContent} HP`);
  hpInput.value = live
    ? `${Math.max(0, enemy.hp)}/${enemy.maxHp}`
    : `${enemy.hp || DEFAULT_FIGHTER_STATS.enemyHp}`;
  hpInput.readOnly = live;
  hpField.append(hpCaption, hpInput);
  header.append(name, hpField);

  const intent = document.createElement("p");
  intent.className = "fighter-intent";
  intent.textContent = live
    ? `Intent: ${enemyIntent(enemy)}`
    : (currentEncounter.length > 1 ? `Wave ${encounterWave} pack` : `Wave ${encounterWave}`);
  intent.hidden = sandbox;

  const statuses = document.createElement("ul");
  statuses.className = "fighter-status-list";
  if (live) renderStatusChips(statuses, enemy);
  else statuses.hidden = true;

  const notesField = document.createElement("label");
  notesField.className = "fighter-notes-field";
  const notesCaption = document.createElement("span");
  notesCaption.textContent = "Notes";
  const notes = document.createElement("textarea");
  notes.rows = 4;
  notes.placeholder = "Status effects, intents…";
  notes.setAttribute("aria-label", `${name.textContent} notes`);
  notesField.append(notesCaption, notes);
  notesField.hidden = !sandbox;

  card.append(header, intent, statuses, notesField);
  if (live && enemy.alive) {
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.addEventListener("click", () => {
      selectCombatEnemy(enemy.id);
      redrawCombat();
    });
  }
  return card;
}

function renderEnemyTrackers() {
  const live = isRealGame() && isCombat() && combatHero;
  const sandbox = !live;
  const enemies = live
    ? combatEnemies
    : visibleEncounter().map((enemy, index) => {
      const stats = scaledEnemyStats(enemy.name, encounterWave);
      return {
        id: enemy.id || `preview-${index}`,
        name: enemy.label,
        label: enemy.label,
        alive: true,
        hp: stats.hp,
        maxHp: stats.hp,
      };
    });
  const selectedId = live ? (primaryEnemy()?.id || "") : "";
  const signature = `${live ? "live" : "preview"}:${encounterWave}:${enemies.map((enemy) => `${enemy.id}:${enemy.hp}:${enemy.alive ? 1 : 0}`).join("|")}:${selectedId}`;
  if (!live && enemyTrackers.dataset.signature === signature) return;
  enemyTrackers.dataset.signature = signature;
  enemyTrackers.replaceChildren(
    ...enemies.map((enemy) => createEnemyTrackerCard(enemy, {
      live,
      sandbox,
      selected: live && enemy.id === selectedId,
    })),
  );
}

function resetSandboxFighterTrackers() {
  heroNameLabel.textContent = HERO_NAME;
  heroHpInput.value = String(persistedHeroHp ?? DEFAULT_FIGHTER_STATS.heroHp);
  heroNotesInput.value = DEFAULT_FIGHTER_STATS.heroNotes;
  heroIntentLabel.hidden = true;
  heroStatusList.hidden = true;
  renderEnemyTrackers();
}

function resetFighterTrackers() {
  if (isRealGame() && isCombat() && combatHero) {
    syncRealFighterTrackers();
    return;
  }
  resetSandboxFighterTrackers();
}

function syncRealFighterTrackers() {
  heroNameLabel.textContent = combatHero?.name || HERO_NAME;
  heroHpInput.value = combatHero ? `${combatHero.hp}/${combatHero.maxHp}` : "0";
  heroHpInput.readOnly = true;
  heroNotesInput.hidden = true;
  heroNotesInput.closest(".fighter-notes-field").hidden = true;
  heroIntentLabel.hidden = false;
  heroIntentLabel.textContent = combatHero?.alive ? "Your turn" : "Defeated";
  renderStatusChips(heroStatusList, combatHero);
  renderEnemyTrackers();
}

function updateFighterTrackers() {
  const liveRealCombat = isRealGame() && isCombat() && combatHero;
  heroHpInput.readOnly = liveRealCombat;
  heroNotesInput.closest(".fighter-notes-field").hidden = liveRealCombat;

  if (liveRealCombat) {
    syncRealFighterTrackers();
    return;
  }

  heroIntentLabel.hidden = true;
  heroStatusList.hidden = true;
  heroNameLabel.textContent = HERO_NAME;
  renderEnemyTrackers();
}

function redrawCombat() {
  updateFighterTrackers();
  drawCombat(combatCanvas, combatContext, loadedAssets, encounterPortraitSources());
}

function enemyIdAtClientPoint(clientX) {
  if (!isRealGame() || !isCombat() || !combatHero) return null;
  const living = livingEnemies();
  if (living.length <= 1) return living[0]?.id || null;

  const bounds = combatCanvas.getBoundingClientRect();
  const localX = ((clientX - bounds.left) / bounds.width) * COMBAT_WIDTH;
  const portraits = encounterPortraits(encounterPortraitSources());
  let closest = null;
  let closestDistance = Infinity;
  for (const portrait of portraits) {
    const distance = Math.abs(localX - portrait.centerX);
    if (distance < closestDistance) {
      closest = portrait;
      closestDistance = distance;
    }
  }
  if (!closest || closestDistance > 140) return null;
  return closest.enemy.id;
}

function handleCombatCanvasClick(event) {
  const enemyId = enemyIdAtClientPoint(event.clientX);
  if (!enemyId) return;
  selectCombatEnemy(enemyId);
  redrawCombat();
}

function updateModeSwitch() {
  const realGame = isRealGame();
  modeSandboxButton.setAttribute("aria-pressed", String(!realGame));
  modeRealButton.setAttribute("aria-pressed", String(realGame));
  modeSandboxButton.disabled = isCombat();
  modeRealButton.disabled = isCombat();
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
