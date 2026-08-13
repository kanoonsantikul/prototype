"use strict";

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
