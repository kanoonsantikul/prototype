"use strict";

const DEBUFF_STATUS_TYPES = ["wound", "bleed", "stun", "weaken", "mark", "death-spread"];

function isRealGame() {
  return gameMode === GAME_MODE_REAL;
}

function createFighter(id, name, side, stats, kind = "", asset = null) {
  return {
    id,
    name,
    side,
    kind,
    asset,
    hp: stats.hp,
    maxHp: stats.maxHp || stats.hp,
    attack: stats.attack || 0,
    block: 0,
    statuses: [],
    alive: true,
  };
}

function encounterSizeForWave(wave) {
  if (wave <= 1) return 1;
  if (wave === 2) return Math.random() < 0.4 ? 2 : 1;
  if (wave === 3) return Math.random() < 0.6 ? 2 : 1;
  if (wave === 4) {
    const roll = Math.random();
    if (roll < 0.2) return 1;
    if (roll < 0.75) return 2;
    return 3;
  }
  const roll = Math.random();
  if (roll < 0.12) return 1;
  if (roll < 0.62) return 2;
  return 3;
}

function encounterScale(wave) {
  return {
    hp: 1 + Math.max(0, wave - 1) * 0.24,
    attack: 1 + Math.max(0, wave - 1) * 0.16,
  };
}

function scaledEnemyStats(kind, wave) {
  const base = ENEMY_COMBAT_STATS[kind] || { hp: 10, attack: 2 };
  const scale = encounterScale(wave);
  return {
    hp: Math.max(1, Math.round(base.hp * scale.hp)),
    attack: Math.max(1, Math.round(base.attack * scale.attack)),
  };
}

function pickEncounterAsset(wave) {
  const enemies = loadedAssets?.enemies || [];
  if (!enemies.length) return null;
  if (wave <= 2) {
    const minions = enemies.filter((enemy) => enemy.name === "minion");
    if (minions.length && Math.random() < 0.62) return randomItem(minions);
  }
  if (wave >= 4) {
    const tanks = enemies.filter((enemy) => enemy.name === "tank");
    if (tanks.length && Math.random() < 0.42) return randomItem(tanks);
  }
  return randomItem(enemies);
}

function generateEncounter(wave) {
  const size = Math.min(ENCOUNTER_MAX_SIZE, encounterSizeForWave(wave));
  const assets = Array.from({ length: size }, () => pickEncounterAsset(wave)).filter(Boolean);
  const seen = new Map();
  return assets.map((asset) => {
    const count = (seen.get(asset.label) || 0) + 1;
    seen.set(asset.label, count);
    const sameKind = assets.filter((candidate) => candidate.label === asset.label).length;
    return {
      ...asset,
      label: sameKind > 1 ? `${asset.label} ${count}` : asset.label,
    };
  });
}

function persistHeroAfterCombat(outcome) {
  const maxHp = HERO_COMBAT_STATS.hp;
  if (!combatHero) {
    persistedHeroHp = maxHp;
    return;
  }
  if (outcome === "win") {
    persistedHeroHp = Math.min(maxHp, combatHero.hp + POST_COMBAT_HEAL);
    return;
  }
  if (outcome === "retreat") {
    persistedHeroHp = Math.max(1, combatHero.hp);
    return;
  }
  persistedHeroHp = maxHp;
}

function initializeRealCombat() {
  const encounter = currentEncounter.length ? currentEncounter : generateEncounter(encounterWave);
  currentEncounter = encounter;
  currentEnemy = encounter[0] || null;

  const maxHp = HERO_COMBAT_STATS.hp;
  const startHp = Math.min(maxHp, Math.max(1, persistedHeroHp ?? maxHp));
  combatHero = createFighter("hero", HERO_NAME, "hero", {
    hp: startHp,
    maxHp,
    attack: HERO_COMBAT_STATS.attack,
  });
  combatEnemies = encounter.map((asset, index) => createFighter(
    `enemy-${index}`,
    asset.label || "Enemy",
    "enemy",
    scaledEnemyStats(asset.name, encounterWave),
    asset.name,
    asset,
  ));
  selectedEnemyId = combatEnemies[0]?.id || null;
}

function livingEnemies() {
  return combatEnemies.filter((fighter) => fighter.alive);
}

function selectedEnemy() {
  return livingEnemies().find((fighter) => fighter.id === selectedEnemyId) || null;
}

function primaryEnemy() {
  return selectedEnemy() || livingEnemies()[0] || null;
}

function selectCombatEnemy(enemyId) {
  const match = livingEnemies().find((fighter) => fighter.id === enemyId);
  selectedEnemyId = match?.id || livingEnemies()[0]?.id || null;
  return selectedEnemy();
}

function statusTotal(fighter, type) {
  return fighter.statuses
    .filter((status) => status.type === type)
    .reduce((total, status) => total + (Number(status.amount) || 0), 0);
}

function addStatus(fighter, type, amount, turns) {
  if (!fighter?.alive) return;
  fighter.statuses.push({
    type,
    amount: Number(amount) || 0,
    turns: Number.isFinite(turns) ? turns : 99,
  });
}

function cloneStatuses(statuses) {
  return statuses.map((status) => ({ ...status }));
}

function isDebuffStatus(status) {
  return DEBUFF_STATUS_TYPES.includes(status.type);
}

function livingFighters() {
  return [combatHero, ...combatEnemies].filter((fighter) => fighter?.alive);
}

function otherLivingFighters(fighter) {
  return livingFighters().filter((candidate) => candidate.id !== fighter.id);
}

function pickRandomFighter(fighters) {
  return fighters.length ? randomItem(fighters) : null;
}

function adjacentEnemies(fighter) {
  return livingEnemies().filter((candidate) => candidate.id !== fighter.id);
}

function statusLabels(fighter) {
  if (!fighter) return [];
  const labels = [];
  if (fighter.block > 0) labels.push(`Block ${fighter.block}`);
  for (const status of fighter.statuses) {
    const name = status.type.replaceAll("-", " ");
    const amount = status.amount ? ` ${status.amount}` : "";
    const turns = Number.isFinite(status.turns) && status.turns < 20 ? ` ${status.turns}t` : "";
    labels.push(`${name}${amount}${turns}`);
  }
  return labels;
}

function resetFighterBlock(fighter) {
  fighter.block = 0;
}

function grantBlock(fighter, amount) {
  if (!fighter?.alive) return;
  fighter.block += Math.max(0, amount);
}

function spreadDebuffsFrom(source, target) {
  if (!source || !target?.alive) return;
  const debuffs = source.statuses.filter(isDebuffStatus);
  target.statuses.push(...cloneStatuses(debuffs));
}

function handleFighterDeath(fighter) {
  if (!fighter || fighter.hp > 0 || !fighter.alive) return [];
  fighter.alive = false;
  fighter.hp = 0;
  fighter.block = 0;
  const logs = [`${fighter.name} is defeated.`];
  const hasDeathSpread = fighter.statuses.some((status) => status.type === "death-spread");
  if (hasDeathSpread) {
    const recipient = pickRandomFighter(otherLivingFighters(fighter));
    if (recipient) {
      spreadDebuffsFrom(fighter, recipient);
      logs.push(`Death Spread passed ${fighter.name}'s debuffs to ${recipient.name}.`);
    }
  }
  fighter.statuses = [];
  if (fighter.id === selectedEnemyId) {
    selectedEnemyId = livingEnemies()[0]?.id || null;
  }
  return logs;
}

function dealDamage(target, rawAmount, attacker = null) {
  const logs = [];
  if (!target?.alive || rawAmount <= 0) return logs;

  let remaining = Math.max(0, rawAmount);
  if (target.block > 0) {
    const absorbed = Math.min(target.block, remaining);
    target.block -= absorbed;
    remaining -= absorbed;
    if (absorbed > 0) logs.push(`${target.name} blocked ${absorbed}.`);
  }

  if (remaining > 0) {
    target.hp = Math.max(0, target.hp - remaining);
    logs.push(`${target.name} took ${remaining} damage.`);
    logs.push(...handleFighterDeath(target));
  }

  if (attacker?.alive && target.side !== attacker.side) {
    const thorns = statusTotal(target, "thorns");
    if (thorns > 0 && attacker.alive) {
      logs.push(`${target.name} reflected ${thorns} damage.`);
      logs.push(...dealDamage(attacker, thorns));
    }
  }

  return logs;
}

function cardSocketEffects(card) {
  const disabled = new Set();
  const entries = card.sockets.map((socket, index) => {
    const definition = socket.gem ? findModDefinition(socket.gem.mod) : null;
    return { index, definition, effect: definition?.effect || null };
  });

  for (const entry of entries) {
    if (entry.effect?.type !== "draw-disable") continue;
    for (const link of card.links) {
      const neighbor = link.from === entry.index ? link.to : link.to === entry.index ? link.from : -1;
      if (neighbor >= 0) disabled.add(neighbor);
    }
  }

  return entries
    .filter((entry) => entry.effect && !disabled.has(entry.index))
    .map((entry) => entry.effect);
}

function isAttackEffect(effect) {
  return effect.type === "attack" || effect.type === "attack-per-attack";
}

function outgoingAttackBonus(attacker, target) {
  return statusTotal(attacker, "buff-attack")
    + statusTotal(target, "mark")
    + statusTotal(target, "wound");
}

function resolveAttackHits(attacker, target, baseDamage, criticalMultiplier, logs) {
  if (!target?.alive || baseDamage <= 0) return;
  const bonus = outgoingAttackBonus(attacker, target);
  const damage = Math.max(0, (baseDamage + bonus) * criticalMultiplier);
  logs.push(`${attacker.name} attacks ${target.name} for ${damage}.`);
  logs.push(...dealDamage(target, damage, attacker));
}

function applyStartStatuses(fighter) {
  const logs = [];
  if (!fighter?.alive) return logs;

  for (const status of fighter.statuses) {
    if (status.type === "bleed" && status.amount > 0) {
      logs.push(`${fighter.name} bleeds for ${status.amount}.`);
      logs.push(...dealDamage(fighter, status.amount));
      if (!fighter.alive) return logs;
    }
    if (status.type === "lingering-block" && status.amount > 0) {
      grantBlock(fighter, status.amount);
      logs.push(`${fighter.name} refreshed ${status.amount} lingering block.`);
    }
  }

  return logs;
}

function expireStatuses(fighter) {
  if (!fighter) return;
  fighter.statuses = fighter.statuses
    .map((status) => ({
      ...status,
      turns: Number.isFinite(status.turns) ? status.turns - 1 : status.turns,
    }))
    .filter((status) => !Number.isFinite(status.turns) || status.turns > 0);
}

function startOfTurnEffects(fighter) {
  if (!fighter?.alive) return [];
  resetFighterBlock(fighter);
  return applyStartStatuses(fighter);
}

function combatOutcome() {
  if (!isRealGame() || !isCombat()) return null;
  if (!combatHero?.alive) return "loss";
  if (livingEnemies().length === 0) return "win";
  return null;
}

function enemyIntent(enemy) {
  if (!enemy?.alive) return "defeated";
  if (enemy.statuses.some((status) => status.type === "stun")) return "stunned";
  return `attack ${Math.max(0, enemy.attack + statusTotal(enemy, "buff-attack") - statusTotal(enemy, "weaken"))}`;
}

function resolveEnemyTurn() {
  const logs = [];
  if (!combatHero?.alive) return logs;

  for (const enemy of livingEnemies()) {
    logs.push(...startOfTurnEffects(enemy));
    if (!enemy.alive) continue;
    if (enemy.statuses.some((status) => status.type === "stun")) {
      logs.push(`${enemy.name} is stunned.`);
    } else {
      const damage = Math.max(0, enemy.attack + statusTotal(enemy, "buff-attack") - statusTotal(enemy, "weaken"));
      if (damage <= 0) {
        logs.push(`${enemy.name} failed to deal damage.`);
      } else {
        logs.push(`${enemy.name} attacks ${combatHero.name} for ${damage}.`);
        logs.push(...dealDamage(combatHero, damage, enemy));
      }
    }

    expireStatuses(enemy);
    if (!combatHero.alive) break;
  }

  return logs;
}
