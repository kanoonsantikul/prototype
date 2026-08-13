"use strict";

const MOD_POOL = [
  { text: "“Attack” 1 dmg", weight: 5, cost: 1 },
  { text: "“Attack” 3 dmg", weight: 1, cost: 2 },
  { text: "“Attack” 2 random monsters", weight: 1, cost: 2 },
  { text: "“Attack” + 1 dmg for each mod with “Attack”", weight: 1, cost: 2 },

  { text: "“Repeat” the “Attack”", weight: 1, cost: 2 },
  { text: "Block 2 damage for 1 turn", weight: 1, cost: 1 },
  { text: "Block 1 damage for 3 turns", weight: 1, cost: 1 },
  { text: "“Critical”", weight: 1, cost: 1 },
  { text: "When attacked, deal 1 damage back", weight: 1, cost: 1 },
  { text: "Increase “attack” by 1 damage for 3 turns", weight: 1, cost: 2 },
  { text: "Increase “guard” by 1 damage for 3 turns", weight: 1, cost: 1 },
  { text: "Attacks deal x wound more damage for 3 turns", weight: 1, cost: 2 },
  { text: "Deal 1 damage every turn for 3 turns", weight: 1, cost: 1 },
  { text: "“Stun”", weight: 1, cost: 2 },
  { text: "Apply Death Spread status for 3 turns. If the afflicted character dies, spread all debuffs to 1 random character, including Death Spread", weight: 1, cost: 3 },
  { text: "Reduce target’s attack by 1 damage for 3 turns", weight: 1, cost: 1 },
  { text: "Increase “attack” against target by 1 damage for 3 turns", weight: 1, cost: 1 },
  { text: "Gain 1 energy", weight: 1, cost: 0 },
  { text: "Gain 2 energy", weight: 1, cost: 0 },
  { text: "50% chance to gain 1 energy", weight: 3, cost: 0 },
  { text: "Spread all debuffs to adjacent targets", weight: 1, cost: 2 },
  { text: "Draw 1 card; adjacent mod is disabled", weight: 1, cost: 1 },
  { text: "Draw 1 card and discard 1 card", weight: 1, cost: 1 },
  { text: "Play the card again 1 time", weight: 1, cost: 3 },
];
