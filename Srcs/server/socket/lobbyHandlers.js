// ============================================================
// FILE: server/socket/lobbyHandlers.js
// ============================================================

const { v4: uuidv4 } = require('uuid');

const Player = require('../models/Player');

const MAX_PLAYERS = 4;
const MIN_PLAYERS_TO_START = 2;

function emitError(socket, message) {
  socket.emit('error', { message });
}

function toTimestamp() {
  return new Date().toISOString();
}

function sanitizeNickname(nickname) {
  if (typeof nickname !== 'string') {
    return '';
  }

  return nickname.trim();
}

function sanitizeDisplayName(displayName) {
  if (typeof displayName !== 'string') {
    return 'Spectator';
  }

  const trimmed = displayName.trim();
  if (!trimmed) {
    return 'Spectator';
  }

  return trimmed.slice(0, 20);
}

function hasDuplicateNickname(players, nickname) {
  const nicknameLower = nickname.toLowerCase();
  return players.some((player) => player.nickname.toLowerCase() === nicknameLower);
}

function registerLobbyHandlers(io, socket, context) {
  socket.on('join_lobby', ({ nickname } = {}) => {
    if (socket.isSpectator) {
      context.gameManager.removeSpectator(socket.id);
      socket.isSpectator = false;
    }

    const cleanNickname = sanitizeNickname(nickname);
    const reconnect = context.gameManager.reconnectPlayer(cleanNickname, socket.id);

    if (reconnect) {
      socket.playerId = reconnect.player.id;
      socket.nickname = reconnect.player.nickname;
      socket.isSpectator = false;

      const lobbyPlayer = context.lobbyPlayers.find((player) => player.id === reconnect.player.id);
      if (lobbyPlayer) {
        lobbyPlayer.socketId = socket.id;
        lobbyPlayer.isDisconnected = false;
      }

      socket.emit('reconnect_success', {
        yourPlayerId: reconnect.player.id,
        yourNickname: reconnect.player.nickname
      });
      socket.emit('state_update', reconnect.gameState);

      io.emit('event_log', {
        message: `${reconnect.player.nickname} reconnected`,
        timestamp: toTimestamp()
      });

      context.gameManager.broadcastState();
      return;
    }

    if (context.gameInProgress) {
      emitError(socket, 'Cannot join lobby while a game is in progress.');
      return;
    }

    if (context.lobbyPlayers.length >= MAX_PLAYERS) {
      emitError(socket, 'Lobby is full. Maximum 4 players allowed.');
      return;
    }

    if (!cleanNickname) {
      emitError(socket, 'Nickname is required.');
      return;
    }

    if (hasDuplicateNickname(context.lobbyPlayers, cleanNickname)) {
      emitError(socket, 'Nickname is already taken.');
      return;
    }

    const alreadyJoined = context.lobbyPlayers.some((player) => player.socketId === socket.id);
    if (alreadyJoined) {
      emitError(socket, 'This socket already joined the lobby.');
      return;
    }

    const player = new Player(uuidv4(), cleanNickname, socket.id);
    socket.playerId = player.id;
    socket.nickname = player.nickname;
    socket.isSpectator = false;
    context.lobbyPlayers.push(player);
    console.log(`[LOBBY] "${cleanNickname}" joined queue (${context.lobbyPlayers.length}/4)`);
    context.broadcastLobbyUpdate();
  });

  socket.on('join_spectator', ({ displayName } = {}) => {
    const safeDisplayName = sanitizeDisplayName(displayName);

    context.lobbyPlayers = context.lobbyPlayers.filter((player) => player.socketId !== socket.id);

    const spectator = context.gameManager.addSpectator(socket.id, safeDisplayName);
    socket.isSpectator = true;
    socket.playerId = null;
    socket.nickname = null;

    socket.emit('spectator_joined', {
      displayName: spectator.displayName,
      currentSpectators: context.gameManager.getSpectators()
    });

    if (context.gameInProgress && context.gameManager.state.phase === 'playing') {
      socket.emit('state_update', context.gameManager.getStateForSpectator());
    } else {
      socket.emit('lobby_update', {
        players: context.lobbyPlayers.map((player) => ({
          id: player.id,
          nickname: player.nickname
        })),
        gameInProgress: false,
        spectators: context.gameManager.getSpectators()
      });
    }

    io.emit('event_log', {
      message: `${spectator.displayName} joined as spectator`,
      timestamp: toTimestamp()
    });

    if (!context.gameInProgress) {
      context.broadcastLobbyUpdate();
    }
  });

  socket.on('start_game', () => {
    if (context.gameInProgress) {
      emitError(socket, 'Game is already in progress.');
      return;
    }

    if (context.lobbyPlayers.length < MIN_PLAYERS_TO_START) {
      emitError(socket, 'At least 2 players are required to start the game.');
      return;
    }

    context.gameManager.startGame(context.lobbyPlayers);
    context.gameInProgress = true;
    console.log(
      `[GAME] Game started with players: ${context.lobbyPlayers
        .map((player) => player.nickname)
        .join(', ')}`
    );

    for (const player of context.lobbyPlayers) {
      io.to(player.socketId).emit('game_start', {
        yourPlayerId: player.id,
        yourNickname: player.nickname
      });
    }

    context.gameManager.broadcastState();
    io.emit('restricted_log', context.gameManager.restrictedLog.getAll());
    context.broadcastLobbyUpdate();
  });

  socket.on('reset_lobby', () => {
    console.log('[GAME] Game reset — returning to lobby');
    context.gameManager.reset();
    context.lobbyPlayers = [];
    context.gameInProgress = false;
    context.broadcastLobbyUpdate();
  });

  socket.on('disconnect', () => {
    if (socket.isSpectator) {
      context.gameManager.removeSpectator(socket.id);
      return;
    }

    if (!context.gameInProgress) {
      const lobbyIndex = context.lobbyPlayers.findIndex((player) => player.socketId === socket.id);

      if (lobbyIndex === -1) {
        return;
      }

      const [disconnectedLobbyPlayer] = context.lobbyPlayers.splice(lobbyIndex, 1);
      console.log(`[LOBBY] "${disconnectedLobbyPlayer.nickname}" disconnected`);

      if (disconnectedLobbyPlayer) {
        context.broadcastLobbyUpdate();
      }

      return;
    }

    const activePlayers = context.gameManager.state.players;
    const activeIndex = activePlayers.findIndex((player) => player.socketId === socket.id);

    if (activeIndex === -1) {
      return;
    }

    const disconnectedActivePlayer = activePlayers[activeIndex];
    context.gameManager.markDisconnected(disconnectedActivePlayer);

    const lobbyPlayer = context.lobbyPlayers.find((player) => player.id === disconnectedActivePlayer.id);
    if (lobbyPlayer) {
      lobbyPlayer.socketId = null;
      lobbyPlayer.isDisconnected = true;
    }

    console.log(`[LOBBY] "${disconnectedActivePlayer.nickname}" disconnected`);

    io.emit('event_log', {
      message: `${disconnectedActivePlayer.nickname} disconnected - slot held for 10 minutes`,
      timestamp: toTimestamp()
    });

    context.gameManager.broadcastState();
  });
}

module.exports = registerLobbyHandlers;
