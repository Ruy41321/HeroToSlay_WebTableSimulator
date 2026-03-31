// ============================================================
// FILE: server/game/ApprovalQueue.js
// ============================================================

const APPROVAL_TIMEOUT_MS = 30 * 1000;

class ApprovalQueue {
  constructor(io) {
    this.io = io;
    this.queue = [];
    this.current = null;
    this.isPending = false;
  }

  enqueue(action, onApproved, onDenied) {
    if (this.isPending) {
      if (this.io && action && action.requesterSocketId) {
        this.io.to(action.requesterSocketId).emit('error', {
          message: 'An approval request is already pending. Please wait.'
        });
      }

      return null;
    }

    this.isPending = true;

    const queueItem = {
      action,
      onApproved: typeof onApproved === 'function' ? onApproved : () => {},
      onDenied: typeof onDenied === 'function' ? onDenied : () => {},
      approvals: new Set(),
      denials: new Set(),
      timeoutId: null
    };

    this.queue.push(queueItem);

    if (this.io) {
      this.io.emit('approval_pending', {
        actionId: action.actionId,
        type: action.type,
        requesterId: action.requesterId,
        requesterNickname: action.requesterNickname,
        details: action.details
      });
    }

    this.processNext();
    return action.actionId;
  }

  approve(actionId, approverId, approverNickname) {
    if (!this.current || this.current.action.actionId !== actionId) {
      return false;
    }

    const approverKey = approverId || approverNickname || 'unknown-approver';
    this.current.approvals.add(approverKey);

    if (this.current.denials.size === 0 && this.current.approvals.size >= 1) {
      const resolvedItem = this.detachCurrent();
      this.emitPendingCleared();

      try {
        resolvedItem.onApproved({
          actionId,
          approverId: approverId || null,
          approverNickname: approverNickname || 'UnknownApprover'
        });
      } finally {
        this.processNext();
      }
    }

    return true;
  }

  deny(actionId, denierId, denierNickname) {
    if (!this.current || this.current.action.actionId !== actionId) {
      return false;
    }

    const denierKey = denierId || denierNickname || 'unknown-denier';
    this.current.denials.add(denierKey);

    const resolvedItem = this.detachCurrent();
    this.emitPendingCleared();

    try {
      resolvedItem.onDenied({
        actionId,
        denierId: denierId || null,
        denierNickname: denierNickname || 'UnknownDenier',
        reason: 'denied'
      });
    } finally {
      this.processNext();
    }

    return true;
  }

  clear() {
    const hadPending = this.isPending;

    if (this.current && this.current.timeoutId) {
      clearTimeout(this.current.timeoutId);
    }

    this.current = null;
    this.queue = [];
    this.isPending = false;

    if (hadPending) {
      this.emitPendingCleared();
    }
  }

  processNext() {
    if (this.current || this.queue.length === 0) {
      return;
    }

    this.current = this.queue.shift();
    const { action } = this.current;

    if (this.io) {
      this.io.emit('approval_request', {
        actionId: action.actionId,
        type: action.type,
        requesterNickname: action.requesterNickname,
        details: action.details
      });
    }

    this.current.timeoutId = setTimeout(() => {
      if (!this.current || this.current.action.actionId !== action.actionId) {
        return;
      }

      const timedOutItem = this.detachCurrent();
      this.emitPendingCleared();

      try {
        timedOutItem.onDenied({
          actionId: action.actionId,
          denierId: null,
          denierNickname: 'Timeout',
          reason: 'timeout'
        });

        if (this.io) {
          this.io.emit('approval_result', {
            actionId: action.actionId,
            granted: false,
            approverNickname: 'Timeout',
            type: action.type || null,
            details: action.details || null,
            requesterNickname: action.requesterNickname || null,
            requesterId: action.requesterId || null
          });
        }
      } finally {
        this.processNext();
      }
    }, APPROVAL_TIMEOUT_MS);
  }

  detachCurrent() {
    if (!this.current) {
      return null;
    }

    const resolvedItem = this.current;

    if (this.current.timeoutId) {
      clearTimeout(this.current.timeoutId);
    }

    this.current = null;
    this.isPending = false;
    return resolvedItem;
  }

  emitPendingCleared() {
    if (!this.io) {
      return;
    }

    this.io.emit('approval_pending_cleared');
  }
}

module.exports = ApprovalQueue;
