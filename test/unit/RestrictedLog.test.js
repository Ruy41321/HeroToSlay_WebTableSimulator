// ============================================================
// FILE: test/unit/RestrictedLog.test.js
// ============================================================

const RestrictedLog = require('../../Srcs/server/game/RestrictedLog');

describe('RestrictedLog', () => {
  test('append adds an entry to the log', () => {
    const log = new RestrictedLog();

    log.append({
      timestamp: '2026-03-30T10:00:00.000Z',
      playerNickname: 'Alice',
      actionType: 'DRAW_HERO',
      details: 'draw from hero deck',
      approvedBy: 'Bob'
    });

    expect(log.getAll()).toHaveLength(1);
  });

  test('getAll returns all entries in insertion order', () => {
    const log = new RestrictedLog();

    log.append({
      timestamp: '2026-03-30T10:00:00.000Z',
      playerNickname: 'Alice',
      actionType: 'DRAW_HERO',
      details: 'draw from hero deck',
      approvedBy: 'Bob'
    });

    log.append({
      timestamp: '2026-03-30T10:01:00.000Z',
      playerNickname: 'Bob',
      actionType: 'UNDO',
      details: 'reverted action',
      approvedBy: 'Carol'
    });

    const entries = log.getAll();

    expect(entries).toHaveLength(2);
    expect(entries[0].playerNickname).toBe('Alice');
    expect(entries[1].playerNickname).toBe('Bob');
  });

  test('clear resets entries to an empty array', () => {
    const log = new RestrictedLog();

    log.append({
      timestamp: '2026-03-30T10:00:00.000Z',
      playerNickname: 'Alice',
      actionType: 'DRAW_HERO',
      details: 'draw from hero deck',
      approvedBy: 'Bob'
    });

    log.clear();

    expect(log.getAll()).toEqual([]);
  });
});
