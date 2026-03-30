// ============================================================
// FILE: test/integration/game.test.js
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

function waitForNoEvent(socket, eventName, timeoutMs = 350, filter = null) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      socket.off(eventName, onEvent);
      resolve();
    }, timeoutMs);

    function onEvent(payload) {
      if (typeof filter === 'function' && !filter(payload)) {
        return;
      }

      clearTimeout(timeoutId);
      socket.off(eventName, onEvent);
      reject(new Error(`Unexpected ${eventName} received`));
    }

    socket.on(eventName, onEvent);
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

async function joinAndStartGame() {
  const playerA = await createClient();
  const playerB = await createClient();

  playerA.emit('join_lobby', { nickname: 'Alice' });
  playerB.emit('join_lobby', { nickname: 'Bob' });

  await waitForCondition(() => sharedState.lobbyPlayers.length === 2);

  const gameStartA = waitForEvent(playerA, 'game_start');
  const gameStartB = waitForEvent(playerB, 'game_start');

  playerA.emit('start_game', {});

  const startA = await gameStartA;
  const startB = await gameStartB;

  await waitForCondition(() => sharedState.gameInProgress === true);

  return {
    playerA,
    playerB,
    playerAId: startA.yourPlayerId,
    playerBId: startB.yourPlayerId
  };
}

function findPlayerState(state, playerId) {
  if (!state || !Array.isArray(state.players)) {
    return null;
  }

  return state.players.find((player) => String(player.id) === String(playerId)) || null;
}

function findBoardCard(state, playerId, cardId) {
  const player = findPlayerState(state, playerId);
  if (!player || !Array.isArray(player.board)) {
    return null;
  }

  return player.board.find((card) => String(card.id) === String(cardId)) || null;
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

describe('Game integration', () => {
  test('state_update for player A never exposes other player hand name/path', async () => {
    const { playerA, playerB, playerAId } = await joinAndStartGame();

    sharedState.gameManager.state.approvalMode = false;

    const statePromise = waitForEvent(playerA, 'state_update', 4000, (state) => {
      if (!state || !Array.isArray(state.players)) {
        return false;
      }

      const other = state.players.find((player) => String(player.id) !== String(playerAId));
      return Boolean(other && Array.isArray(other.hand) && other.hand.length > 0);
    });

    playerB.emit('request_action', { type: 'DRAW_HERO', payload: {} });

    const state = await statePromise;
    const otherPlayer = state.players.find((player) => String(player.id) !== String(playerAId));

    expect(otherPlayer.hand.length).toBeGreaterThan(0);
    expect(Object.prototype.hasOwnProperty.call(otherPlayer.hand[0], 'id')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(otherPlayer.hand[0], 'isFaceUp')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(otherPlayer.hand[0], 'ownerId')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(otherPlayer.hand[0], 'name')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(otherPlayer.hand[0], 'path')).toBe(false);
  });

  test('toggle_approval emits state_update with flipped approvalMode', async () => {
    const { playerA } = await joinAndStartGame();

    const initialMode = sharedState.gameManager.getState().approvalMode;

    const flippedStatePromise = waitForEvent(
      playerA,
      'state_update',
      4000,
      (state) => state && typeof state.approvalMode === 'boolean' && state.approvalMode !== initialMode
    );

    playerA.emit('toggle_approval', {});

    const flippedState = await flippedStatePromise;

    expect(flippedState.approvalMode).toBe(!initialMode);
  });

  test('roll_dice emits dice_result and exactly one roll event_log entry', async () => {
    const { playerA } = await joinAndStartGame();

    const rollLogMessages = [];
    const onRollLog = ({ message } = {}) => {
      if (typeof message === 'string' && /^Alice rolled a \d+\.$/.test(message)) {
        rollLogMessages.push(message);
      }
    };

    playerA.on('event_log', onRollLog);

    const diceResultPromise = waitForEvent(
      playerA,
      'dice_result',
      4000,
      (payload) => payload && payload.nickname === 'Alice' && Number.isInteger(payload.result)
    );

    playerA.emit('roll_dice', {});

    const diceResult = await diceResultPromise;
    const expectedLogMessage = `Alice rolled a ${diceResult.result}.`;

    await waitForCondition(() => rollLogMessages.includes(expectedLogMessage));
    await new Promise((resolve) => setTimeout(resolve, 150));

    const matches = rollLogMessages.filter((message) => message === expectedLogMessage);
    expect(matches).toHaveLength(1);

    playerA.off('event_log', onRollLog);
  });

  test('view_discard emits discard_pile with full public card data', async () => {
    const { playerA, playerAId } = await joinAndStartGame();

    sharedState.gameManager.state.approvalMode = false;

    const drawnStatePromise = waitForEvent(playerA, 'state_update', 4000, (state) => {
      if (!state || !Array.isArray(state.players)) {
        return false;
      }

      const local = state.players.find((player) => String(player.id) === String(playerAId));
      return Boolean(local && Array.isArray(local.hand) && local.hand.length > 0);
    });

    playerA.emit('request_action', { type: 'DRAW_HERO', payload: {} });

    const drawnState = await drawnStatePromise;
    const localAfterDraw = drawnState.players.find((player) => String(player.id) === String(playerAId));
    const drawnCard = localAfterDraw.hand[0];

    const discardedStatePromise = waitForEvent(playerA, 'state_update', 4000, (state) => {
      return state && Array.isArray(state.discardPile) && state.discardPile.length > 0;
    });

    playerA.emit('request_action', {
      type: 'DISCARD_CARD',
      payload: {
        cardId: drawnCard.id,
        zone: 'hand'
      }
    });

    await discardedStatePromise;

    const discardPilePromise = waitForEvent(playerA, 'discard_pile', 4000, (payload) => {
      return payload && Array.isArray(payload.cards) && payload.cards.length > 0;
    });

    playerA.emit('view_discard', {});

    const payload = await discardPilePromise;
    const serverDiscardPile = sharedState.gameManager.getState().discardPile;
    const revealedCard = payload.cards[payload.cards.length - 1];

    expect(payload.cards).toEqual(serverDiscardPile);
    expect(Object.prototype.hasOwnProperty.call(revealedCard, 'name')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(revealedCard, 'path')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(revealedCard, 'isFaceUp')).toBe(true);
    expect(revealedCard.isFaceUp).toBe(true);
  });

  test('request_action moves own card hand -> board -> hand with ACTIVATE_CARD and RETURN_CARD_TO_HAND', async () => {
    const { playerA, playerAId } = await joinAndStartGame();

    sharedState.gameManager.state.approvalMode = false;

    const drawnStatePromise = waitForEvent(playerA, 'state_update', 4000, (state) => {
      if (!state || !Array.isArray(state.players)) {
        return false;
      }

      const local = state.players.find((player) => String(player.id) === String(playerAId));
      return Boolean(local && Array.isArray(local.hand) && local.hand.length > 0);
    });

    playerA.emit('request_action', { type: 'DRAW_HERO', payload: {} });

    const drawnState = await drawnStatePromise;
    const localAfterDraw = drawnState.players.find((player) => String(player.id) === String(playerAId));
    const drawnCard = localAfterDraw.hand[0];

    const activatedStatePromise = waitForEvent(playerA, 'state_update', 4000, (state) => {
      if (!state || !Array.isArray(state.players)) {
        return false;
      }

      const local = state.players.find((player) => String(player.id) === String(playerAId));
      if (!local) {
        return false;
      }

      const inHand = local.hand.some((card) => String(card.id) === String(drawnCard.id));
      const inBoard = local.board.some((card) => String(card.id) === String(drawnCard.id));

      return !inHand && inBoard;
    });

    playerA.emit('request_action', {
      type: 'ACTIVATE_CARD',
      payload: { cardId: drawnCard.id }
    });

    const activatedState = await activatedStatePromise;
    const localAfterActivate = activatedState.players.find((player) => String(player.id) === String(playerAId));

    expect(localAfterActivate.hand.some((card) => String(card.id) === String(drawnCard.id))).toBe(false);
    expect(localAfterActivate.board.some((card) => String(card.id) === String(drawnCard.id))).toBe(true);

    const returnedStatePromise = waitForEvent(playerA, 'state_update', 4000, (state) => {
      if (!state || !Array.isArray(state.players)) {
        return false;
      }

      const local = state.players.find((player) => String(player.id) === String(playerAId));
      if (!local) {
        return false;
      }

      const inHand = local.hand.some((card) => String(card.id) === String(drawnCard.id));
      const inBoard = local.board.some((card) => String(card.id) === String(drawnCard.id));

      return inHand && !inBoard;
    });

    playerA.emit('request_action', {
      type: 'RETURN_CARD_TO_HAND',
      payload: { cardId: drawnCard.id }
    });

    const returnedState = await returnedStatePromise;
    const localAfterReturn = returnedState.players.find((player) => String(player.id) === String(playerAId));

    expect(localAfterReturn.hand.some((card) => String(card.id) === String(drawnCard.id))).toBe(true);
    expect(localAfterReturn.board.some((card) => String(card.id) === String(drawnCard.id))).toBe(false);
  });

  test('move_board_card syncs position and supports cross-board transfer by non-owner', async () => {
    const { playerA, playerB, playerAId, playerBId } = await joinAndStartGame();

    sharedState.gameManager.state.approvalMode = false;

    const drawnStatePromise = waitForEvent(playerA, 'state_update', 4000, (state) => {
      const local = findPlayerState(state, playerAId);
      return Boolean(local && Array.isArray(local.hand) && local.hand.length > 0);
    });

    playerA.emit('request_action', { type: 'DRAW_HERO', payload: {} });

    const drawnState = await drawnStatePromise;
    const localAfterDraw = findPlayerState(drawnState, playerAId);
    const drawnCard = localAfterDraw.hand[0];

    const activatedStatePromiseA = waitForEvent(playerA, 'state_update', 4000, (state) => {
      return Boolean(findBoardCard(state, playerAId, drawnCard.id));
    });
    const activatedStatePromiseB = waitForEvent(playerB, 'state_update', 4000, (state) => {
      return Boolean(findBoardCard(state, playerAId, drawnCard.id));
    });

    playerA.emit('request_action', {
      type: 'ACTIVATE_CARD',
      payload: { cardId: drawnCard.id }
    });

    await activatedStatePromiseA;
    await activatedStatePromiseB;

    const movedByAStatePromiseA = waitForEvent(playerA, 'state_update', 4000, (state) => {
      const boardCard = findBoardCard(state, playerAId, drawnCard.id);
      return Boolean(
        boardCard &&
          boardCard.boardPosition &&
          boardCard.boardPosition.x === 240 &&
          boardCard.boardPosition.y === 108
      );
    });
    const movedByAStatePromiseB = waitForEvent(playerB, 'state_update', 4000, (state) => {
      const boardCard = findBoardCard(state, playerAId, drawnCard.id);
      return Boolean(
        boardCard &&
          boardCard.boardPosition &&
          boardCard.boardPosition.x === 240 &&
          boardCard.boardPosition.y === 108
      );
    });

    playerA.emit('move_board_card', {
      cardId: drawnCard.id,
      x: 240,
      y: 150
    });

    await movedByAStatePromiseA;
    const movedByAStateB = await movedByAStatePromiseB;
    expect(findBoardCard(movedByAStateB, playerAId, drawnCard.id).boardPosition).toEqual({
      x: 240,
      y: 108
    });

    const movedByBStatePromiseA = waitForEvent(playerA, 'state_update', 4000, (state) => {
      const boardCard = findBoardCard(state, playerBId, drawnCard.id);
      return Boolean(
        boardCard &&
          boardCard.boardPosition &&
          boardCard.boardPosition.x === 260 &&
          boardCard.boardPosition.y === 108 &&
          boardCard.ownerId === playerBId
      );
    });
    const movedByBStatePromiseB = waitForEvent(playerB, 'state_update', 4000, (state) => {
      const boardCard = findBoardCard(state, playerBId, drawnCard.id);
      return Boolean(
        boardCard &&
          boardCard.boardPosition &&
          boardCard.boardPosition.x === 260 &&
          boardCard.boardPosition.y === 108 &&
          boardCard.ownerId === playerBId
      );
    });

    playerB.emit('move_board_card', {
      cardId: drawnCard.id,
      targetPlayerId: playerBId,
      x: 999,
      y: 999
    });

    const movedByBA = await movedByBStatePromiseA;
    const movedByBB = await movedByBStatePromiseB;

    expect(findBoardCard(movedByBA, playerAId, drawnCard.id)).toBeNull();
    expect(findBoardCard(movedByBA, playerBId, drawnCard.id).boardPosition).toEqual({ x: 260, y: 108 });
    expect(findBoardCard(movedByBB, playerBId, drawnCard.id).ownerId).toBe(playerBId);
  });

  test('rotate_board_card is deprecated and does not change server state', async () => {
    const { playerA, playerAId } = await joinAndStartGame();

    sharedState.gameManager.state.approvalMode = false;

    const drawnStatePromise = waitForEvent(playerA, 'state_update', 4000, (state) => {
      const local = findPlayerState(state, playerAId);
      return Boolean(local && Array.isArray(local.hand) && local.hand.length > 0);
    });

    playerA.emit('request_action', { type: 'DRAW_HERO', payload: {} });

    const drawnState = await drawnStatePromise;
    const localAfterDraw = findPlayerState(drawnState, playerAId);
    const drawnCard = localAfterDraw.hand[0];

    const activatedStatePromise = waitForEvent(playerA, 'state_update', 4000, (state) => {
      return Boolean(findBoardCard(state, playerAId, drawnCard.id));
    });

    playerA.emit('request_action', {
      type: 'ACTIVATE_CARD',
      payload: { cardId: drawnCard.id }
    });

    await activatedStatePromise;

    const stateBeforeRotate = JSON.stringify(sharedState.gameManager.getState());
    const noStateUpdatePromise = waitForNoEvent(playerA, 'state_update', 300);

    playerA.emit('rotate_board_card', {
      cardId: drawnCard.id,
      delta: 90
    });

    await noStateUpdatePromise;

    const stateAfterRotate = JSON.stringify(sharedState.gameManager.getState());
    expect(stateAfterRotate).toBe(stateBeforeRotate);
  });

  test('spectator cannot move or rotate board cards', async () => {
    await joinAndStartGame();

    const spectator = await createClient();
    const spectatorJoinedPromise = waitForEvent(spectator, 'spectator_joined', 4000);

    spectator.emit('join_spectator', { displayName: 'Watcher' });
    await spectatorJoinedPromise;

    const moveErrorPromise = waitForEvent(
      spectator,
      'error',
      4000,
      (payload) => payload && /Spectators cannot perform actions\./i.test(payload.message)
    );

    spectator.emit('move_board_card', {
      cardId: 'missing-card',
      x: 100,
      y: 100
    });

    const moveErrorPayload = await moveErrorPromise;
    expect(moveErrorPayload.message).toMatch(/Spectators cannot perform actions\./i);

    const rotateErrorPromise = waitForEvent(
      spectator,
      'error',
      4000,
      (payload) => payload && /Spectators cannot perform actions\./i.test(payload.message)
    );

    spectator.emit('rotate_board_card', {
      cardId: 'missing-card',
      delta: 90
    });

    const rotateErrorPayload = await rotateErrorPromise;
    expect(rotateErrorPayload.message).toMatch(/Spectators cannot perform actions\./i);
  });

  test('spectator cannot request TAKE_FROM_DISCARD action', async () => {
    await joinAndStartGame();

    const spectator = await createClient();
    const spectatorJoinedPromise = waitForEvent(spectator, 'spectator_joined', 4000);

    spectator.emit('join_spectator', { displayName: 'Watcher' });
    await spectatorJoinedPromise;

    const errorPromise = waitForEvent(
      spectator,
      'error',
      4000,
      (payload) => payload && /Spectators cannot perform actions\./i.test(payload.message)
    );

    spectator.emit('request_action', {
      type: 'TAKE_FROM_DISCARD',
      payload: { cardId: 'd1' }
    });

    const errorPayload = await errorPromise;
    expect(errorPayload.message).toMatch(/Spectators cannot perform actions\./i);
  });
});
