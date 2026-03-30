// ============================================================
// FILE: server/models/Deck.js
// ============================================================

class Deck {
  constructor(type, cards = []) {
    this.type = type;
    this.cards = cards;
  }

  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  draw() {
    if (this.cards.length === 0) {
      return null;
    }

    return this.cards.shift();
  }

  peek(n) {
    return this.cards.slice(0, n);
  }

  get size() {
    return this.cards.length;
  }
}

module.exports = Deck;
