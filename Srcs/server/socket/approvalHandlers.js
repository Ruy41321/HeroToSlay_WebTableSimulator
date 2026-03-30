// ============================================================
// FILE: server/socket/approvalHandlers.js
// ============================================================

function emitError(socket, message) {
  socket.emit('error', { message });
}

function registerApprovalHandlers(io, socket, context) {
  socket.on('respond_approval', ({ actionId, decision } = {}) => {
    if (!context.gameInProgress) {
      emitError(socket, 'No active game in progress.');
      return;
    }

    const responder = context.gameManager.state.players.find((player) => player.socketId === socket.id);
    if (!responder) {
      emitError(socket, 'Only connected players can respond to approvals.');
      return;
    }

    const pendingItem = context.gameManager.approvalQueue.current;
    if (!pendingItem || pendingItem.action.actionId !== actionId) {
      emitError(socket, 'Approval request not found or already resolved.');
      return;
    }

    if (pendingItem.action.requesterId === responder.id) {
      emitError(socket, 'Requester cannot approve or deny their own action.');
      return;
    }

    if (decision === true) {
      const didApprove = context.gameManager.approvalQueue.approve(
        actionId,
        responder.id,
        responder.nickname
      );

      if (!didApprove) {
        emitError(socket, 'Failed to approve action.');
        return;
      }

      io.emit('approval_result', {
        actionId,
        granted: true,
        approverNickname: responder.nickname
      });
      return;
    }

    if (decision === false) {
      const didDeny = context.gameManager.approvalQueue.deny(actionId, responder.id, responder.nickname);

      if (!didDeny) {
        emitError(socket, 'Failed to deny action.');
        return;
      }

      io.emit('approval_result', {
        actionId,
        granted: false,
        approverNickname: responder.nickname
      });
      return;
    }

    emitError(socket, 'Invalid approval decision payload.');
  });
}

module.exports = registerApprovalHandlers;
