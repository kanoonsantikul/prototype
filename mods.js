"use strict";

const MOD_POOL = [
  { id: "attack-1", text: "“Attack” 1 dmg", weight: 5, cost: 1, effect: { type: "attack", damage: 1 } },
  { id: "attack-3", text: "“Attack” 3 dmg", weight: 1, cost: 2, effect: { type: "attack", damage: 3 } },
  { id: "attack-random-2", text: "“Attack” 2 random monsters", weight: 1, cost: 2, effect: { type: "attack", damage: 2, randomHits: 2 } },
  { id: "attack-per-attack", text: "“Attack” + 1 dmg for each mod with “Attack”", weight: 1, cost: 2, effect: { type: "attack-per-attack", damage: 1 } },
  { id: "repeat-attack", text: "“Repeat” the “Attack”", weight: 1, cost: 2, effect: { type: "repeat-attack" } },
  { id: "block-2-1", text: "Block 2 damage for 1 turn", weight: 1, cost: 1, effect: { type: "block", amount: 2, turns: 1 } },
  { id: "block-1-3", text: "Block 1 damage for 3 turns", weight: 1, cost: 1, effect: { type: "block", amount: 1, turns: 3 } },
  { id: "critical", text: "“Critical”", weight: 1, cost: 1, effect: { type: "critical", multiplier: 2 } },
  { id: "thorns-1", text: "When attacked, deal 1 damage back", weight: 1, cost: 1, effect: { type: "thorns", damage: 1 } },
  { id: "buff-attack", text: "Increase “attack” by 1 damage for 3 turns", weight: 1, cost: 2, effect: { type: "buff-attack", amount: 1, turns: 3 } },
  { id: "buff-guard", text: "Increase “guard” by 1 damage for 3 turns", weight: 1, cost: 1, effect: { type: "buff-guard", amount: 1, turns: 3 } },
  { id: "wound-mark", text: "Attacks deal x wound more damage for 3 turns", weight: 1, cost: 2, effect: { type: "wound", amount: 1, turns: 3 } },
  { id: "bleed-1", text: "Deal 1 damage every turn for 3 turns", weight: 1, cost: 1, effect: { type: "bleed", damage: 1, turns: 3 } },
  { id: "stun", text: "“Stun”", weight: 1, cost: 2, effect: { type: "stun", turns: 1 } },
  { id: "death-spread", text: "Apply Death Spread status for 3 turns. If the afflicted character dies, spread all debuffs to 1 random character, including Death Spread", weight: 1, cost: 3, effect: { type: "death-spread", turns: 3 } },
  { id: "weaken", text: "Reduce target’s attack by 1 damage for 3 turns", weight: 1, cost: 1, effect: { type: "weaken", amount: 1, turns: 3 } },
  { id: "mark-target", text: "Increase “attack” against target by 1 damage for 3 turns", weight: 1, cost: 1, effect: { type: "mark", amount: 1, turns: 3 } },
  { id: "gain-energy-1", text: "Gain 1 energy", weight: 1, cost: 0, effect: { type: "gain-energy", amount: 1 } },
  { id: "gain-energy-2", text: "Gain 2 energy", weight: 1, cost: 0, effect: { type: "gain-energy", amount: 2 } },
  { id: "gain-energy-50", text: "50% chance to gain 1 energy", weight: 3, cost: 0, effect: { type: "gain-energy-chance", amount: 1, chance: 0.5 } },
  { id: "spread-debuffs", text: "Spread all debuffs to adjacent targets", weight: 1, cost: 2, effect: { type: "spread-debuffs" } },
  { id: "draw-disable", text: "Draw 1 card; adjacent mod is disabled", weight: 1, cost: 1, effect: { type: "draw-disable", draw: 1 } },
  { id: "draw-discard", text: "Draw 1 card and discard 1 card", weight: 1, cost: 1, effect: { type: "draw-discard", draw: 1, discard: 1 } },
  { id: "replay", text: "Play the card again 1 time", weight: 1, cost: 3, effect: { type: "replay", times: 1 } },
];

function findModDefinition(modText) {
  return MOD_POOL.find((entry) => entry.text === modText) || null;
}
