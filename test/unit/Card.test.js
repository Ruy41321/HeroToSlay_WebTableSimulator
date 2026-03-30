// ============================================================
// FILE: test/unit/Card.test.js
// ============================================================

const Card = require('../../Srcs/server/models/Card');

describe('Card', () => {
  test('sets id, name, type, and path from constructor arguments', () => {
    const card = new Card(7, 'Knight', 'hero', '/Assets/Cards/Heroes/knight.png');

    expect(card.id).toBe(7);
    expect(card.name).toBe('Knight');
    expect(card.type).toBe('hero');
    expect(card.path).toBe('/Assets/Cards/Heroes/knight.png');
  });

  test('defaults isFaceUp to false', () => {
    const card = new Card(1, 'Test', 'hero', '/path.png');

    expect(card.isFaceUp).toBe(false);
  });

  test('defaults ownerId to null', () => {
    const card = new Card(1, 'Test', 'hero', '/path.png');

    expect(card.ownerId).toBeNull();
  });
});
