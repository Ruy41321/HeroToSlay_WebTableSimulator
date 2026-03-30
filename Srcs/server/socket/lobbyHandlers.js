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

function hasDuplicateNickname(players, nickname) {
  const nicknameLower = nickname.toLowerCase();
  return players.some((player) => player.nickname.toLowerCase() === nicknameLower);
}

function registerLobbyHandlers(io, socket, context) {
  socket.on('join_lobby', ({ nickname } = {}) => {
    if (context.gameInProgress) {
      emitError(socket, 'Cannot join lobby while a game is in progress.');
      return;
    }

    if (context.lobbyPlayers.length >= MAX_PLAYERS) {
      emitError(socket, 'Lobby is full. Maximum 4 players allowed.');
      return;
    }

    const cleanNickname = sanitizeNickname(nickname);
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
    context.lobbyPlayers.push(player);
    context.broadcastLobbyUpdate();
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

    for (const player of context.lobbyPlayers) {
      io.to(player.socketId).emit('game_start', { yourPlayerId: player.id });
    }

    context.gameManager.broadcastState();
    io.emit('restricted_log', context.gameManager.restrictedLog.getAll());
    context.broadcastLobbyUpdate();
  });

  socket.on('reset_lobby', () => {
    context.gameManager.reset();
    context.lobbyPlayers = [];
    context.gameInProgress = false;
    context.broadcastLobbyUpdate();
  });

  socket.on('disconnect', () => {
    const lobbyIndex = context.lobbyPlayers.findIndex((player) => player.socketId === socket.id);
    let disconnectedLobbyPlayer = null;

    if (lobbyIndex !== -1) {
      [disconnectedLobbyPlayer] = context.lobbyPlayers.splice(lobbyIndex, 1);
    }

    if (!context.gameInProgress) {
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

    const [disconnectedActivePlayer] = activePlayers.splice(activeIndex, 1);
    context.lobbyPlayers = context.lobbyPlayers.filter((player) => player.id !== disconnectedActivePlayer.id);

    io.emit('event_log', {
      message: `${disconnectedActivePlayer.nickname} disconnected from the game.`,
      timestamp: toTimestamp()
    });

    if (activePlayers.length === 0) {
      context.gameManager.reset();
      context.lobbyPlayers = [];
      context.gameInProgress = false;
      context.broadcastLobbyUpdate();
      return;
    }

    context.gameManager.broadcastState();
  });
}

module.exports = registerLobbyHandlers;
