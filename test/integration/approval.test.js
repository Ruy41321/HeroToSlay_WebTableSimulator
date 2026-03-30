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
});
