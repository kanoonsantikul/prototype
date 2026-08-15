"use strict";

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
  socket.locked = false;
  sideGems = sideGems.filter((candidate) => candidate.id !== gem.id);
  renderSideRuneStones();
  clearDropFeedback();
  drawDeckThumbnail(card, loadedAssets);
  updateActiveCardDetails(card);
  updatePhaseChrome();
  return true;
}


function beginGemDrag(event, gem, token = event.currentTarget) {
  draggingGemId = gem.id;
  draggingPointerId = event.pointerId;
  draggingToken = token && token !== activeCardCanvas ? token : null;
  draggingToken?.classList.add("is-dragging");
  (token || activeCardCanvas).setPointerCapture?.(event.pointerId);

  dragPreview = document.createElement("canvas");
  dragPreview.width = 128;
  dragPreview.height = 128;
  dragPreview.className = "rune-drag-preview";
  drawGem(dragPreview.getContext("2d"), gem, dragPreview.width);
  document.body.append(dragPreview);
  document.body.classList.add("is-dragging-stone");
  moveDragPreview(event.clientX, event.clientY);
}

function handleGemPointerDown(event, gem) {
  if (!isDeckBuilding()) return;
  if (event.isPrimary === false || (event.pointerType === "mouse" && event.button !== 0)) return;
  if (draggingGemId || draggingCardId) return;

  event.preventDefault();
  beginGemDrag(event, gem, event.currentTarget);
}

function handleSocketedGemPointerDown(event) {
  if (!isDeckBuilding()) return;
  if (event.isPrimary === false || (event.pointerType === "mouse" && event.button !== 0)) return;
  if (draggingGemId || draggingCardId) return;

  const card = selectedCard();
  if (!card) return;

  const socketIndex = socketIndexFromClientPoint(card, event.clientX, event.clientY);
  if (socketIndex < 0) return;

  const socket = card.sockets[socketIndex];
  if (!socket.gem) return;
  if (socket.locked) {
    setStatus("That stone locked in after the last combat.");
    return;
  }

  event.preventDefault();
  const gem = unsocketGem(card, socket);
  if (!gem) return;

  sideGems.push(gem);
  renderSideRuneStones();
  drawDeckThumbnail(card, loadedAssets);
  updateActiveCardDetails(card);
  updatePhaseChrome();
  beginGemDrag(event, gem, activeCardCanvas);
  setStatus("Pulled stone off the card. Drop it on a matching socket or back in the tray.");
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

function handleCardPointerUp(event) {
  if (event.pointerId !== draggingPointerId || !draggingCardId) return;

  event.preventDefault();
  const cardId = draggingCardId;
  const overCombat = isPointInCombatDropZone(event.clientX, event.clientY);
  resetPointerDrag();

  const card = hand.find((candidate) => candidate.id === cardId);
  if (!card || !overCombat) return;

  const targetId = enemyIdAtClientPoint(event.clientX);
  if (targetId) selectCombatEnemy(targetId);
  playCardFromHand(card);
}

function handleCardPointerCancel(event) {
  if (event.pointerId !== draggingPointerId || !draggingCardId) return;
  resetPointerDrag();
}

function handleActiveCardPointerDown(event) {
  if (isDeckBuilding()) {
    handleSocketedGemPointerDown(event);
    return;
  }
  if (!isCombat()) return;
  const card = selectedCard();
  if (!card) return;
  handleCardPointerDown(event, card, "preview");
}

function handleActiveCardPointerMove(event) {
  if (draggingGemId) return;
  handleCardPointerMove(event);
}

function handleActiveCardPointerUp(event) {
  if (draggingGemId) return;
  handleCardPointerUp(event);
}

function handleActiveCardPointerCancel(event) {
  if (draggingGemId) return;
  handleCardPointerCancel(event);
}

function updateSocketHoverCursor(event) {
  if (!isDeckBuilding() || draggingGemId || draggingCardId) {
    activeCardCanvas.style.cursor = "";
    return;
  }

  const card = selectedCard();
  if (!card) {
    activeCardCanvas.style.cursor = "";
    return;
  }

  const socketIndex = socketIndexFromClientPoint(card, event.clientX, event.clientY);
  if (socketIndex < 0) {
    activeCardCanvas.style.cursor = "";
    return;
  }

  const socket = card.sockets[socketIndex];
  if (!socket.gem) {
    activeCardCanvas.style.cursor = "";
    return;
  }

  activeCardCanvas.style.cursor = socket.locked ? "not-allowed" : "grab";
}
