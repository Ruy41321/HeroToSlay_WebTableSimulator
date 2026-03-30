// ============================================================
// FILE: server/game/RestrictedLog.js
// ============================================================

class RestrictedLog {
  constructor() {
    this.entries = [];
  }

  append(entry) {
    const timestampSource = entry && entry.timestamp ? entry.timestamp : new Date().toISOString();
    const parsedDate = new Date(timestampSource);
    const safeDate = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

    const playerNickname = entry && entry.playerNickname ? entry.playerNickname : 'UnknownPlayer';
    const actionType = entry && entry.actionType ? entry.actionType : 'UNKNOWN_ACTION';
    const details = entry && entry.details ? entry.details : '';
    const approvedBy = entry && entry.approvedBy ? entry.approvedBy : 'UnknownApprover';

    const hh = String(safeDate.getHours()).padStart(2, '0');
    const mm = String(safeDate.getMinutes()).padStart(2, '0');
    const ss = String(safeDate.getSeconds()).padStart(2, '0');
    const formattedTime = `${hh}:${mm}:${ss}`;

    let message = '';
    if (actionType === 'UNDO') {
      message = `[${formattedTime}] ${playerNickname} → UNDO ← reverted above action [APPROVED by ${approvedBy}]`;
    } else {
      const detailsBlock = details ? ` (${details})` : '';
      message = `[${formattedTime}] ${playerNickname} → ${actionType}${detailsBlock} [APPROVED by ${approvedBy}]`;
    }

    const storedEntry = {
      timestamp: safeDate.toISOString(),
      playerNickname,
      actionType,
      details,
      approvedBy,
      message
    };

    this.entries.push(storedEntry);
    return storedEntry;
  }

  getAll() {
    return this.entries;
  }

  clear() {
    this.entries = [];
  }
}

module.exports = RestrictedLog;