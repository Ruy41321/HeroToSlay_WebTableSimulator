// ============================================================
// FILE: server/models/Card.js
// ============================================================

class Card {
  constructor(id, name, type, path) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.path = path;
    this.isFaceUp = false;
    this.ownerId = null;
    this.boardPosition = null;
  }
}

module.exports = Card;
