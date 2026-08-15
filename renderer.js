"use strict";

function drawGem(targetContext, gem, size) {
  targetContext.clearRect(0, 0, size, size);
  targetContext.drawImage(gem.stone.image, 0, 0, size, size);
  targetContext.drawImage(gem.rune.image, 0, 0, size, size);
}

function drawTiledLink(targetContext, image, start, end) {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const length = Math.hypot(deltaX, deltaY);

  targetContext.save();
  targetContext.translate(start.x, start.y);
  targetContext.rotate(Math.atan2(deltaY, deltaX));

  for (let x = 0; x < length; x += LINK_TILE_WIDTH) {
    const destinationWidth = Math.min(LINK_TILE_WIDTH, length - x);
    const sourceWidth = image.width * (destinationWidth / LINK_TILE_WIDTH);

    targetContext.drawImage(
      image,
      0,
      0,
      sourceWidth,
      image.height,
      x,
      -LINK_HEIGHT / 2,
      destinationWidth,
      LINK_HEIGHT,
    );
  }

  targetContext.restore();
}

function drawSocket(targetContext, socketImage, socket) {
  const { point } = socket;
  const socketLeft = point.x - SOCKET_SIZE / 2;
  const socketTop = point.y - SOCKET_SIZE / 2;
  const runeLeft = point.x - RUNE_SIZE / 2;
  const runeTop = point.y - RUNE_SIZE / 2;

  targetContext.drawImage(
    socketImage,
    socketLeft,
    socketTop,
    SOCKET_SIZE,
    SOCKET_SIZE,
  );

  if (socket.gem) {
    const gemLeft = point.x - SOCKET_GEM_SIZE / 2;
    const gemTop = point.y - SOCKET_GEM_SIZE / 2;
    targetContext.save();
    if (socket.locked) targetContext.globalAlpha = 0.72;

    targetContext.drawImage(
      socket.gem.stone.image,
      gemLeft,
      gemTop,
      SOCKET_GEM_SIZE,
      SOCKET_GEM_SIZE,
    );
    targetContext.drawImage(
      socket.gem.rune.image,
      gemLeft,
      gemTop,
      SOCKET_GEM_SIZE,
      SOCKET_GEM_SIZE,
    );

    if (socket.locked) {
      targetContext.beginPath();
      targetContext.arc(point.x, point.y, SOCKET_GEM_SIZE * 0.46, 0, Math.PI * 2);
      targetContext.strokeStyle = "rgba(255, 214, 150, 0.55)";
      targetContext.lineWidth = 4;
      targetContext.stroke();
    }
    targetContext.restore();
  } else {
    targetContext.drawImage(
      socket.rune.image,
      runeLeft,
      runeTop,
      RUNE_SIZE,
      RUNE_SIZE,
    );
  }
}

function drawDropHighlight(targetContext, socket, isValid) {
  targetContext.save();
  targetContext.beginPath();
  targetContext.arc(socket.point.x, socket.point.y, SOCKET_SIZE * 0.43, 0, Math.PI * 2);
  targetContext.lineWidth = 12;
  targetContext.strokeStyle = isValid ? "#9ef8ff" : "#ff7188";
  targetContext.shadowColor = targetContext.strokeStyle;
  targetContext.shadowBlur = 24;
  targetContext.stroke();
  targetContext.restore();
}

function drawCardSurface(card, canvas, context, loadedAssets, dropTarget = null, showDropTarget = false) {
  if (!loadedAssets || !card || !context) return;

  const scaleX = canvas.width / CARD_WIDTH;
  const scaleY = canvas.height / CARD_HEIGHT;

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.save();
  context.scale(scaleX, scaleY);
  context.drawImage(loadedAssets.card, 0, 0, CARD_WIDTH, CARD_HEIGHT);

  for (const link of card.links) {
    drawTiledLink(
      context,
      loadedAssets.link,
      card.sockets[link.from].point,
      card.sockets[link.to].point,
    );
  }

  card.sockets.forEach((socket, index) => {
    drawSocket(context, loadedAssets.socket, socket);

    if (showDropTarget && dropTarget?.cardId === card.id && dropTarget.socketIndex === index) {
      drawDropHighlight(context, socket, dropTarget.isValid);
    }
  });

  context.restore();
}

function drawActiveCard(card, canvas, context, loadedAssets, dropTarget) {
  if (!card) return;
  drawCardSurface(card, canvas, context, loadedAssets, dropTarget, true);
}

function drawDeckThumbnail(card, loadedAssets) {
  if (!card.thumbnailCanvas || !card.thumbnailContext) return;
  drawCardSurface(card, card.thumbnailCanvas, card.thumbnailContext, loadedAssets);
}

function drawFighterPortrait(targetContext, image, centerX, baselineY, maxHeight, label, flipHorizontal = false, selected = false) {
  const aspect = image.width / image.height;
  const height = maxHeight;
  const width = height * aspect;
  const left = centerX - width / 2;
  const top = baselineY - height;

  if (selected) {
    targetContext.save();
    targetContext.fillStyle = "rgba(255, 176, 92, 0.16)";
    targetContext.beginPath();
    targetContext.ellipse(centerX, baselineY + 8, width * 0.42, 18, 0, 0, Math.PI * 2);
    targetContext.fill();
    targetContext.restore();
  }

  targetContext.save();
  if (flipHorizontal) {
    targetContext.translate(centerX * 2, 0);
    targetContext.scale(-1, 1);
  }
  targetContext.drawImage(image, left, top, width, height);
  targetContext.restore();

  targetContext.save();
  targetContext.font = selected
    ? "800 24px Segoe UI, system-ui, sans-serif"
    : "700 22px Segoe UI, system-ui, sans-serif";
  targetContext.textAlign = "center";
  targetContext.textBaseline = "top";
  targetContext.fillStyle = selected ? "rgba(255, 214, 150, 0.96)" : "rgba(232, 244, 236, 0.92)";
  targetContext.shadowColor = "rgba(0, 0, 0, 0.75)";
  targetContext.shadowBlur = 8;
  targetContext.fillText(label, centerX, baselineY + 12);
  targetContext.restore();
}

function encounterPortraits(enemies) {
  const visible = (enemies || []).filter((enemy) => enemy?.image);
  const count = visible.length;
  const height = count > 1 ? COMBAT_FIGHTER_HEIGHT * (count === 2 ? 0.86 : 0.74) : COMBAT_FIGHTER_HEIGHT;
  const startX = count === 1 ? COMBAT_WIDTH * 0.72 : COMBAT_WIDTH * 0.62;
  const step = count === 1 ? 0 : (COMBAT_WIDTH * 0.82 - startX) / Math.max(1, count - 1);
  return visible.map((enemy, index) => ({
    enemy,
    centerX: startX + step * index,
    height,
  }));
}

function drawCombat(canvas, context, loadedAssets, enemies) {
  if (!loadedAssets || !context) return;

  const scaleX = canvas.width / COMBAT_WIDTH;
  const scaleY = canvas.height / COMBAT_HEIGHT;
  const roster = Array.isArray(enemies) ? enemies : (enemies ? [enemies] : []);

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.save();
  context.scale(scaleX, scaleY);

  const ground = context.createLinearGradient(0, COMBAT_HEIGHT * 0.55, 0, COMBAT_HEIGHT);
  ground.addColorStop(0, "rgba(8, 22, 16, 0)");
  ground.addColorStop(0.45, "rgba(10, 28, 20, 0.35)");
  ground.addColorStop(1, "rgba(4, 12, 9, 0.7)");
  context.fillStyle = ground;
  context.fillRect(0, 0, COMBAT_WIDTH, COMBAT_HEIGHT);

  const baselineY = COMBAT_HEIGHT - 70;
  const heroCenterX = COMBAT_WIDTH * (roster.length > 1 ? 0.22 : 0.28);

  drawFighterPortrait(
    context,
    loadedAssets.hero,
    heroCenterX,
    baselineY,
    COMBAT_FIGHTER_HEIGHT,
    HERO_NAME,
  );

  for (const portrait of encounterPortraits(roster)) {
    drawFighterPortrait(
      context,
      portrait.enemy.image,
      portrait.centerX,
      baselineY,
      portrait.height,
      portrait.enemy.label || "Enemy",
      true,
      portrait.enemy.id === selectedEnemyId || (roster.length === 1 && portrait.enemy === currentEnemy),
    );
  }

  context.restore();
}

function cardPointFromClientPoint(clientX, clientY, canvas) {
  const bounds = canvas.getBoundingClientRect();

  return {
    x: (clientX - bounds.left) * (CARD_WIDTH / bounds.width),
    y: (clientY - bounds.top) * (CARD_HEIGHT / bounds.height),
  };
}
