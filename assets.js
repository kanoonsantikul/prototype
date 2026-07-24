"use strict";

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load ${source}`));
    image.src = source;
  });
}

function loadNamedImages(definitions) {
  return Promise.all(definitions.map(async (definition) => ({
    ...definition,
    image: await loadImage(definition.source),
  })));
}

const assets = {
  card: loadImage("game-assets/card-template.png"),
  hero: loadImage("game-assets/characters/hero.png"),
  enemies: loadNamedImages(ENEMY_ASSETS),
  socket: loadImage("game-assets/socket-circle.png"),
  runes: loadNamedImages(SOCKET_RUNE_ASSETS),
  radiantRunes: loadNamedImages(RADIANT_RUNE_ASSETS),
  runeStones: loadNamedImages(RUNE_STONE_ASSETS),
  link: loadImage("game-assets/link-segment.png"),
};

let cachedLoadedAssets = null;

async function getLoadedAssets() {
  if (cachedLoadedAssets) return cachedLoadedAssets;

  const [card, hero, enemies, socket, runes, link, runeStones, radiantRunes] = await Promise.all([
    assets.card,
    assets.hero,
    assets.enemies,
    assets.socket,
    assets.runes,
    assets.link,
    assets.runeStones,
    assets.radiantRunes,
  ]);

  if (!Array.isArray(MOD_POOL) || MOD_POOL.length === 0) {
    throw new Error("MOD_POOL is empty");
  }

  cachedLoadedAssets = {
    card,
    hero,
    enemies,
    socket,
    runes,
    link,
    runeStones,
    radiantRunes,
    mods: MOD_POOL,
  };
  return cachedLoadedAssets;
}
