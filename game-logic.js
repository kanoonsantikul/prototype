"use strict";

function generateSocketPositions(count) {
  const bounds = {
    left: 210,
    right: CARD_WIDTH - 210,
    top: 225,
    bottom: 970,
  };
  const minimumDistance = SOCKET_SIZE + SOCKET_GAP;

  // Retry the whole layout when random placement reaches a dead end. Appending
  // fallback points to a partial layout can put them on top of existing sockets.
  for (let layoutAttempt = 0; layoutAttempt < 50; layoutAttempt += 1) {
    const points = [];

    for (let index = 0; index < count; index += 1) {
      let candidate = null;

      for (let attempt = 0; attempt < 700; attempt += 1) {
        const test = {
          x: randomBetween(bounds.left, bounds.right),
          y: randomBetween(bounds.top, bounds.bottom),
        };

        if (points.every((point) => distanceBetween(point, test) >= minimumDistance)) {
          candidate = test;
          break;
        }
      }

      if (!candidate) break;
      points.push(candidate);
    }

    if (points.length === count) return points;
  }

  // This staggered layout fits seven sockets and keeps every pair separated.
  // Shuffling retains variety when fewer than seven sockets are requested.
  return shuffled([
    { x: 210, y: 250 },
    { x: 512, y: 250 },
    { x: 814, y: 250 },
    { x: 361, y: 515 },
    { x: 663, y: 515 },
    { x: 210, y: 780 },
    { x: 512, y: 780 },
  ]).slice(0, count);
}

// Randomized Prim construction: adding one unconnected node per edge guarantees a tree.
function generateAcyclicLinks(points) {
  if (points.length < 2) return [];

  const connected = new Set([Math.floor(Math.random() * points.length)]);
  const links = [];

  while (connected.size < points.length) {
    let bestLink = null;

    for (const from of connected) {
      for (let to = 0; to < points.length; to += 1) {
        if (connected.has(to)) continue;

        const score = distanceBetween(points[from], points[to]) * randomBetween(0.82, 1.18);
        if (!bestLink || score < bestLink.score) bestLink = { from, to, score };
      }
    }

    links.push({ from: bestLink.from, to: bestLink.to });
    connected.add(bestLink.to);
  }

  return links;
}

function createRandomCard(loaded, index, gameSettings, nextCardId) {
  const socketCount = weightedRandomItem(
    SOCKET_COUNT_OPTIONS,
    (count) => gameSettings.socketCountWeights[count],
  );
  const points = generateSocketPositions(socketCount);
  const links = generateAcyclicLinks(points);

  return {
    id: `card-${nextCardId}`,
    name: `Rune card ${index + 1}`,
    links,
    sockets: points.map((point) => ({
      point,
      rune: weightedRandomItem(
        loaded.runes,
        (rune) => gameSettings.socketRuneWeights[rune.name],
      ),
      gem: null,
      locked: false,
    })),
    deckButton: null,
    deckMeta: null,
    thumbnailCanvas: null,
    thumbnailContext: null,
  };
}

function createRandomGems(stoneAssets, runeAssets, mods, count, gameSettings, nextGemId) {
  return Array.from({ length: count }, (_, index) => {
    const rolled = weightedRandomItem(mods, (entry) => entry.weight);
    return {
      id: `gem-${nextGemId + index}`,
      stone: weightedRandomItem(
        stoneAssets,
        (stone) => gameSettings.stoneTypeWeights[stone.name],
      ),
      rune: weightedRandomItem(
        runeAssets,
        (candidate) => gameSettings.stoneRuneWeights[candidate.name],
      ),
      mod: rolled.text,
      cost: Number.isFinite(rolled.cost) ? rolled.cost : 0,
    };
  });
}

function socketedMods(card) {
  return card.sockets
    .filter((socket) => socket.gem)
    .map((socket) => ({
      text: socket.gem.mod,
      cost: gemEnergyCost(socket.gem),
    }));
}

function gemEnergyCost(gem) {
  const cost = Number(gem?.cost);
  return Number.isFinite(cost) ? Math.max(0, cost) : 0;
}

function cardEnergyCost(card) {
  return card.sockets.reduce((total, socket) => {
    if (!socket.gem) return total;
    return total + gemEnergyCost(socket.gem);
  }, 0);
}

function canPayEnergyCost(available, cost) {
  return available >= cost;
}

function spendEnergyCost(available, cost) {
  return available - cost;
}

function createTurnEnergy(count) {
  return count;
}

function formatEnergyCost(cost) {
  if (cost <= 0) return "free";
  return `${cost} energy`;
}

function formatModLabel(mod, cost) {
  const amount = Number.isFinite(cost) ? cost : 0;
  return amount > 0 ? `${mod} (${amount})` : `${mod} (free)`;
}

function cardProgress(card) {
  const filledCount = card.sockets.filter((socket) => socket.gem).length;
  const draftCount = card.sockets.filter((socket) => socket.gem && !socket.locked).length;
  const lockedCount = filledCount - draftCount;
  if (!filledCount) return `${filledCount}/${card.sockets.length}`;
  if (draftCount && lockedCount) return `${filledCount}/${card.sockets.length} · ${draftCount} draft`;
  if (draftCount) return `${filledCount}/${card.sockets.length} · draft`;
  return `${filledCount}/${card.sockets.length} · locked`;
}

function socketIndexAt(card, point) {
  return card.sockets.findIndex(
    (socket) => distanceBetween(socket.point, point) <= SOCKET_SIZE / 2,
  );
}

function lockSocketedGems(cards) {
  for (const card of cards) {
    for (const socket of card.sockets) {
      if (socket.gem) socket.locked = true;
    }
  }
}

function unsocketGem(card, socket) {
  if (!card || !socket?.gem || socket.locked) return null;
  const gem = socket.gem;
  socket.gem = null;
  return gem;
}
