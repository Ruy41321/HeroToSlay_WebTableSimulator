// ============================================================
// FILE: test/unit/GameManager.test.js
// ============================================================

const GameManager = require('../../Srcs/server/game/GameManager');
const Player = require('../../Srcs/server/models/Player');

function buildCards() {
  return [
    { id: 1, name: 'Hero 1', type: 'hero', path: '/Assets/Cards/Heroes/h1.png' },
    { id: 2, name: 'Hero 2', type: 'hero', path: '/Assets/Cards/Heroes/h2.png' },
    { id: 3, name: 'Monster 1', type: 'monster', path: '/Assets/Cards/Monsters/m1.png' },
    { id: 4, name: 'Monster 2', type: 'monster', path: '/Assets/Cards/Monsters/m2.png' },
    { id: 5, name: 'Main Hero 1', type: 'mainhero', path: '/Assets/Cards/MainHeroes/mh1.png' }
  ];
}

function buildIoMock() {
  return {
    emit: jest.fn(),
    to: jest.fn(() => ({ emit: jest.fn() }))
  };
}

describe('GameManager', () => {
  beforeEach(() => {
    GameManager.instance = null;
  });

  test("startGame transitions phase from 'lobby' to 'playing'", () => {
    const io = buildIoMock();
    const manager = new GameManager(io, buildCards());
    const players = [new Player('p1', 'Alice', 's1'), new Player('p2', 'Bob', 's2')];

    expect(manager.getState().phase).toBe('lobby');

    manager.startGame(players);

    expect(manager.getState().phase).toBe('playing');
  });

  test('getStateForPlayer stubs other players hand cards and hides name/path', () => {
    const io = buildIoMock();
    const manager = new GameManager(io, buildCards());
    const players = [new Player('p1', 'Alice', 's1'), new Player('p2', 'Bob', 's2')];

    manager.startGame(players);

    manager.state.players[1].hand.push({
      id: 101,
      name: 'Secret Hero',
      type: 'hero',
      path: '/secret.png',
      isFaceUp: false,
      ownerId: 'p2'
    });

    const stateForP1 = manager.getStateForPlayer('p1');
    const p2 = stateForP1.players.find((player) => player.id === 'p2');

    expect(p2.hand).toHaveLength(1);
    expect(p2.hand[0]).toEqual({
      id: 101,
      isFaceUp: false,
      ownerId: 'p2'
    });
    expect(p2.hand[0].name).toBeUndefined();
    expect(p2.hand[0].path).toBeUndefined();
  });

  test('getStateForPlayer does not stub local player hand cards', () => {
    const io = buildIoMock();
    const manager = new GameManager(io, buildCards());
    const players = [new Player('p1', 'Alice', 's1'), new Player('p2', 'Bob', 's2')];

    manager.startGame(players);

    manager.state.players[0].hand.push({
      id: 202,
      name: 'Visible Hero',
      type: 'hero',
      path: '/visible.png',
      isFaceUp: false,
      ownerId: 'p1'
    });

    const stateForP1 = manager.getStateForPlayer('p1');
    const p1 = stateForP1.players.find((player) => player.id === 'p1');

    expect(p1.hand[0].name).toBe('Visible Hero');
    expect(p1.hand[0].path).toBe('/visible.png');
  });

  test('pushHistory and undo restore previous state deeply', () => {
    const io = buildIoMock();
    const manager = new GameManager(io, buildCards());
    const players = [new Player('p1', 'Alice', 's1'), new Player('p2', 'Bob', 's2')];

    manager.startGame(players);

    const baseline = manager.getState();

    manager.pushHistory();
    manager.state.phase = 'ended';
    manager.state.players[0].nickname = 'ChangedName';

    const didUndo = manager.undo();

    expect(didUndo).toBe(true);
    expect(manager.getState()).toEqual(baseline);
  });

  test('undo with empty history does nothing and does not throw', () => {
    const io = buildIoMock();
    const manager = new GameManager(io, buildCards());

    expect(() => manager.undo()).not.toThrow();
    expect(manager.undo()).toBe(false);
  });

  test('toggleApprovalMode flips approvalMode boolean', () => {
    const io = buildIoMock();
    const manager = new GameManager(io, buildCards());

    const initial = manager.getState().approvalMode;
    const toggled = manager.toggleApprovalMode();

    expect(toggled).toBe(!initial);
    expect(manager.getState().approvalMode).toBe(!initial);
  });

  test('TAKE_FROM_DISCARD moves selected card from discardPile to requester hand', () => {
    const io = buildIoMock();
    const manager = new GameManager(io, buildCards());
    const players = [new Player('p1', 'Alice', 's1'), new Player('p2', 'Bob', 's2')];

    manager.startGame(players);

    manager.state.discardPile = [
      { id: 'd1', name: 'Discard 1', type: 'hero', path: '/d1.png', isFaceUp: true, ownerId: null },
      { id: 'd2', name: 'Discard 2', type: 'hero', path: '/d2.png', isFaceUp: true, ownerId: null },
      { id: 'd3', name: 'Discard 3', type: 'hero', path: '/d3.png', isFaceUp: true, ownerId: null }
    ];

    manager.executeAction(
      {
        type: 'TAKE_FROM_DISCARD',
        requesterId: 'p1',
        requesterNickname: 'Alice',
        payload: { cardId: 'd2' }
      },
      'AUTO',
      'AUTO'
    );

    const requester = manager.state.players.find((player) => player.id === 'p1');

    expect(requester.hand).toHaveLength(1);
    expect(requester.hand[0].id).toBe('d2');
    expect(requester.hand[0].ownerId).toBe('p1');
    expect(requester.hand[0].isFaceUp).toBe(true);
    expect(manager.state.discardPile.map((card) => card.id)).toEqual(['d1', 'd3']);
  });

  test('TAKE_FROM_DISCARD with invalid cardId does not mutate discardPile or hand', () => {
    const io = buildIoMock();
    const manager = new GameManager(io, buildCards());
    const players = [new Player('p1', 'Alice', 's1'), new Player('p2', 'Bob', 's2')];

    manager.startGame(players);

    manager.state.discardPile = [
      { id: 'd1', name: 'Discard 1', type: 'hero', path: '/d1.png', isFaceUp: true, ownerId: null }
    ];

    const discardBefore = manager.state.discardPile.map((card) => card.id);
    const requester = manager.state.players.find((player) => player.id === 'p1');
    const handBefore = requester.hand.length;

    manager.executeAction(
      {
        type: 'TAKE_FROM_DISCARD',
        requesterId: 'p1',
        requesterNickname: 'Alice',
        payload: { cardId: 'missing-card' }
      },
      'AUTO',
      'AUTO'
    );

    expect(manager.state.discardPile.map((card) => card.id)).toEqual(discardBefore);
    expect(requester.hand).toHaveLength(handBefore);
  });

  test('TAKE_FROM_DISCARD with empty discardPile does nothing and does not throw', () => {
    const io = buildIoMock();
    const manager = new GameManager(io, buildCards());
    const players = [new Player('p1', 'Alice', 's1'), new Player('p2', 'Bob', 's2')];

    manager.startGame(players);
    manager.state.discardPile = [];

    const requester = manager.state.players.find((player) => player.id === 'p1');
    const handBefore = requester.hand.length;

    expect(() => {
      manager.executeAction(
        {
          type: 'TAKE_FROM_DISCARD',
          requesterId: 'p1',
          requesterNickname: 'Alice',
          payload: { cardId: 'd1' }
        },
        'AUTO',
        'AUTO'
      );
    }).not.toThrow();

    expect(requester.hand).toHaveLength(handBefore);
    expect(manager.state.discardPile).toHaveLength(0);
  });

  test('TAKE_MAIN_HERO_TO_BOARD moves selected card from mainHeroDeck to requester board', () => {
    const io = buildIoMock();
    const manager = new GameManager(io, buildCards());
    const players = [new Player('p1', 'Alice', 's1'), new Player('p2', 'Bob', 's2')];

    manager.startGame(players);

    manager.state.mainHeroDeck = [
      {
        id: 'mh-1',
        name: 'MainHero 1',
        type: 'mainhero',
        path: '/Assets/Cards/MainHeroes/mh-1.png',
        isFaceUp: false,
        ownerId: null
      },
      {
        id: 'mh-2',
        name: 'MainHero 2',
        type: 'mainhero',
        path: '/Assets/Cards/MainHeroes/mh-2.png',
        isFaceUp: false,
        ownerId: null
      }
    ];

    manager.executeAction(
      {
        type: 'TAKE_MAIN_HERO_TO_BOARD',
        requesterId: 'p1',
        requesterNickname: 'Alice',
        payload: { cardId: 'mh-2' }
      },
      'AUTO',
      'AUTO'
    );

    const requester = manager.state.players.find((player) => player.id === 'p1');
    const takenCard = requester.board[requester.board.length - 1];

    expect(manager.state.mainHeroDeck.map((card) => String(card.id))).toEqual(['mh-1']);
    expect(takenCard.id).toBe('mh-2');
    expect(takenCard.type).toBe('mainhero');
    expect(takenCard.ownerId).toBe('p1');
    expect(takenCard.isFaceUp).toBe(true);
  });

  test('TAKE_MAIN_HERO_TO_BOARD with invalid cardId does not mutate mainHeroDeck or board', () => {
    const io = buildIoMock();
    const manager = new GameManager(io, buildCards());
    const players = [new Player('p1', 'Alice', 's1'), new Player('p2', 'Bob', 's2')];

    manager.startGame(players);

    manager.state.mainHeroDeck = [
      {
        id: 'mh-10',
        name: 'MainHero 10',
        type: 'mainhero',
        path: '/Assets/Cards/MainHeroes/mh-10.png',
        isFaceUp: false,
        ownerId: null
      }
    ];

    const requester = manager.state.players.find((player) => player.id === 'p1');
    requester.board = [
      { id: 'b1', name: 'Board Hero', type: 'hero', path: '/b1.png', isFaceUp: true, ownerId: 'p1' }
    ];

    const deckBefore = JSON.stringify(manager.state.mainHeroDeck);
    const boardBefore = JSON.stringify(requester.board);

    manager.executeAction(
      {
        type: 'TAKE_MAIN_HERO_TO_BOARD',
        requesterId: 'p1',
        requesterNickname: 'Alice',
        payload: { cardId: 'missing-mainhero' }
      },
      'AUTO',
      'AUTO'
    );

    expect(JSON.stringify(manager.state.mainHeroDeck)).toBe(deckBefore);
    expect(JSON.stringify(requester.board)).toBe(boardBefore);
  });

  test('RETURN_MAIN_HERO_TO_DECK moves selected mainhero from board to bottom of mainHeroDeck', () => {
    const io = buildIoMock();
    const manager = new GameManager(io, buildCards());
    const players = [new Player('p1', 'Alice', 's1'), new Player('p2', 'Bob', 's2')];

    manager.startGame(players);

    manager.state.mainHeroDeck = [
      {
        id: 'deck-mh-1',
        name: 'Deck MainHero 1',
        type: 'mainhero',
        path: '/Assets/Cards/MainHeroes/deck-mh-1.png',
        isFaceUp: false,
        ownerId: null
      }
    ];

    const requester = manager.state.players.find((player) => player.id === 'p1');
    requester.board = [
      {
        id: 'board-mainhero-1',
        name: 'Board MainHero 1',
        type: 'mainhero',
        path: '/Assets/Cards/MainHeroes/board-mainhero-1.png',
        isFaceUp: true,
        ownerId: 'p1'
      },
      { id: 'b-hero-1', name: 'Board Hero', type: 'hero', path: '/bhero.png', isFaceUp: true, ownerId: 'p1' }
    ];

    manager.executeAction(
      {
        type: 'RETURN_MAIN_HERO_TO_DECK',
        requesterId: 'p1',
        requesterNickname: 'Alice',
        payload: { cardId: 'board-mainhero-1' }
      },
      'AUTO',
      'AUTO'
    );

    expect(requester.board.map((card) => String(card.id))).toEqual(['b-hero-1']);
    expect(manager.state.mainHeroDeck.map((card) => String(card.id))).toEqual(['deck-mh-1', 'board-mainhero-1']);

    const returnedCard = manager.state.mainHeroDeck[manager.state.mainHeroDeck.length - 1];
    expect(returnedCard.type).toBe('mainhero');
    expect(returnedCard.ownerId).toBeNull();
    expect(returnedCard.isFaceUp).toBe(false);
  });

  test('RETURN_MAIN_HERO_TO_DECK with invalid cardId does not mutate mainHeroDeck or board', () => {
    const io = buildIoMock();
    const manager = new GameManager(io, buildCards());
    const players = [new Player('p1', 'Alice', 's1'), new Player('p2', 'Bob', 's2')];

    manager.startGame(players);

    manager.state.mainHeroDeck = [
      {
        id: 'deck-mh-5',
        name: 'Deck MainHero 5',
        type: 'mainhero',
        path: '/Assets/Cards/MainHeroes/deck-mh-5.png',
        isFaceUp: false,
        ownerId: null
      }
    ];

    const requester = manager.state.players.find((player) => player.id === 'p1');
    requester.board = [
      {
        id: 'board-mainhero-5',
        name: 'Board MainHero 5',
        type: 'mainhero',
        path: '/Assets/Cards/MainHeroes/board-mainhero-5.png',
        isFaceUp: true,
        ownerId: 'p1'
      }
    ];

    const deckBefore = JSON.stringify(manager.state.mainHeroDeck);
    const boardBefore = JSON.stringify(requester.board);

    manager.executeAction(
      {
        type: 'RETURN_MAIN_HERO_TO_DECK',
        requesterId: 'p1',
        requesterNickname: 'Alice',
        payload: { cardId: 'missing-mainhero' }
      },
      'AUTO',
      'AUTO'
    );

    expect(JSON.stringify(manager.state.mainHeroDeck)).toBe(deckBefore);
    expect(JSON.stringify(requester.board)).toBe(boardBefore);
  });

  test('ACTIVATE_CARD moves selected card from requester hand to requester board', () => {
    const io = buildIoMock();
    const manager = new GameManager(io, buildCards());
    const players = [new Player('p1', 'Alice', 's1'), new Player('p2', 'Bob', 's2')];

    manager.startGame(players);

    manager.state.players[0].hand = [
      { id: 'h1', name: 'Hero A', type: 'hero', path: '/h1.png', isFaceUp: true, ownerId: 'p1' },
      { id: 'h2', name: 'Hero B', type: 'hero', path: '/h2.png', isFaceUp: true, ownerId: 'p1' }
    ];
    manager.state.players[0].board = [];

    manager.executeAction(
      {
        type: 'ACTIVATE_CARD',
        requesterId: 'p1',
        requesterNickname: 'Alice',
        payload: { cardId: 'h2' }
      },
      'AUTO',
      'AUTO'
    );

    const requester = manager.state.players.find((player) => player.id === 'p1');

    expect(requester.hand.map((card) => card.id)).toEqual(['h1']);
    expect(requester.board.map((card) => card.id)).toEqual(['h2']);
    expect(requester.board[0].ownerId).toBe('p1');
  });

  test('ACTIVATE_CARD with missing cardId does not mutate hand or board', () => {
    const io = buildIoMock();
    const manager = new GameManager(io, buildCards());
    const players = [new Player('p1', 'Alice', 's1'), new Player('p2', 'Bob', 's2')];

    manager.startGame(players);

    manager.state.players[0].hand = [
      { id: 'h1', name: 'Hero A', type: 'hero', path: '/h1.png', isFaceUp: true, ownerId: 'p1' }
    ];
    manager.state.players[0].board = [
      { id: 'b1', name: 'Board A', type: 'hero', path: '/b1.png', isFaceUp: true, ownerId: 'p1' }
    ];

    manager.executeAction(
      {
        type: 'ACTIVATE_CARD',
        requesterId: 'p1',
        requesterNickname: 'Alice',
        payload: {}
      },
      'AUTO',
      'AUTO'
    );

    const requester = manager.state.players.find((player) => player.id === 'p1');

    expect(requester.hand.map((card) => card.id)).toEqual(['h1']);
    expect(requester.board.map((card) => card.id)).toEqual(['b1']);
  });

  test('RETURN_CARD_TO_HAND moves selected card from requester board to requester hand', () => {
    const io = buildIoMock();
    const manager = new GameManager(io, buildCards());
    const players = [new Player('p1', 'Alice', 's1'), new Player('p2', 'Bob', 's2')];

    manager.startGame(players);

    manager.state.players[0].hand = [
      { id: 'h1', name: 'Hero A', type: 'hero', path: '/h1.png', isFaceUp: true, ownerId: 'p1' }
    ];
    manager.state.players[0].board = [
      { id: 'b1', name: 'Board A', type: 'hero', path: '/b1.png', isFaceUp: true, ownerId: 'p1' },
      { id: 'b2', name: 'Board B', type: 'hero', path: '/b2.png', isFaceUp: true, ownerId: 'p1' }
    ];

    manager.executeAction(
      {
        type: 'RETURN_CARD_TO_HAND',
        requesterId: 'p1',
        requesterNickname: 'Alice',
        payload: { cardId: 'b1' }
      },
      'AUTO',
      'AUTO'
    );

    const requester = manager.state.players.find((player) => player.id === 'p1');

    expect(requester.board.map((card) => card.id)).toEqual(['b2']);
    expect(requester.hand.map((card) => card.id)).toEqual(['h1', 'b1']);
    expect(requester.hand[1].ownerId).toBe('p1');
  });

  test('RETURN_CARD_TO_HAND with invalid cardId does not mutate hand or board', () => {
    const io = buildIoMock();
    const manager = new GameManager(io, buildCards());
    const players = [new Player('p1', 'Alice', 's1'), new Player('p2', 'Bob', 's2')];

    manager.startGame(players);

    manager.state.players[0].hand = [
      { id: 'h1', name: 'Hero A', type: 'hero', path: '/h1.png', isFaceUp: true, ownerId: 'p1' }
    ];
    manager.state.players[0].board = [
      { id: 'b1', name: 'Board A', type: 'hero', path: '/b1.png', isFaceUp: true, ownerId: 'p1' }
    ];

    manager.executeAction(
      {
        type: 'RETURN_CARD_TO_HAND',
        requesterId: 'p1',
        requesterNickname: 'Alice',
        payload: { cardId: 'missing-card' }
      },
      'AUTO',
      'AUTO'
    );

    const requester = manager.state.players.find((player) => player.id === 'p1');

    expect(requester.hand.map((card) => card.id)).toEqual(['h1']);
    expect(requester.board.map((card) => card.id)).toEqual(['b1']);
  });

  test('RETURN_ACTIVE_MONSTER_TO_BOTTOM removes selected active monster and appends it face-down to deck', () => {
    const io = buildIoMock();
    const manager = new GameManager(io, buildCards());
    const players = [new Player('p1', 'Alice', 's1'), new Player('p2', 'Bob', 's2')];

    manager.startGame(players);

    manager.state.activeMonsters = [
      { id: 'am-1', name: 'Active 1', type: 'monster', path: '/am1.png', isFaceUp: true, ownerId: 'p1' },
      { id: 'am-2', name: 'Active 2', type: 'monster', path: '/am2.png', isFaceUp: true, ownerId: null },
      null
    ];
    manager.state.monsterDeck = [
      { id: 'deck-1', name: 'Deck 1', type: 'monster', path: '/d1.png', isFaceUp: false, ownerId: null }
    ];

    manager.executeAction(
      {
        type: 'RETURN_ACTIVE_MONSTER_TO_BOTTOM',
        requesterId: 'p1',
        requesterNickname: 'Alice',
        payload: { cardId: 'am-1' }
      },
      'AUTO',
      'AUTO'
    );

    expect(manager.state.activeMonsters[0]).toBeNull();
    expect(manager.state.activeMonsters[1].id).toBe('am-2');
    expect(manager.state.monsterDeck.map((card) => card.id)).toEqual(['deck-1', 'am-1']);

    const returnedCard = manager.state.monsterDeck[manager.state.monsterDeck.length - 1];
    expect(returnedCard.ownerId).toBeNull();
    expect(returnedCard.isFaceUp).toBe(false);
  });

  test('RETURN_ACTIVE_MONSTER_TO_BOTTOM with invalid cardId does not mutate activeMonsters or monsterDeck', () => {
    const io = buildIoMock();
    const manager = new GameManager(io, buildCards());
    const players = [new Player('p1', 'Alice', 's1'), new Player('p2', 'Bob', 's2')];

    manager.startGame(players);

    manager.state.activeMonsters = [
      { id: 'am-3', name: 'Active 3', type: 'monster', path: '/am3.png', isFaceUp: true, ownerId: null },
      null,
      null
    ];
    manager.state.monsterDeck = [
      { id: 'deck-2', name: 'Deck 2', type: 'monster', path: '/d2.png', isFaceUp: false, ownerId: null }
    ];

    const activeBefore = JSON.stringify(manager.state.activeMonsters);
    const deckBefore = JSON.stringify(manager.state.monsterDeck);

    manager.executeAction(
      {
        type: 'RETURN_ACTIVE_MONSTER_TO_BOTTOM',
        requesterId: 'p1',
        requesterNickname: 'Alice',
        payload: { cardId: 'missing-active' }
      },
      'AUTO',
      'AUTO'
    );

    expect(JSON.stringify(manager.state.activeMonsters)).toBe(activeBefore);
    expect(JSON.stringify(manager.state.monsterDeck)).toBe(deckBefore);
  });

  test('RETURN_ACTIVE_MONSTER_TO_BOTTOM with empty selected slot does not mutate state', () => {
    const io = buildIoMock();
    const manager = new GameManager(io, buildCards());
    const players = [new Player('p1', 'Alice', 's1'), new Player('p2', 'Bob', 's2')];

    manager.startGame(players);

    manager.state.activeMonsters = [
      { id: 'am-4', name: 'Active 4', type: 'monster', path: '/am4.png', isFaceUp: true, ownerId: null },
      null,
      null
    ];
    manager.state.monsterDeck = [];

    const activeBefore = JSON.stringify(manager.state.activeMonsters);
    const deckBefore = JSON.stringify(manager.state.monsterDeck);

    manager.executeAction(
      {
        type: 'RETURN_ACTIVE_MONSTER_TO_BOTTOM',
        requesterId: 'p1',
        requesterNickname: 'Alice',
        payload: { slotIndex: 1 }
      },
      'AUTO',
      'AUTO'
    );

    expect(JSON.stringify(manager.state.activeMonsters)).toBe(activeBefore);
    expect(JSON.stringify(manager.state.monsterDeck)).toBe(deckBefore);
  });

  test('RETURN_ACTIVE_MONSTER_TO_BOTTOM inserts card when monsterDeck starts empty', () => {
    const io = buildIoMock();
    const manager = new GameManager(io, buildCards());
    const players = [new Player('p1', 'Alice', 's1'), new Player('p2', 'Bob', 's2')];

    manager.startGame(players);

    manager.state.activeMonsters = [
      null,
      { id: 'am-5', name: 'Active 5', type: 'monster', path: '/am5.png', isFaceUp: true, ownerId: 'p2' },
      null
    ];
    manager.state.monsterDeck = [];

    manager.executeAction(
      {
        type: 'RETURN_ACTIVE_MONSTER_TO_BOTTOM',
        requesterId: 'p1',
        requesterNickname: 'Alice',
        payload: { cardId: 'am-5' }
      },
      'AUTO',
      'AUTO'
    );

    expect(manager.state.activeMonsters[1]).toBeNull();
    expect(manager.state.monsterDeck).toHaveLength(1);
    expect(manager.state.monsterDeck[0].id).toBe('am-5');
    expect(manager.state.monsterDeck[0].ownerId).toBeNull();
    expect(manager.state.monsterDeck[0].isFaceUp).toBe(false);
  });
});
