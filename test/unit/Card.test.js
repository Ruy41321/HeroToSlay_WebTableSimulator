// ============================================================
// FILE: test/unit/Card.test.js
// ============================================================

const Card = require('../../Srcs/server/models/Card');

describe('Card', () => {
  test('sets id, name, type, and path from constructor arguments', () => {
    const card = new Card(7, 'Knight', 'DeckCards', '/Assets/Cards/Deck/knight.png');

    expect(card.id).toBe(7);
    expect(card.name).toBe('Knight');
    expect(card.type).toBe('DeckCards');
    expect(card.path).toBe('/Assets/Cards/Deck/knight.png');
  });

  test('defaults isFaceUp to false', () => {
    const card = new Card(1, 'Test', 'DeckCards', '/path.png');

    expect(card.isFaceUp).toBe(false);
  });

  test('defaults ownerId to null', () => {
    const card = new Card(1, 'Test', 'DeckCards', '/path.png');

    expect(card.ownerId).toBeNull();
  });
});
