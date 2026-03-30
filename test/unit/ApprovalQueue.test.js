// ============================================================
// FILE: test/unit/ApprovalQueue.test.js
// ============================================================

const ApprovalQueue = require('../../Srcs/server/game/ApprovalQueue');

describe('ApprovalQueue', () => {
  test('enqueue then approve calls onApproved callback', () => {
    const io = { emit: jest.fn() };
    const queue = new ApprovalQueue(io);

    const onApproved = jest.fn();
    const onDenied = jest.fn();

    queue.enqueue(
      {
        actionId: 'a1',
        type: 'DRAW_HERO',
        requesterId: 'p1',
        requesterNickname: 'Alice',
        payload: {},
        details: 'draw hero'
      },
      onApproved,
      onDenied
    );

    queue.approve('a1', 'p2', 'Bob');

    expect(onApproved).toHaveBeenCalledTimes(1);
    expect(onDenied).not.toHaveBeenCalled();
  });

  test('enqueue then deny calls onDenied callback', () => {
    const io = { emit: jest.fn() };
    const queue = new ApprovalQueue(io);

    const onApproved = jest.fn();
    const onDenied = jest.fn();

    queue.enqueue(
      {
        actionId: 'a2',
        type: 'DRAW_HERO',
        requesterId: 'p1',
        requesterNickname: 'Alice',
        payload: {},
        details: 'draw hero'
      },
      onApproved,
      onDenied
    );

    queue.deny('a2', 'p2', 'Bob');

    expect(onDenied).toHaveBeenCalledTimes(1);
    expect(onApproved).not.toHaveBeenCalled();
  });

  test('deny does not call onApproved callback', () => {
    const io = { emit: jest.fn() };
    const queue = new ApprovalQueue(io);

    const onApproved = jest.fn();
    const onDenied = jest.fn();

    queue.enqueue(
      {
        actionId: 'a3',
        type: 'DRAW_HERO',
        requesterId: 'p1',
        requesterNickname: 'Alice',
        payload: {},
        details: 'draw hero'
      },
      onApproved,
      onDenied
    );

    queue.deny('a3', 'p2', 'Bob');

    expect(onApproved).not.toHaveBeenCalled();
    expect(onDenied).toHaveBeenCalledTimes(1);
  });

  test('timeout after 30 seconds auto-denies', () => {
    jest.useFakeTimers();

    const io = { emit: jest.fn() };
    const queue = new ApprovalQueue(io);

    const onApproved = jest.fn();
    const onDenied = jest.fn();

    queue.enqueue(
      {
        actionId: 'a4',
        type: 'DRAW_HERO',
        requesterId: 'p1',
        requesterNickname: 'Alice',
        payload: {},
        details: 'draw hero'
      },
      onApproved,
      onDenied
    );

    jest.advanceTimersByTime(30001);

    expect(onDenied).toHaveBeenCalledTimes(1);
    expect(onApproved).not.toHaveBeenCalled();

    jest.useRealTimers();
  });

  test('second enqueue while first pending emits requester error and is not queued', () => {
    const io = { emit: jest.fn() };
    io.to = jest.fn(() => ({ emit: jest.fn() }));
    const queue = new ApprovalQueue(io);

    const firstApproved = jest.fn();
    const secondApproved = jest.fn();
    const requesterSocket = 'socket-1';

    queue.enqueue(
      {
        actionId: 'a5',
        type: 'DRAW_HERO',
        requesterId: 'p1',
        requesterSocketId: requesterSocket,
        requesterNickname: 'Alice',
        payload: {},
        details: 'first action'
      },
      firstApproved,
      jest.fn()
    );

    const secondResult = queue.enqueue(
      {
        actionId: 'a6',
        type: 'DRAW_HERO',
        requesterId: 'p1',
        requesterSocketId: requesterSocket,
        requesterNickname: 'Alice',
        payload: {},
        details: 'second action'
      },
      secondApproved,
      jest.fn()
    );

    const requesterChannel = io.to.mock.results[0].value;

    expect(queue.current.action.actionId).toBe('a5');
    expect(queue.queue).toHaveLength(0);
    expect(secondResult).toBeNull();
    expect(io.to).toHaveBeenCalledWith(requesterSocket);
    expect(requesterChannel.emit).toHaveBeenCalledWith('error', {
      message: 'An approval request is already pending. Please wait.'
    });

    queue.approve('a5', 'p2', 'Bob');

    expect(firstApproved).toHaveBeenCalledTimes(1);
    expect(secondApproved).not.toHaveBeenCalled();
    expect(queue.current).toBeNull();
  });

  test('enqueue emits approval_pending and resolve emits approval_pending_cleared', () => {
    const io = { emit: jest.fn() };
    const queue = new ApprovalQueue(io);

    queue.enqueue(
      {
        actionId: 'a7',
        type: 'DRAW_HERO',
        requesterId: 'p1',
        requesterNickname: 'Alice',
        payload: {},
        details: 'draw hero'
      },
      jest.fn(),
      jest.fn()
    );

    expect(io.emit).toHaveBeenCalledWith('approval_pending', {
      actionId: 'a7',
      type: 'DRAW_HERO',
      requesterId: 'p1',
      requesterNickname: 'Alice',
      details: 'draw hero'
    });

    queue.approve('a7', 'p2', 'Bob');

    expect(io.emit).toHaveBeenCalledWith('approval_pending_cleared');
  });
});
