// ============================================================
// FILE: server/socket/gameHandlers.js
// ============================================================

function emitError(socket, message) {
  socket.emit('error', { message });
}

function toTimestamp() {
  return new Date().toISOString();
}

function findConnectedPlayer(context, socketId) {
  return context.gameManager.state.players.find((player) => player.socketId === socketId) || null;
}

function isSupportedZone(zone) {
  return zone === 'hand' || zone === 'board';
}

function registerGameHandlers(io, socket, context) {
  socket.on('request_action', ({ type, payload } = {}) => {
    if (!context.gameInProgress) {
      emitError(socket, 'Cannot request actions while no game is running.');
      return;
    }

    const requester = findConnectedPlayer(context, socket.id);
    if (!requester) {
      emitError(socket, 'Requester is not a connected player.');
      return;
    }

    if (typeof type !== 'string' || type.trim().length === 0) {
      emitError(socket, 'Action type is required.');
      return;
    }

    context.gameManager.requestAction(
      {
        type: type.trim(),
        payload: payload || {}
      },
      requester.id
    );
  });

  socket.on('flip_card', ({ cardId, zone } = {}) => {
    if (!context.gameInProgress) {
      emitError(socket, 'Cannot flip cards while no game is running.');
      return;
    }

    if (!isSupportedZone(zone)) {
      emitError(socket, 'Invalid card zone. Allowed values: hand, board.');
      return;
    }

    const player = findConnectedPlayer(context, socket.id);
    if (!player) {
      emitError(socket, 'Only connected players can flip cards.');
      return;
    }

    const cardCollection = Array.isArray(player[zone]) ? player[zone] : [];
    const card = cardCollection.find((entry) => String(entry.id) === String(cardId));

    if (!card) {
      emitError(socket, 'Card not found in your selected zone.');
      return;
    }

    card.isFaceUp = !card.isFaceUp;
    context.gameManager.broadcastState();

    io.emit('event_log', {
      message: `${player.nickname} flipped a card ${card.isFaceUp ? 'face-up' : 'face-down'}.`,
      timestamp: toTimestamp()
    });
  });

  socket.on('view_discard', () => {
    if (!context.gameInProgress) {
      emitError(socket, 'Cannot view discard pile while no game is running.');
      return;
    }

    const player = findConnectedPlayer(context, socket.id);
    if (!player) {
      emitError(socket, 'Only connected players can view discard pile.');
      return;
    }

    socket.emit('state_update', context.gameManager.getStateForPlayer(player.id));
  });

  socket.on('roll_dice', () => {
    if (!context.gameInProgress) {
      emitError(socket, 'Cannot roll dice while no game is running.');
      return;
    }

    const player = findConnectedPlayer(context, socket.id);
    if (!player) {
      emitError(socket, 'Only connected players can roll dice.');
      return;
    }

    const result = Math.floor(Math.random() * 12) + 1;

    io.emit('dice_result', {
      nickname: player.nickname,
      result
    });

    io.emit('event_log', {
      message: `${player.nickname} rolled a ${result}.`,
      timestamp: toTimestamp()
    });
  });

  socket.on('toggle_approval', () => {
    if (!context.gameInProgress) {
      emitError(socket, 'Cannot toggle approval mode while no game is running.');
      return;
    }

    const player = findConnectedPlayer(context, socket.id);
    if (!player) {
      emitError(socket, 'Only connected players can toggle approval mode.');
      return;
    }

    const approvalMode = context.gameManager.toggleApprovalMode();

    io.emit('event_log', {
      message: `${player.nickname} turned Approval Mode ${approvalMode ? 'ON' : 'OFF'}.`,
      timestamp: toTimestamp()
    });
  });
}

module.exports = registerGameHandlers;
