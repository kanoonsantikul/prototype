"use strict";

function randomBetween(minimum, maximum) {
  return minimum + Math.random() * (maximum - minimum);
}

function distanceBetween(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function shuffled(items) {
  const result = [...items];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }

  return result;
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function weightedRandomItem(items, weightForItem) {
  const weights = items.map((item) => Math.max(0, Number(weightForItem(item)) || 0));
  const totalWeight = weights.reduce((total, weight) => total + weight, 0);

  if (totalWeight <= 0) return randomItem(items);

  let threshold = Math.random() * totalWeight;

  for (let index = 0; index < items.length; index += 1) {
    threshold -= weights[index];
    if (threshold <= 0) return items[index];
  }

  return items.at(-1);
}
