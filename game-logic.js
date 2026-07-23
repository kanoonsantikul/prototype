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
    })),
    deckButton: null,
    deckMeta: null,
    thumbnailCanvas: null,
    thumbnailContext: null,
  };
}

function createRandomGems(stoneAssets, runeAssets, mods, count, gameSettings, nextGemId) {
  return Array.from({ length: count }, (_, index) => ({
    id: `gem-${nextGemId + index}`,
    stone: weightedRandomItem(
      stoneAssets,
      (stone) => gameSettings.stoneTypeWeights[stone.name],
    ),
    rune: weightedRandomItem(
      runeAssets,
      (candidate) => gameSettings.stoneRuneWeights[candidate.name],
    ),
    mod: randomItem(mods),
  }));
}

function socketedMods(card) {
  return card.sockets
    .filter((socket) => socket.gem)
    .map((socket) => socket.gem.mod);
}

function cardProgress(card) {
  const filledCount = card.sockets.filter((socket) => socket.gem).length;
  return `${filledCount}/${card.sockets.length}`;
}

function socketIndexAt(card, point) {
  return card.sockets.findIndex(
    (socket) => distanceBetween(socket.point, point) <= SOCKET_SIZE / 2,
  );
}
