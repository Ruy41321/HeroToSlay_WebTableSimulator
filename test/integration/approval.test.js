// ============================================================
// FILE: test/integration/approval.test.js
// ============================================================

const { app } = require('../../Srcs/server/server');
const http = require('http');
const { Server } = require('socket.io');
const { io: Client } = require('socket.io-client');

const cards = require('../../cards.json');
const GameManager = require('../../Srcs/server/game/GameManager');
const registerLobbyHandlers = require('../../Srcs/server/socket/lobbyHandlers');
const registerApprovalHandlers = require('../../Srcs/server/socket/approvalHandlers');
const registerGameHandlers = require('../../Srcs/server/socket/gameHandlers');

let httpServer;
let ioServer;
let clientSocket;
let sharedState;
const extraClients = [];

function waitForEvent(socket, eventName, timeoutMs = 3000, filter = null) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      socket.off(eventName, onEvent);
      reject(new Error(`Timed out waiting for ${eventName}`));
    }, timeoutMs);

    function onEvent(payload) {
      if (typeof filter === 'function' && !filter(payload)) {
        return;
      }

      clearTimeout(timeoutId);
      socket.off(eventName, onEvent);
      resolve(payload);
    }

    socket.on(eventName, onEvent);
  });
}

function waitForCondition(check, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    function tick() {
      if (check()) {
        resolve();
        return;
      }

      if (Date.now() - start > timeoutMs) {
        reject(new Error('Timed out waiting for condition'));
        return;
      }

      setTimeout(tick, 20);
    }

    tick();
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildSharedState(ioInstance) {
  GameManager.instance = null;

  const gameManager = new GameManager(ioInstance, cards);

  return {
    lobbyPlayers: [],
    gameInProgress: false,
    gameManager,
    buildLobbyPayload() {
      return {
        players: this.lobbyPlayers.map((player) => ({ id: player.id, nickname: player.nickname })),
        gameInProgress: this.gameInProgress
      };
    },
    broadcastLobbyUpdate() {
      ioInstance.emit('lobby_update', this.buildLobbyPayload());
    }
  };
}

function wireHandlers(ioInstance, state) {
  ioInstance.on('connection', (socket) => {
    socket.emit('lobby_update', state.buildLobbyPayload());

    registerLobbyHandlers(ioInstance, socket, state);
    registerGameHandlers(ioInstance, socket, state);
    registerApprovalHandlers(ioInstance, socket, state);
  });
}

async function createClient() {
  const { port } = httpServer.address();
  const client = new Client(`http://localhost:${port}`);
  extraClients.push(client);

  await waitForEvent(client, 'connect');

  return client;
}

async function setupTwoPlayerGame() {
  const requester = await createClient();
  const approver = await createClient();

  requester.emit('join_lobby', { nickname: 'Requester' });
  approver.emit('join_lobby', { nickname: 'Approver' });

  await waitForCondition(() => sharedState.lobbyPlayers.length === 2);

  const gameStartRequester = waitForEvent(requester, 'game_start');
  const gameStartApprover = waitForEvent(approver, 'game_start');

  requester.emit('start_game', {});

  const requesterStart = await gameStartRequester;
  const approverStart = await gameStartApprover;

  await waitForCondition(() => sharedState.gameInProgress === true);

  return {
    requester,
    approver,
    requesterId: requesterStart.yourPlayerId,
    approverId: approverStart.yourPlayerId
  };
}

beforeAll((done) => {
  httpServer = http.createServer(app);
  ioServer = new Server(httpServer);

  sharedState = buildSharedState(ioServer);
  wireHandlers(ioServer, sharedState);

  httpServer.listen(0, () => {
    const { port } = httpServer.address();
    clientSocket = new Client(`http://localhost:${port}`);
    clientSocket.on('connect', done);
  });
});

afterEach(() => {
  for (const client of extraClients.splice(0)) {
    if (client.connected) {
      client.disconnect();
    }
  }

  sharedState.gameManager.reset();
  sharedState.lobbyPlayers = [];
  sharedState.gameInProgress = false;
  sharedState.broadcastLobbyUpdate();
});

afterAll((done) => {
  clientSocket.disconnect();
  ioServer.close();
  httpServer.close(done);
});

describe('Approval integration', () => {
  test('with approvalMode ON, request_action sends approval_request to other players', async () => {
    const { requester, approver } = await setupTwoPlayerGame();

    const approvalRequestPromise = waitForEvent(approver, 'approval_request');

    requester.emit('request_action', {
      type: 'DRAW_HERO',
      payload: {}
    });

    const approvalRequest = await approvalRequestPromise;

    expect(approvalRequest.type).toBe('DRAW_HERO');
    expect(approvalRequest.actionId).toBeDefined();
  });

  test('pending approval blocks second request and broadcasts pending lifecycle to all clients', async () => {
    const { requester, approver } = await setupTwoPlayerGame();

    const requesterPendingPromise = waitForEvent(requester, 'approval_pending');
    const approverPendingPromise = waitForEvent(approver, 'approval_pending');

    requester.emit('request_action', {
      type: 'DRAW_HERO',
      payload: {}
    });

    const [requesterPending, approverPending] = await Promise.all([
      requesterPendingPromise,
      approverPendingPromise
    ]);

    expect(requesterPending.actionId).toBeDefined();
    expect(approverPending.actionId).toBe(requesterPending.actionId);
    expect(requesterPending.requesterNickname).toBe('Requester');

    const errorPromise = waitForEvent(
      requester,
      'error',
      4000,
      (payload) => payload && /already pending/i.test(payload.message)
    );

    requester.emit('request_action', {
      type: 'REVEAL_MONSTER',
      payload: {}
    });

    const errorPayload = await errorPromise;
    expect(errorPayload.message).toMatch(/already pending/i);

    const requesterClearedPromise = waitForEvent(requester, 'approval_pending_cleared');
    const approverClearedPromise = waitForEvent(approver, 'approval_pending_cleared');

    approver.emit('respond_approval', {
      actionId: requesterPending.actionId,
      decision: true
    });

    await Promise.all([requesterClearedPromise, approverClearedPromise]);
  });

  test('approve flow emits approval_result granted true to all clients', async () => {
    const { requester, approver } = await setupTwoPlayerGame();

    const approvalRequest = waitForEvent(approver, 'approval_request');

    requester.emit('request_action', {
      type: 'DRAW_HERO',
      payload: {}
    });

    const requestPayload = await approvalRequest;

    const requesterResultPromise = waitForEvent(
      requester,
      'approval_result',
      4000,
      (payload) => payload.actionId === requestPayload.actionId
    );
    const approverResultPromise = waitForEvent(
      approver,
      'approval_result',
      4000,
      (payload) => payload.actionId === requestPayload.actionId
    );

    approver.emit('respond_approval', {
      actionId: requestPayload.actionId,
      decision: true
    });

    const [requesterResult, approverResult] = await Promise.all([requesterResultPromise, approverResultPromise]);

    expect(requesterResult.granted).toBe(true);
    expect(approverResult.granted).toBe(true);
  });

  test('deny flow emits approval_result granted false to all clients', async () => {
    const { requester, approver } = await setupTwoPlayerGame();

    const approvalRequest = waitForEvent(approver, 'approval_request');

    requester.emit('request_action', {
      type: 'DRAW_HERO',
      payload: {}
    });

    const requestPayload = await approvalRequest;

    const requesterResultPromise = waitForEvent(
      requester,
      'approval_result',
      4000,
      (payload) => payload.actionId === requestPayload.actionId
    );
    const approverResultPromise = waitForEvent(
      approver,
      'approval_result',
      4000,
      (payload) => payload.actionId === requestPayload.actionId
    );

    approver.emit('respond_approval', {
      actionId: requestPayload.actionId,
      decision: false
    });

    const [requesterResult, approverResult] = await Promise.all([requesterResultPromise, approverResultPromise]);

    expect(requesterResult.granted).toBe(false);
    expect(approverResult.granted).toBe(false);
  });

  test('with approvalMode OFF, request_action executes immediately and emits no approval_request', async () => {
    const { requester, approver } = await setupTwoPlayerGame();

    const flippedStatePromise = waitForEvent(
      requester,
      'state_update',
      4000,
      (state) => state && state.approvalMode === false
    );

    requester.emit('toggle_approval', {});
    await flippedStatePromise;

    let approvalRequested = false;
    const onApprovalRequest = () => {
      approvalRequested = true;
    };

    approver.on('approval_request', onApprovalRequest);

    requester.emit('request_action', {
      type: 'DRAW_HERO',
      payload: {}
    });

    await delay(500);

    approver.off('approval_request', onApprovalRequest);

    expect(approvalRequested).toBe(false);
  });

  test('UNDO always triggers approval_request even when approvalMode is OFF', async () => {
    const { requester, approver } = await setupTwoPlayerGame();

    const flippedStatePromise = waitForEvent(
      requester,
      'state_update',
      4000,
      (state) => state && state.approvalMode === false
    );

    requester.emit('toggle_approval', {});
    await flippedStatePromise;

    const undoApprovalRequestPromise = waitForEvent(
      approver,
      'approval_request',
      4000,
      (payload) => payload && payload.type === 'UNDO'
    );

    requester.emit('request_action', {
      type: 'UNDO',
      payload: {}
    });

    const undoApprovalRequest = await undoApprovalRequestPromise;

    expect(undoApprovalRequest.type).toBe('UNDO');
    expect(undoApprovalRequest.actionId).toBeDefined();
  });

  test('TAKE_FROM_DISCARD with approvalMode ON requires approval and moves selected discard card', async () => {
    const { requester, approver, requesterId } = await setupTwoPlayerGame();

    sharedState.gameManager.state.discardPile = [
      {
        id: 'd1',
        name: 'Discard Hero 1',
        type: 'DeckCards',
        path: '/Assets/Cards/Deck/d1.png',
        isFaceUp: true,
        ownerId: null
      },
      {
        id: 'd2',
        name: 'Discard Hero 2',
        type: 'DeckCards',
        path: '/Assets/Cards/Deck/d2.png',
        isFaceUp: true,
        ownerId: null
      }
    ];

    const approvalRequestPromise = waitForEvent(
      approver,
      'approval_request',
      4000,
      (payload) => payload && payload.type === 'TAKE_FROM_DISCARD'
    );

    requester.emit('request_action', {
      type: 'TAKE_FROM_DISCARD',
      payload: { cardId: 'd1' }
    });

    const approvalRequest = await approvalRequestPromise;
    expect(approvalRequest.actionId).toBeDefined();
    expect(approvalRequest.details).toContain('d1');

    const updatedStatePromise = waitForEvent(requester, 'state_update', 4000, (state) => {
      if (!state || !Array.isArray(state.players)) {
        return false;
      }

      const local = state.players.find((player) => String(player.id) === String(requesterId));
      return Boolean(
        local &&
          Array.isArray(local.hand) &&
          local.hand.some((card) => String(card.id) === 'd1') &&
          Array.isArray(state.discardPile) &&
          state.discardPile.every((card) => String(card.id) !== 'd1')
      );
    });

    approver.emit('respond_approval', {
      actionId: approvalRequest.actionId,
      decision: true
    });

    const updatedState = await updatedStatePromise;
    const local = updatedState.players.find((player) => String(player.id) === String(requesterId));

    expect(local.hand.some((card) => String(card.id) === 'd1')).toBe(true);
    expect(updatedState.discardPile.map((card) => String(card.id))).toEqual(['d2']);
    expect(
      sharedState.gameManager.restrictedLog.getAll().some((entry) => entry.actionType === 'TAKE_FROM_DISCARD')
    ).toBe(true);
  });

  test('TAKE_FROM_DISCARD with approvalMode OFF executes immediately without approval_request', async () => {
    const { requester, approver, requesterId } = await setupTwoPlayerGame();

    const flippedStatePromise = waitForEvent(
      requester,
      'state_update',
      4000,
      (state) => state && state.approvalMode === false
    );

    requester.emit('toggle_approval', {});
    await flippedStatePromise;

    sharedState.gameManager.state.discardPile = [
      {
        id: 'd3',
        name: 'Discard Hero 3',
        type: 'DeckCards',
        path: '/Assets/Cards/Deck/d3.png',
        isFaceUp: true,
        ownerId: null
      }
    ];

    let approvalRequested = false;
    const onApprovalRequest = () => {
      approvalRequested = true;
    };

    approver.on('approval_request', onApprovalRequest);

    const updatedStatePromise = waitForEvent(requester, 'state_update', 4000, (state) => {
      if (!state || !Array.isArray(state.players)) {
        return false;
      }

      const local = state.players.find((player) => String(player.id) === String(requesterId));
      return Boolean(local && Array.isArray(local.hand) && local.hand.some((card) => String(card.id) === 'd3'));
    });

    requester.emit('request_action', {
      type: 'TAKE_FROM_DISCARD',
      payload: { cardId: 'd3' }
    });

    const updatedState = await updatedStatePromise;
    await delay(300);
    approver.off('approval_request', onApprovalRequest);

    const local = updatedState.players.find((player) => String(player.id) === String(requesterId));

    expect(approvalRequested).toBe(false);
    expect(local.hand.some((card) => String(card.id) === 'd3')).toBe(true);
    expect(updatedState.discardPile).toHaveLength(0);
  });

  test('TAKE_MAIN_HERO_TO_BOARD with approvalMode ON requires approval and moves selected card to requester board', async () => {
    const { requester, approver, requesterId } = await setupTwoPlayerGame();

    sharedState.gameManager.state.mainHeroDeck = [
      {
        id: 'mh-approval-on-1',
        name: 'MainHero Approval ON 1',
        type: 'MainHero',
        path: '/Assets/Cards/Heroes/mh-on-1.png',
        isFaceUp: false,
        ownerId: null
      },
      {
        id: 'mh-approval-on-2',
        name: 'MainHero Approval ON 2',
        type: 'MainHero',
        path: '/Assets/Cards/Heroes/mh-on-2.png',
        isFaceUp: false,
        ownerId: null
      }
    ];

    const approvalRequestPromise = waitForEvent(
      approver,
      'approval_request',
      4000,
      (payload) => payload && payload.type === 'TAKE_MAIN_HERO_TO_BOARD'
    );

    requester.emit('request_action', {
      type: 'TAKE_MAIN_HERO_TO_BOARD',
      payload: { cardId: 'mh-approval-on-1' }
    });

    const approvalRequest = await approvalRequestPromise;
    expect(approvalRequest.actionId).toBeDefined();
    expect(approvalRequest.details).toContain('mh-approval-on-1');

    const updatedStatePromise = waitForEvent(requester, 'state_update', 4000, (state) => {
      if (!state || !Array.isArray(state.players) || !Array.isArray(state.mainHeroDeck)) {
        return false;
      }

      const local = state.players.find((player) => String(player.id) === String(requesterId));
      return Boolean(
        local &&
          Array.isArray(local.board) &&
          local.board.some((card) => String(card.id) === 'mh-approval-on-1') &&
          state.mainHeroDeck.every((card) => String(card.id) !== 'mh-approval-on-1')
      );
    });

    approver.emit('respond_approval', {
      actionId: approvalRequest.actionId,
      decision: true
    });

    const updatedState = await updatedStatePromise;
    const local = updatedState.players.find((player) => String(player.id) === String(requesterId));
    const movedCard = local.board.find((card) => String(card.id) === 'mh-approval-on-1');

    expect(updatedState.mainHeroDeck.map((card) => String(card.id))).toEqual(['mh-approval-on-2']);
    expect(movedCard).toBeDefined();
    expect(movedCard.type).toBe('MainHero');
    expect(String(movedCard.ownerId)).toBe(String(requesterId));
    expect(movedCard.isFaceUp).toBe(true);
    expect(
      sharedState.gameManager.restrictedLog
        .getAll()
        .some((entry) => entry.actionType === 'TAKE_MAIN_HERO_TO_BOARD')
    ).toBe(true);
  });

  test('RETURN_MAIN_HERO_TO_DECK with approvalMode OFF executes immediately without approval_request', async () => {
    const { requester, approver, requesterId } = await setupTwoPlayerGame();

    const flippedStatePromise = waitForEvent(
      requester,
      'state_update',
      4000,
      (state) => state && state.approvalMode === false
    );

    requester.emit('toggle_approval', {});
    await flippedStatePromise;

    const requesterPlayer = sharedState.gameManager.state.players.find(
      (player) => String(player.id) === String(requesterId)
    );

    requesterPlayer.board = [
      {
        id: 'mh-approval-off-1',
        name: 'MainHero Approval OFF 1',
        type: 'MainHero',
        path: '/Assets/Cards/Heroes/mh-off-1.png',
        isFaceUp: true,
        ownerId: requesterId
      },
      {
        id: 'board-hero-off-1',
        name: 'Board Hero OFF 1',
        type: 'DeckCards',
        path: '/Assets/Cards/Deck/board-hero-off-1.png',
        isFaceUp: true,
        ownerId: requesterId
      }
    ];

    sharedState.gameManager.state.mainHeroDeck = [
      {
        id: 'mh-deck-off-1',
        name: 'MainHero Deck OFF 1',
        type: 'MainHero',
        path: '/Assets/Cards/Heroes/mh-deck-off-1.png',
        isFaceUp: false,
        ownerId: null
      }
    ];

    let approvalRequested = false;
    const onApprovalRequest = () => {
      approvalRequested = true;
    };

    approver.on('approval_request', onApprovalRequest);

    const updatedStatePromise = waitForEvent(requester, 'state_update', 4000, (state) => {
      if (!state || !Array.isArray(state.players) || !Array.isArray(state.mainHeroDeck)) {
        return false;
      }

      const local = state.players.find((player) => String(player.id) === String(requesterId));
      if (!local || !Array.isArray(local.board) || !Array.isArray(state.mainHeroDeck)) {
        return false;
      }

      const deckLast = state.mainHeroDeck[state.mainHeroDeck.length - 1];
      return (
        local.board.every((card) => String(card.id) !== 'mh-approval-off-1') &&
        deckLast &&
        String(deckLast.id) === 'mh-approval-off-1'
      );
    });

    requester.emit('request_action', {
      type: 'RETURN_MAIN_HERO_TO_DECK',
      payload: { cardId: 'mh-approval-off-1' }
    });

    const updatedState = await updatedStatePromise;
    await delay(300);
    approver.off('approval_request', onApprovalRequest);

    const local = updatedState.players.find((player) => String(player.id) === String(requesterId));
    const returnedCard = updatedState.mainHeroDeck[updatedState.mainHeroDeck.length - 1];

    expect(approvalRequested).toBe(false);
    expect(local.board.map((card) => String(card.id))).toEqual(['board-hero-off-1']);
    expect(updatedState.mainHeroDeck.map((card) => String(card.id))).toEqual([
      'mh-deck-off-1',
      'mh-approval-off-1'
    ]);
    expect(returnedCard.type).toBe('MainHero');
    expect(returnedCard.ownerId).toBeNull();
    expect(returnedCard.isFaceUp).toBe(false);
    expect(
      sharedState.gameManager.restrictedLog
        .getAll()
        .some((entry) => entry.actionType === 'RETURN_MAIN_HERO_TO_DECK')
    ).toBe(true);
  });

  test('RETURN_ACTIVE_MONSTER_TO_BOTTOM with approvalMode ON requires approval and updates active/deck state', async () => {
    const { requester, approver } = await setupTwoPlayerGame();

    sharedState.gameManager.state.activeMonsters = [
      {
        id: 'am-10',
        name: 'Active Monster 10',
        type: 'Monsters',
        path: '/Assets/Cards/Monsters/am10.png',
        isFaceUp: true,
        ownerId: 'p1'
      },
      null,
      null
    ];
    sharedState.gameManager.state.monsterDeck = [
      {
        id: 'deck-10',
        name: 'Deck Monster 10',
        type: 'Monsters',
        path: '/Assets/Cards/Monsters/d10.png',
        isFaceUp: false,
        ownerId: null
      }
    ];

    const approvalRequestPromise = waitForEvent(
      approver,
      'approval_request',
      4000,
      (payload) => payload && payload.type === 'RETURN_ACTIVE_MONSTER_TO_BOTTOM'
    );

    requester.emit('request_action', {
      type: 'RETURN_ACTIVE_MONSTER_TO_BOTTOM',
      payload: { cardId: 'am-10' }
    });

    const approvalRequest = await approvalRequestPromise;
    expect(approvalRequest.actionId).toBeDefined();
    expect(approvalRequest.details).toContain('am-10');

    const updatedStatePromise = waitForEvent(requester, 'state_update', 4000, (state) => {
      if (!state || !Array.isArray(state.activeMonsters) || !Array.isArray(state.monsterDeck)) {
        return false;
      }

      const activeIds = state.activeMonsters.filter(Boolean).map((card) => String(card.id));
      const deckLast = state.monsterDeck[state.monsterDeck.length - 1];

      return !activeIds.includes('am-10') && deckLast && String(deckLast.id) === 'am-10';
    });

    approver.emit('respond_approval', {
      actionId: approvalRequest.actionId,
      decision: true
    });

    const updatedState = await updatedStatePromise;
    const returnedCard = updatedState.monsterDeck[updatedState.monsterDeck.length - 1];

    expect(updatedState.activeMonsters[0]).toBeNull();
    expect(returnedCard.id).toBe('am-10');
    expect(returnedCard.ownerId).toBeNull();
    expect(returnedCard.isFaceUp).toBe(false);
    expect(
      sharedState.gameManager.restrictedLog
        .getAll()
        .some((entry) => entry.actionType === 'RETURN_ACTIVE_MONSTER_TO_BOTTOM')
    ).toBe(true);
  });

  test('RETURN_ACTIVE_MONSTER_TO_BOTTOM with approvalMode OFF executes immediately without approval_request', async () => {
    const { requester, approver } = await setupTwoPlayerGame();

    const flippedStatePromise = waitForEvent(
      requester,
      'state_update',
      4000,
      (state) => state && state.approvalMode === false
    );

    requester.emit('toggle_approval', {});
    await flippedStatePromise;

    sharedState.gameManager.state.activeMonsters = [
      null,
      {
        id: 'am-20',
        name: 'Active Monster 20',
        type: 'Monsters',
        path: '/Assets/Cards/Monsters/am20.png',
        isFaceUp: true,
        ownerId: 'p2'
      },
      null
    ];
    sharedState.gameManager.state.monsterDeck = [];

    let approvalRequested = false;
    const onApprovalRequest = () => {
      approvalRequested = true;
    };

    approver.on('approval_request', onApprovalRequest);

    const updatedStatePromise = waitForEvent(requester, 'state_update', 4000, (state) => {
      if (!state || !Array.isArray(state.activeMonsters) || !Array.isArray(state.monsterDeck)) {
        return false;
      }

      const returned = state.monsterDeck[0];
      return state.activeMonsters[1] === null && returned && String(returned.id) === 'am-20';
    });

    requester.emit('request_action', {
      type: 'RETURN_ACTIVE_MONSTER_TO_BOTTOM',
      payload: { cardId: 'am-20' }
    });

    const updatedState = await updatedStatePromise;
    await delay(300);
    approver.off('approval_request', onApprovalRequest);

    expect(approvalRequested).toBe(false);
    expect(updatedState.activeMonsters[1]).toBeNull();
    expect(updatedState.monsterDeck).toHaveLength(1);
    expect(updatedState.monsterDeck[0].id).toBe('am-20');
    expect(updatedState.monsterDeck[0].ownerId).toBeNull();
    expect(updatedState.monsterDeck[0].isFaceUp).toBe(false);
    expect(
      sharedState.gameManager.restrictedLog
        .getAll()
        .some((entry) => entry.actionType === 'RETURN_ACTIVE_MONSTER_TO_BOTTOM')
    ).toBe(true);
  });
});
