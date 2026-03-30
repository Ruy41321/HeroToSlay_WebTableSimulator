// ============================================================
// FILE: server/models/Player.js
// ============================================================

class Player {
  constructor(id, nickname, socketId) {
    this.id = id;
    this.nickname = nickname;
    this.socketId = socketId;
    this.isDisconnected = false;
    this.hand = [];
    this.board = [];
  }
}

module.exports = Player;
