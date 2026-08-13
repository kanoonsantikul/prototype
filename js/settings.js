"use strict";

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
  };

  updateWeightPercentages(socketCountWeights);
  updateWeightPercentages(socketRuneWeights);
  updateWeightPercentages(stoneTypeWeights);
  updateWeightPercentages(stoneRuneWeights);

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
