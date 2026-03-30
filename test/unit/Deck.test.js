// ============================================================
// FILE: test/unit/Deck.test.js
// ============================================================

const Deck = require('../../Srcs/server/models/Deck');

function buildCards(ids) {
  return ids.map((id) => ({ id }));
}

describe('Deck', () => {
  test('shuffle changes card order from original', () => {
    const deck = new Deck('hero', buildCards([1, 2, 3, 4]));
    const originalOrder = deck.cards.map((card) => card.id);

    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);

    deck.shuffle();

    const shuffledOrder = deck.cards.map((card) => card.id);

    expect(shuffledOrder).not.toEqual(originalOrder);

    randomSpy.mockRestore();
  });

  test('draw returns top card and reduces size by one', () => {
    const deck = new Deck('hero', buildCards([10, 11]));

    const first = deck.draw();

    expect(first).toEqual({ id: 10 });
    expect(deck.size).toBe(1);
  });

  test('draw on empty deck returns null', () => {
    const deck = new Deck('hero', []);

    expect(deck.draw()).toBeNull();
  });

  test('peek returns top n cards without removing them', () => {
    const deck = new Deck('monster', buildCards([21, 22, 23, 24]));

    const topTwo = deck.peek(2);

    expect(topTwo).toEqual([{ id: 21 }, { id: 22 }]);
    expect(deck.size).toBe(4);
  });

  test('size getter returns remaining cards count', () => {
    const deck = new Deck('monster', buildCards([31, 32, 33]));

    expect(deck.size).toBe(3);
    deck.draw();
    expect(deck.size).toBe(2);
  });
});
