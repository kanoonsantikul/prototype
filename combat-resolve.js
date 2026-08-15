"use strict";

function applyCardEffects(card, caster, replayed = false) {
  const logs = [];
  const effects = cardSocketEffects(card);
  if (effects.length === 0) {
    logs.push(`${card.name} had no active mods.`);
    return logs;
  }

  const attackCount = effects.filter(isAttackEffect).length;
  const criticalMultiplier = effects.some((effect) => effect.type === "critical") ? 2 : 1;
  const attackRepeats = 1 + effects.filter((effect) => effect.type === "repeat-attack").length;
  const shouldReplay = !replayed && effects.some((effect) => effect.type === "replay");

  for (const effect of effects) {
    if (isAttackEffect(effect)) {
      const base = effect.type === "attack-per-attack"
        ? Math.max(1, attackCount)
        : Number(effect.damage) || 0;
      const hits = Math.max(1, Number(effect.randomHits) || 1);
      for (let hit = 0; hit < hits; hit += 1) {
        const target = hits > 1 ? pickRandomFighter(livingEnemies()) : primaryEnemy();
        for (let repeat = 0; repeat < attackRepeats; repeat += 1) {
          resolveAttackHits(caster, target, base, criticalMultiplier, logs);
        }
      }
      continue;
    }

    if (effect.type === "block") {
      const bonus = statusTotal(caster, "buff-guard");
      grantBlock(caster, (Number(effect.amount) || 0) + bonus);
      if ((Number(effect.turns) || 1) > 1) {
        addStatus(caster, "lingering-block", Number(effect.amount) || 0, Number(effect.turns) || 1);
      }
      logs.push(`${caster.name} gained ${effect.amount} block.`);
      continue;
    }

    if (effect.type === "thorns") {
      addStatus(caster, "thorns", Number(effect.damage) || 0, 99);
      logs.push(`${caster.name} will deal ${effect.damage} back when attacked.`);
      continue;
    }

    if (effect.type === "buff-attack" || effect.type === "buff-guard") {
      addStatus(caster, effect.type, Number(effect.amount) || 0, Number(effect.turns) || 1);
      logs.push(`${caster.name} gained ${effect.type.replace("-", " ")} ${effect.amount}.`);
      continue;
    }

    if (effect.type === "gain-energy") {
      combatEnergy += Number(effect.amount) || 0;
      logs.push(`${caster.name} gained ${effect.amount} energy.`);
      continue;
    }

    if (effect.type === "gain-energy-chance") {
      if (Math.random() < Number(effect.chance || 0)) {
        combatEnergy += Number(effect.amount) || 0;
        logs.push(`${caster.name} lucked into ${effect.amount} energy.`);
      } else {
        logs.push(`${caster.name} failed to gain energy.`);
      }
      continue;
    }

    if (effect.type === "draw-disable" || effect.type === "draw-discard") {
      const drawn = drawCards(Number(effect.draw) || 1);
      hand.push(...drawn);
      if (drawn.length) logs.push(`${caster.name} drew ${drawn.length}.`);
      if (effect.type === "draw-discard" && hand.length > 0) {
        const discarded = hand.splice(Math.floor(Math.random() * hand.length), 1)[0];
        if (discarded) {
          discardPile.push(discarded);
          logs.push(`Discarded ${discarded.name}.`);
        }
      }
      continue;
    }

    const target = primaryEnemy();
    if (!target) continue;

    if (effect.type === "wound" || effect.type === "bleed" || effect.type === "weaken" || effect.type === "mark" || effect.type === "death-spread" || effect.type === "stun") {
      addStatus(target, effect.type, Number(effect.amount ?? effect.damage) || 0, Number(effect.turns) || 1);
      logs.push(`${target.name} received ${effect.type.replace("-", " ")}.`);
      continue;
    }

    if (effect.type === "spread-debuffs") {
      for (const neighbor of adjacentEnemies(target)) {
        spreadDebuffsFrom(target, neighbor);
        logs.push(`Debuffs spread from ${target.name} to ${neighbor.name}.`);
      }
    }
  }

  if (shouldReplay) {
    logs.push(`${card.name} plays again.`);
    logs.push(...applyCardEffects(card, caster, true));
  }

  return logs;
}
