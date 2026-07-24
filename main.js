"use strict";

const gameBoard = document.querySelector("#game-board");
const newGameButton = document.querySelector("#new-game-in-game");
const startCombatButton = document.querySelector("#start-combat");
const endTurnButton = document.querySelector("#end-turn");
const endCombatButton = document.querySelector("#end-combat");
const settingsInGameButton = document.querySelector("#settings-in-game");
const settingsCloseButton = document.querySelector("#settings-close");
const settingsPanel = document.querySelector("#settings-panel");
const resetSettingsButton = document.querySelector("#reset-settings");
const settingsNote = document.querySelector("#settings-note");
const startCardCountInput = document.querySelector("#start-card-count");
const startStoneCountInput = document.querySelector("#start-stone-count");
const combatHandSizeInput = document.querySelector("#combat-hand-size");
const energyPerTurnInput = document.querySelector("#energy-per-turn");
const rewardCardCountInput = document.querySelector("#reward-card-count");
const rewardStoneCountInput = document.querySelector("#reward-stone-count");
const socketCountWeights = document.querySelector("#socket-count-weights");
const socketRuneWeights = document.querySelector("#socket-rune-weights");
const stoneTypeWeights = document.querySelector("#stone-type-weights");
const stoneRuneWeights = document.querySelector("#stone-rune-weights");
const energyColorWeights = document.querySelector("#energy-color-weights");
const phaseEyebrow = document.querySelector("#phase-eyebrow");
const phaseTitle = document.querySelector("#phase-title");
const gameStatus = document.querySelector("#game-status");
const cardBrowserLabel = document.querySelector("#card-browser-label");
const cardList = document.querySelector("#cards");
const deckCount = document.querySelector("#deck-count");
const activeCardCanvas = document.querySelector("#active-card");
const activeCardContext = activeCardCanvas.getContext("2d");
const activeCardName = document.querySelector("#active-card-name");
const activeCardDetails = document.querySelector("#active-card-details");
const cardModsList = document.querySelector("#card-mods");
const cardModCount = document.querySelector("#card-mod-count");
const runeStoneList = document.querySelector("#rune-stones");
const stoneCount = document.querySelector("#stone-count");
const combatCanvas = document.querySelector("#combat-canvas");
const combatContext = combatCanvas.getContext("2d");
const combatDropZone = document.querySelector("#combat-drop-zone");
const combatEnergyList = document.querySelector("#combat-energy");
const combatTurnLabel = document.querySelector("#combat-turn-label");
const heroNameLabel = document.querySelector("#hero-name");
const enemyNameLabel = document.querySelector("#enemy-name");
const heroHpInput = document.querySelector("#hero-hp");
const enemyHpInput = document.querySelector("#enemy-hp");
const heroNotesInput = document.querySelector("#hero-notes");
const enemyNotesInput = document.querySelector("#enemy-notes");

let loadedAssets = null;
let gameSettings = structuredClone(DEFAULT_GAME_SETTINGS);
let phase = PHASE_DECK_BUILDING;
let deck = [];
let drawPile = [];
let discardPile = [];
let hand = [];
let sideGems = [];
let combatEnergy = emptyEnergyCounts();
let currentEnemy = null;
let combatTurn = 0;
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

function setSettingsOpen(isOpen) {
  settingsPanel.hidden = !isOpen;
  settingsInGameButton.setAttribute("aria-expanded", String(isOpen));
}

function closeSettings() {
  setSettingsOpen(false);
}

function openSettings() {
  setSettingsOpen(true);
}

function createWeightControls(container, entries, settingsKey) {
  const fragment = document.createDocumentFragment();

  for (const entry of entries) {
    const label = document.createElement("label");
    const name = document.createElement("span");
    const valueWrap = document.createElement("span");
    const probability = document.createElement("output");
    const numberInput = document.createElement("input");
    const rangeInput = document.createElement("input");
    const initialValue = gameSettings[settingsKey][entry.key];
    const accessibleName = entry.label || entry.key;

    label.className = "weight-setting";
    if (entry.icon) label.classList.add("weight-setting--icon");
    name.className = "weight-setting-name";
    valueWrap.className = "weight-setting-value";

    if (entry.icon) {
      const icon = document.createElement("img");
      icon.className = "weight-setting-icon";
      icon.src = entry.icon;
      icon.alt = "";
      icon.decoding = "async";
      icon.draggable = false;
      name.append(icon);
      if (entry.showLabel !== false && entry.label) {
        const text = document.createElement("span");
        text.className = "weight-setting-text";
        text.textContent = entry.label;
        name.append(text);
      } else {
        name.title = accessibleName;
      }
    } else {
      name.textContent = entry.label;
    }

    probability.value = "0%";

    numberInput.type = "number";
    numberInput.min = "0";
    numberInput.max = "100";
    numberInput.step = "0.1";
    numberInput.value = initialValue;
    numberInput.dataset.weightKey = entry.key;
    numberInput.dataset.weightRole = "number";
    numberInput.setAttribute("aria-label", `${accessibleName} weight`);

    rangeInput.type = "range";
    rangeInput.min = "0";
    rangeInput.max = "100";
    rangeInput.step = "0.1";
    rangeInput.value = initialValue;
    rangeInput.dataset.weightKey = entry.key;
    rangeInput.dataset.weightRole = "range";
    rangeInput.setAttribute("aria-label", `${accessibleName} weight slider`);

    valueWrap.append(probability, numberInput);
    label.append(name, valueWrap, rangeInput);
    fragment.append(label);
  }

  container.replaceChildren(fragment);
}

function readBoundedInteger(input, fallback) {
  const value = Number.parseInt(input.value, 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Number(input.max), Math.max(Number(input.min), value));
}

function readWeightControls(container) {
  return Object.fromEntries(
    Array.from(container.querySelectorAll('input[data-weight-role="number"]'), (input) => [
      input.dataset.weightKey,
      Math.min(Number(input.max), Math.max(0, Number(input.value) || 0)),
    ]),
  );
}

function updateWeightPercentages(container) {
  const rows = Array.from(container.querySelectorAll(".weight-setting"));
  const weights = rows.map((row) => {
    const numberInput = row.querySelector('input[data-weight-role="number"]');
    return Math.max(0, Number(numberInput.value) || 0);
  });
  const configuredTotal = weights.reduce((total, weight) => total + weight, 0);
  const total = configuredTotal > 0 ? configuredTotal : rows.length;

  rows.forEach((row, index) => {
    const effectiveWeight = configuredTotal > 0 ? weights[index] : 1;
    const percent = (effectiveWeight / total) * 100;
    const numberInput = row.querySelector('input[data-weight-role="number"]');
    const rangeInput = row.querySelector('input[data-weight-role="range"]');
    const value = Number(numberInput.value) || 0;

    row.querySelector("output").value = `${percent.toFixed(1)}%`;
    row.style.setProperty("--weight-pct", `${Math.min(100, Math.max(0, value))}%`);

    if (rangeInput && rangeInput !== document.activeElement) {
      rangeInput.value = String(value);
    }
  });
}

function syncLinkedWeightInputs(sourceInput) {
  if (!sourceInput?.dataset?.weightKey) return;
  const row = sourceInput.closest(".weight-setting");
  if (!row) return;

  const value = Math.min(
    Number(sourceInput.max),
    Math.max(0, Number(sourceInput.value) || 0),
  );
  const numberInput = row.querySelector('input[data-weight-role="number"]');
  const rangeInput = row.querySelector('input[data-weight-role="range"]');

  if (numberInput && numberInput !== sourceInput) numberInput.value = String(value);
  if (rangeInput && rangeInput !== sourceInput) rangeInput.value = String(value);
  sourceInput.value = String(value);
}

function syncSettingsFromControls(announce = true) {
  gameSettings = {
    startCardCount: readBoundedInteger(startCardCountInput, DEFAULT_GAME_SETTINGS.startCardCount),
    startStoneCount: readBoundedInteger(startStoneCountInput, DEFAULT_GAME_SETTINGS.startStoneCount),
    combatHandSize: readBoundedInteger(combatHandSizeInput, DEFAULT_GAME_SETTINGS.combatHandSize),
    energyPerTurn: readBoundedInteger(energyPerTurnInput, DEFAULT_GAME_SETTINGS.energyPerTurn),
    rewardCardCount: readBoundedInteger(rewardCardCountInput, DEFAULT_GAME_SETTINGS.rewardCardCount),
    rewardStoneCount: readBoundedInteger(rewardStoneCountInput, DEFAULT_GAME_SETTINGS.rewardStoneCount),
    socketCountWeights: readWeightControls(socketCountWeights),
    socketRuneWeights: readWeightControls(socketRuneWeights),
    stoneTypeWeights: readWeightControls(stoneTypeWeights),
    stoneRuneWeights: readWeightControls(stoneRuneWeights),
    energyColorWeights: readWeightControls(energyColorWeights),
  };

  updateWeightPercentages(socketCountWeights);
  updateWeightPercentages(socketRuneWeights);
  updateWeightPercentages(stoneTypeWeights);
  updateWeightPercentages(stoneRuneWeights);
  updateWeightPercentages(energyColorWeights);

  if (announce) {
    settingsNote.textContent = "Saved · applies on next New game, Start combat, or End combat";
  }
}

function writeSettingsToControls() {
  startCardCountInput.value = gameSettings.startCardCount;
  startStoneCountInput.value = gameSettings.startStoneCount;
  combatHandSizeInput.value = gameSettings.combatHandSize;
  energyPerTurnInput.value = gameSettings.energyPerTurn;
  rewardCardCountInput.value = gameSettings.rewardCardCount;
  rewardStoneCountInput.value = gameSettings.rewardStoneCount;

  for (const [container, settingsKey] of [
    [socketCountWeights, "socketCountWeights"],
    [socketRuneWeights, "socketRuneWeights"],
    [stoneTypeWeights, "stoneTypeWeights"],
    [stoneRuneWeights, "stoneRuneWeights"],
    [energyColorWeights, "energyColorWeights"],
  ]) {
    for (const row of container.querySelectorAll(".weight-setting")) {
      const key = row.querySelector("input").dataset.weightKey;
      const value = gameSettings[settingsKey][key];
      for (const input of row.querySelectorAll("input")) {
        input.value = value;
      }
    }
  }

  syncSettingsFromControls(false);
  settingsNote.textContent = "Auto-saves as you edit";
}

function nudgeStepper(inputId, delta) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const next = readBoundedInteger(input, Number(input.value) || 0) + delta;
  input.value = String(Math.min(Number(input.max), Math.max(Number(input.min), next)));
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function initializeSettings() {
  createWeightControls(
    socketCountWeights,
    SOCKET_COUNT_OPTIONS.map((count) => ({
      key: String(count),
      label: `${count} socket${count === 1 ? "" : "s"}`,
    })),
    "socketCountWeights",
  );
  createWeightControls(
    socketRuneWeights,
    SOCKET_RUNE_ASSETS.map((rune, index) => ({
      key: rune.name,
      label: `Rune ${rune.name}`,
      icon: RADIANT_RUNE_ASSETS[index]?.source || rune.source,
      showLabel: false,
    })),
    "socketRuneWeights",
  );
  createWeightControls(
    stoneTypeWeights,
    RUNE_STONE_ASSETS.map((stone) => ({
      key: stone.name,
      label: stone.name[0].toUpperCase() + stone.name.slice(1),
      icon: stone.source,
      showLabel: true,
    })),
    "stoneTypeWeights",
  );
  createWeightControls(
    stoneRuneWeights,
    RADIANT_RUNE_ASSETS.map((rune) => ({
      key: rune.name,
      label: `Rune ${rune.name}`,
      icon: rune.source,
      showLabel: false,
    })),
    "stoneRuneWeights",
  );
  createWeightControls(
    energyColorWeights,
    RUNE_STONE_ASSETS.map((stone) => ({
      key: stone.name,
      label: stone.name[0].toUpperCase() + stone.name.slice(1),
      icon: stone.source,
      showLabel: true,
    })),
    "energyColorWeights",
  );
  writeSettingsToControls();
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
    deckCount.textContent = `Hand ${hand.length} · Energy ${totalEnergy(combatEnergy)} · Draw ${drawPile.length} · Discard ${discardPile.length}`;
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

function clearCombatDropHover() {
  combatDropHover = false;
  combatDropZone.classList.remove("is-drop-hover", "is-drop-valid", "is-drop-invalid");
}

function setCombatDropHover(isHovering, isValid = false) {
  combatDropHover = isHovering;
  combatDropZone.classList.toggle("is-drop-hover", isHovering);
  combatDropZone.classList.toggle("is-drop-valid", isHovering && isValid);
  combatDropZone.classList.toggle("is-drop-invalid", isHovering && !isValid);
}

function isPointInCombatDropZone(clientX, clientY) {
  const bounds = combatDropZone.getBoundingClientRect();
  return clientX >= bounds.left
    && clientX <= bounds.right
    && clientY >= bounds.top
    && clientY <= bounds.bottom;
}

function stoneImageForColor(color) {
  return loadedAssets?.runeStones?.find((stone) => stone.name === color) || null;
}

function renderCombatEnergy() {
  const showEnergy = isCombat();
  combatEnergyList.hidden = !showEnergy;

  if (!showEnergy || !loadedAssets) {
    combatEnergyList.replaceChildren();
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const color of ENERGY_COLORS) {
    const count = combatEnergy[color] || 0;
    const stone = stoneImageForColor(color);
    const token = document.createElement("div");
    const canvas = document.createElement("canvas");
    const label = document.createElement("span");

    token.className = "energy-token";
    token.dataset.color = color;
    token.setAttribute("aria-label", `${count} ${color} energy`);
    token.title = `${count} ${color}`;

    canvas.width = 128;
    canvas.height = 128;
    canvas.setAttribute("aria-hidden", "true");

    if (stone?.image) {
      const context = canvas.getContext("2d");
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(stone.image, 0, 0, canvas.width, canvas.height);
    }

    label.className = "energy-token-count";
    label.textContent = String(count);

    token.append(canvas, label);
    fragment.append(token);
  }

  combatEnergyList.replaceChildren(fragment);
}

function clearDropFeedback() {
  dropTarget = null;
  activeCardCanvas.classList.remove("drop-valid", "drop-invalid");
  redrawActiveCard();
}

function moveDragPreview(clientX, clientY) {
  if (!dragPreview) return;
  dragPreview.style.left = `${clientX}px`;
  dragPreview.style.top = `${clientY}px`;
}

function resetPointerDrag() {
  if (draggingToken && draggingPointerId !== null) {
    try {
      if (draggingToken.hasPointerCapture(draggingPointerId)) {
        draggingToken.releasePointerCapture(draggingPointerId);
      }
    } catch {
      // The token may already have been removed after a successful placement.
    }
  }

  draggingToken?.classList.remove("is-dragging");
  activeCardCanvas.classList.remove("is-dragging");
  dragPreview?.remove();
  document.body.classList.remove("is-dragging-stone", "is-dragging-card");
  gameBoard.classList.remove("is-dragging-card");
  clearCombatDropHover();
  draggingGemId = null;
  draggingCardId = null;
  draggingCardSource = null;
  draggingPointerId = null;
  draggingToken = null;
  dragPreview = null;
}

function socketIndexFromClientPoint(card, clientX, clientY) {
  const bounds = activeCardCanvas.getBoundingClientRect();
  const isInside = clientX >= bounds.left
    && clientX <= bounds.right
    && clientY >= bounds.top
    && clientY <= bounds.bottom;

  if (!isInside) return -1;
  return socketIndexAt(
    card,
    cardPointFromClientPoint(clientX, clientY, activeCardCanvas),
  );
}

function setDropTarget(card, socketIndex, isValid) {
  const nextDropTarget = socketIndex < 0 ? null : { cardId: card.id, socketIndex, isValid };
  const unchanged = (!dropTarget && !nextDropTarget)
    || (dropTarget
      && nextDropTarget
      && dropTarget.cardId === nextDropTarget.cardId
      && dropTarget.socketIndex === nextDropTarget.socketIndex
      && dropTarget.isValid === nextDropTarget.isValid);

  if (unchanged) return;

  dropTarget = nextDropTarget;
  activeCardCanvas.classList.toggle("drop-valid", Boolean(dropTarget?.isValid));
  activeCardCanvas.classList.toggle("drop-invalid", Boolean(dropTarget && !dropTarget.isValid));
  redrawActiveCard();
}

function updatePointerDropFeedback(clientX, clientY) {
  const gem = sideGems.find((candidate) => candidate.id === draggingGemId);
  const card = selectedCard();
  if (!gem || !card) return;

  const socketIndex = socketIndexFromClientPoint(card, clientX, clientY);

  if (socketIndex < 0) {
    setDropTarget(card, -1, false);
    return;
  }

  const socket = card.sockets[socketIndex];
  const isValid = !socket.gem && socket.rune.name === gem.rune.name;

  setDropTarget(card, socketIndex, isValid);
}

function placeGemOnCard(gem, card, socketIndex) {
  if (!isDeckBuilding()) {
    clearDropFeedback();
    return false;
  }

  const socket = card.sockets[socketIndex];

  if (socket.gem) {
    clearDropFeedback();
    return false;
  }

  if (socket.rune.name !== gem.rune.name) {
    clearDropFeedback();
    return false;
  }

  socket.gem = gem;
  sideGems = sideGems.filter((candidate) => candidate.id !== gem.id);
  renderSideRuneStones();
  clearDropFeedback();
  drawDeckThumbnail(card, loadedAssets);
  updateActiveCardDetails(card);
  updatePhaseChrome();
  return true;
}

function handleGemPointerDown(event, gem) {
  if (!isDeckBuilding()) return;
  if (event.isPrimary === false || (event.pointerType === "mouse" && event.button !== 0)) return;
  if (draggingGemId || draggingCardId) return;

  event.preventDefault();
  draggingGemId = gem.id;
  draggingPointerId = event.pointerId;
  draggingToken = event.currentTarget;
  event.currentTarget.classList.add("is-dragging");
  event.currentTarget.setPointerCapture(event.pointerId);

  dragPreview = document.createElement("canvas");
  dragPreview.width = 128;
  dragPreview.height = 128;
  dragPreview.className = "rune-drag-preview";
  drawGem(dragPreview.getContext("2d"), gem, dragPreview.width);
  document.body.append(dragPreview);
  document.body.classList.add("is-dragging-stone");
  moveDragPreview(event.clientX, event.clientY);
}

function handleGemPointerMove(event) {
  if (event.pointerId !== draggingPointerId || !draggingGemId) return;

  event.preventDefault();
  moveDragPreview(event.clientX, event.clientY);
  updatePointerDropFeedback(event.clientX, event.clientY);
}

function handleGemPointerUp(event) {
  if (event.pointerId !== draggingPointerId || !draggingGemId) return;

  event.preventDefault();
  const gem = sideGems.find((candidate) => candidate.id === draggingGemId);
  const card = selectedCard();
  const socketIndex = card
    ? socketIndexFromClientPoint(card, event.clientX, event.clientY)
    : -1;

  resetPointerDrag();

  if (!gem || !card || socketIndex < 0) {
    clearDropFeedback();
    return;
  }

  placeGemOnCard(gem, card, socketIndex);
}

function handleGemPointerCancel(event) {
  if (event.pointerId !== draggingPointerId || !draggingGemId) return;
  resetPointerDrag();
  clearDropFeedback();
}

function createCardDragPreview(card) {
  const preview = document.createElement("canvas");
  preview.width = DECK_THUMBNAIL_WIDTH;
  preview.height = DECK_THUMBNAIL_HEIGHT;
  preview.className = "card-drag-preview";
  drawCardSurface(card, preview, preview.getContext("2d"), loadedAssets);
  return preview;
}

function handleCardPointerDown(event, card, source) {
  if (!isCombat()) return;
  if (event.isPrimary === false || (event.pointerType === "mouse" && event.button !== 0)) return;
  if (draggingGemId || draggingCardId) return;

  event.preventDefault();
  selectCard(card.id, false);

  draggingCardId = card.id;
  draggingCardSource = source;
  draggingPointerId = event.pointerId;
  draggingToken = event.currentTarget;
  event.currentTarget.classList.add("is-dragging");
  event.currentTarget.setPointerCapture(event.pointerId);

  dragPreview = createCardDragPreview(card);
  document.body.append(dragPreview);
  document.body.classList.add("is-dragging-card");
  gameBoard.classList.add("is-dragging-card");
  moveDragPreview(event.clientX, event.clientY);
  updateCardPlayDropFeedback(event.clientX, event.clientY);
}

function updateCardPlayDropFeedback(clientX, clientY) {
  if (!draggingCardId) return;

  const card = hand.find((candidate) => candidate.id === draggingCardId);
  if (!card || !isPointInCombatDropZone(clientX, clientY)) {
    clearCombatDropHover();
    return;
  }

  const cost = cardEnergyCost(card);
  setCombatDropHover(true, canPayEnergyCost(combatEnergy, cost));
}

function handleCardPointerMove(event) {
  if (event.pointerId !== draggingPointerId || !draggingCardId) return;

  event.preventDefault();
  moveDragPreview(event.clientX, event.clientY);
  updateCardPlayDropFeedback(event.clientX, event.clientY);
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

  renderCombatEnergy();
  renderCardBrowser(selectedCardId === card.id ? hand[0]?.id : selectedCardId);
  updatePhaseChrome();
  setStatus(`Played card for ${formatEnergyCost(cost)}.`);
  return true;
}

function handleCardPointerUp(event) {
  if (event.pointerId !== draggingPointerId || !draggingCardId) return;

  event.preventDefault();
  const cardId = draggingCardId;
  const overCombat = isPointInCombatDropZone(event.clientX, event.clientY);
  resetPointerDrag();

  const card = hand.find((candidate) => candidate.id === cardId);
  if (!card || !overCombat) return;

  playCardFromHand(card);
}

function handleCardPointerCancel(event) {
  if (event.pointerId !== draggingPointerId || !draggingCardId) return;
  resetPointerDrag();
}

function handleActiveCardPointerDown(event) {
  if (!isCombat()) return;
  const card = selectedCard();
  if (!card) return;
  handleCardPointerDown(event, card, "preview");
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
      `${gem.stone.name} rune stone with rune ${gem.rune.name}; ${gem.mod}; drag to matching socket`,
    );

    token.width = 128;
    token.height = 128;
    token.className = "rune-token";
    token.draggable = false;
    token.setAttribute("aria-hidden", "true");

    modLabel.className = "rune-mod";
    modLabel.textContent = gem.mod;
    modLabel.title = gem.mod;

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

function renderCardMods(card = selectedCard()) {
  const mods = card ? socketedMods(card) : [];
  const fragment = document.createDocumentFragment();

  for (const mod of mods) {
    const item = document.createElement("li");
    item.className = "card-mod-item";
    item.textContent = mod;
    item.title = mod;
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
  combatEnergy = createTurnEnergy(gameSettings.energyPerTurn, gameSettings);

  const drawn = drawCards(gameSettings.combatHandSize);
  hand = drawn;
  renderCardBrowser(hand[0]?.id);
  updatePhaseChrome();
  setStatus(
    drawn.length > 0
      ? `Turn ${combatTurn}: drew ${drawn.length}, gained ${totalEnergy(combatEnergy)} energy. Drag a card onto combat to play it.`
      : `Turn ${combatTurn}: no cards left to draw. Gained ${totalEnergy(combatEnergy)} energy.`,
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
  combatEnergy = emptyEnergyCounts();
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
  combatEnergy = emptyEnergyCounts();
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
  combatEnergy = emptyEnergyCounts();
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

initializeSettings();

activeCardCanvas.addEventListener("pointerdown", handleActiveCardPointerDown);
activeCardCanvas.addEventListener("pointermove", handleCardPointerMove);
activeCardCanvas.addEventListener("pointerup", handleCardPointerUp);
activeCardCanvas.addEventListener("pointercancel", handleCardPointerCancel);

newGameButton.addEventListener("click", startNewGame);
startCombatButton.addEventListener("click", startCombat);
endTurnButton.addEventListener("click", endTurn);
endCombatButton.addEventListener("click", endCombat);
settingsInGameButton.addEventListener("click", openSettings);
settingsCloseButton.addEventListener("click", closeSettings);
settingsPanel.addEventListener("click", (event) => {
  const stepper = event.target.closest(".stepper-btn");
  if (!stepper || !settingsPanel.contains(stepper)) return;
  event.preventDefault();
  nudgeStepper(stepper.dataset.stepperFor, Number(stepper.dataset.delta));
});
settingsPanel.addEventListener("input", (event) => {
  if (!event.target.matches("input")) return;
  if (event.target.dataset.weightKey) syncLinkedWeightInputs(event.target);
  syncSettingsFromControls();
});
settingsPanel.addEventListener("change", (event) => {
  if (!event.target.matches("input")) return;
  if (event.target.dataset.weightKey) syncLinkedWeightInputs(event.target);
  syncSettingsFromControls(false);
  writeSettingsToControls();
  settingsNote.textContent = "Saved · applies on next New game, Start combat, or End combat";
});
resetSettingsButton.addEventListener("click", () => {
  gameSettings = structuredClone(DEFAULT_GAME_SETTINGS);
  writeSettingsToControls();
  settingsNote.textContent = "Defaults restored";
});

async function initializeGame() {
  setStatus("");
  loadedAssets = await getLoadedAssets();
  startNewGame();
}

initializeGame()
  .catch((error) => {
    newGameButton.disabled = true;
    startCombatButton.disabled = true;
    endTurnButton.disabled = true;
    endCombatButton.disabled = true;
    setStatus(error.message);
    console.error(error);
  });
