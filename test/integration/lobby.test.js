// ============================================================
// FILE: test/integration/lobby.test.js
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

async function joinLobby(client, nickname) {
  client.emit('join_lobby', { nickname });
  await waitForCondition(() => sharedState.lobbyPlayers.some((player) => player.nickname === nickname));
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

describe('Lobby integration', () => {
  test('a 5th player joining receives an error event', async () => {
    const clients = await Promise.all([createClient(), createClient(), createClient(), createClient(), createClient()]);

    await joinLobby(clients[0], 'P1');
    await joinLobby(clients[1], 'P2');
    await joinLobby(clients[2], 'P3');
    await joinLobby(clients[3], 'P4');

    const errorPromise = waitForEvent(clients[4], 'error');
    clients[4].emit('join_lobby', { nickname: 'P5' });

    const errorPayload = await errorPromise;

    expect(errorPayload.message).toMatch(/Lobby is full/i);
  });

  test('duplicate nickname joining receives an error event', async () => {
    const first = await createClient();
    const second = await createClient();

    await joinLobby(first, 'DuplicatedNick');

    const errorPromise = waitForEvent(second, 'error');
    second.emit('join_lobby', { nickname: 'DuplicatedNick' });

    const errorPayload = await errorPromise;

    expect(errorPayload.message).toMatch(/already taken/i);
  });

  test('start_game with only one queued player emits an error event', async () => {
    const host = await createClient();

    await joinLobby(host, 'SoloPlayer');

    const errorPromise = waitForEvent(host, 'error');
    host.emit('start_game', {});

    const errorPayload = await errorPromise;

    expect(errorPayload.message).toMatch(/At least 2 players/i);
  });

  test('new client receives lobby_update with gameInProgress true when game already started', async () => {
    const starter = await createClient();
    const other = await createClient();

    await joinLobby(starter, 'Starter');
    await joinLobby(other, 'Other');

    starter.emit('start_game', {});

    await waitForCondition(() => sharedState.gameInProgress === true);

    const { port } = httpServer.address();
    const lateClient = new Client(`http://localhost:${port}`);
    extraClients.push(lateClient);

    const lobbyUpdatePromise = waitForEvent(
      lateClient,
      'lobby_update',
      3000,
      (payload) => payload && payload.gameInProgress === true
    );

    await waitForEvent(lateClient, 'connect');

    const lobbyUpdate = await lobbyUpdatePromise;

    expect(lobbyUpdate.gameInProgress).toBe(true);
  });
});
