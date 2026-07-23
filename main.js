"use strict";

const newGameButton = document.querySelector("#new-game-in-game");
const endTurnButton = document.querySelector("#end-turn");
const settingsInGameButton = document.querySelector("#settings-in-game");
const settingsCloseButton = document.querySelector("#settings-close");
const settingsPanel = document.querySelector("#settings-panel");
const resetSettingsButton = document.querySelector("#reset-settings");
const settingsNote = document.querySelector("#settings-note");
const startCardCountInput = document.querySelector("#start-card-count");
const turnCardCountInput = document.querySelector("#turn-card-count");
const startStoneCountInput = document.querySelector("#start-stone-count");
const turnStoneCountInput = document.querySelector("#turn-stone-count");
const socketCountWeights = document.querySelector("#socket-count-weights");
const socketRuneWeights = document.querySelector("#socket-rune-weights");
const stoneTypeWeights = document.querySelector("#stone-type-weights");
const stoneRuneWeights = document.querySelector("#stone-rune-weights");
const gameStatus = document.querySelector("#game-status");
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

let loadedAssets = null;
let gameSettings = structuredClone(DEFAULT_GAME_SETTINGS);
let deck = [];
let sideGems = [];
let selectedCardId = null;
let nextCardId = 1;
let nextGemId = 1;
let draggingGemId = null;
let draggingPointerId = null;
let draggingToken = null;
let dragPreview = null;
let dropTarget = null;

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
    turnCardCount: readBoundedInteger(turnCardCountInput, DEFAULT_GAME_SETTINGS.turnCardCount),
    startStoneCount: readBoundedInteger(startStoneCountInput, DEFAULT_GAME_SETTINGS.startStoneCount),
    turnStoneCount: readBoundedInteger(turnStoneCountInput, DEFAULT_GAME_SETTINGS.turnStoneCount),
    socketCountWeights: readWeightControls(socketCountWeights),
    socketRuneWeights: readWeightControls(socketRuneWeights),
    stoneTypeWeights: readWeightControls(stoneTypeWeights),
    stoneRuneWeights: readWeightControls(stoneRuneWeights),
  };

  updateWeightPercentages(socketCountWeights);
  updateWeightPercentages(socketRuneWeights);
  updateWeightPercentages(stoneTypeWeights);
  updateWeightPercentages(stoneRuneWeights);

  if (announce) {
    settingsNote.textContent = "Saved · applies on next New game / End turn";
  }
}

function writeSettingsToControls() {
  startCardCountInput.value = gameSettings.startCardCount;
  turnCardCountInput.value = gameSettings.turnCardCount;
  startStoneCountInput.value = gameSettings.startStoneCount;
  turnStoneCountInput.value = gameSettings.turnStoneCount;

  for (const [container, settingsKey] of [
    [socketCountWeights, "socketCountWeights"],
    [socketRuneWeights, "socketRuneWeights"],
    [stoneTypeWeights, "stoneTypeWeights"],
    [stoneRuneWeights, "stoneRuneWeights"],
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
  writeSettingsToControls();
}

function selectedCard() {
  return deck.find((card) => card.id === selectedCardId) || null;
}

function redrawActiveCard() {
  drawActiveCard(selectedCard(), activeCardCanvas, activeCardContext, loadedAssets, dropTarget);
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
  dragPreview?.remove();
  document.body.classList.remove("is-dragging-stone");
  draggingGemId = null;
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
  return true;
}

function handleGemPointerDown(event, gem) {
  if (event.isPrimary === false || (event.pointerType === "mouse" && event.button !== 0)) return;

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
  if (event.pointerId !== draggingPointerId) return;

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
  if (event.pointerId !== draggingPointerId) return;
  resetPointerDrag();
  clearDropFeedback();
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

function updateActiveCardDetails(card = selectedCard()) {
  activeCardDetails.textContent = card ? cardProgress(card) : "";
  if (card?.deckMeta) card.deckMeta.textContent = cardProgress(card);
  renderCardMods(card);
}

function selectCard(cardId, announce = true) {
  const card = deck.find((candidate) => candidate.id === cardId);
  if (!card) return;

  selectedCardId = card.id;
  dropTarget = null;
  activeCardCanvas.classList.remove("drop-valid", "drop-invalid");

  for (const candidate of deck) {
    candidate.deckButton?.setAttribute("aria-pressed", String(candidate.id === card.id));
  }

  activeCardName.textContent = "";
  updateActiveCardDetails(card);
  redrawActiveCard();

  if (announce) {
    setStatus("");
  }
}

function renderDeck(preferredCardId = selectedCardId) {
  const fragment = document.createDocumentFragment();

  deck.forEach((card) => {
    const button = document.createElement("button");
    const thumbnail = document.createElement("canvas");
    const name = document.createElement("span");
    const meta = document.createElement("span");

    button.type = "button";
    button.className = "deck-card";
    button.setAttribute("aria-pressed", "false");
    button.setAttribute("aria-label", `Select ${card.name} with ${card.sockets.length} sockets`);

    thumbnail.width = DECK_THUMBNAIL_WIDTH;
    thumbnail.height = DECK_THUMBNAIL_HEIGHT;
    thumbnail.className = "deck-thumbnail";
    thumbnail.setAttribute("aria-hidden", "true");

    name.className = "deck-card-name";
    name.textContent = "";
    meta.className = "deck-card-meta";
    meta.textContent = cardProgress(card);

    card.deckButton = button;
    card.deckMeta = meta;
    card.thumbnailCanvas = thumbnail;
    card.thumbnailContext = thumbnail.getContext("2d");

    button.addEventListener("click", () => selectCard(card.id));
    button.append(thumbnail, meta);
    fragment.append(button);
  });

  cardList.replaceChildren(fragment);
  deck.forEach((card) => drawDeckThumbnail(card, loadedAssets));
  deckCount.textContent = `${deck.length} cards`;
  const cardToSelect = deck.find((card) => card.id === preferredCardId) || deck[0];
  selectCard(cardToSelect?.id, false);
}

function startNewGame() {
  if (!loadedAssets) return;

  resetPointerDrag();
  dropTarget = null;
  selectedCardId = null;
  activeCardCanvas.classList.remove("drop-valid", "drop-invalid");
  nextCardId = 1;
  nextGemId = 1;
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

  renderDeck();
  renderSideRuneStones();
  closeSettings();
  endTurnButton.disabled = false;
  setStatus("");
}

function endTurn() {
  if (!loadedAssets || deck.length === 0) return;

  resetPointerDrag();
  dropTarget = null;
  activeCardCanvas.classList.remove("drop-valid", "drop-invalid");

  const firstNewCardIndex = deck.length;
  const newCards = Array.from(
    { length: gameSettings.turnCardCount },
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
    gameSettings.turnStoneCount,
    gameSettings,
    nextGemId,
  );
  nextGemId += newGems.length;

  sideGems.push(...newGems);
  const newestCard = newCards.at(-1);
  renderDeck(newestCard?.id || selectedCardId);
  renderSideRuneStones();
  setStatus("");
}

initializeSettings();

newGameButton.addEventListener("click", startNewGame);
endTurnButton.addEventListener("click", endTurn);
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
  settingsNote.textContent = "Saved · applies on next New game / End turn";
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
    endTurnButton.disabled = true;
    setStatus(error.message);
    console.error(error);
  });
