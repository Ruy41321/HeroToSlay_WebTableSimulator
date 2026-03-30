// ============================================================
// FILE: test/unit/Player.test.js
// ============================================================

const Player = require('../../Srcs/server/models/Player');

describe('Player', () => {
  test('sets id, nickname, and socketId from constructor', () => {
    const player = new Player('player-1', 'Luigi', 'socket-abc');

    expect(player.id).toBe('player-1');
    expect(player.nickname).toBe('Luigi');
    expect(player.socketId).toBe('socket-abc');
  });

  test('hand defaults to empty array', () => {
    const player = new Player('id', 'nick', 'socket');

    expect(Array.isArray(player.hand)).toBe(true);
    expect(player.hand).toEqual([]);
  });

  test('board defaults to empty array', () => {
    const player = new Player('id', 'nick', 'socket');

    expect(Array.isArray(player.board)).toBe(true);
    expect(player.board).toEqual([]);
  });
});
