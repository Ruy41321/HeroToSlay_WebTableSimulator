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
    { id: 4, name: 'Monster 2', type: 'monster', path: '/Assets/Cards/Monsters/m2.png' }
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
});
