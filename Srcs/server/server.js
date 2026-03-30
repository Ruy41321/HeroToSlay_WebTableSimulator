// ============================================================
// FILE: server/server.js
// ============================================================

const fs = require('fs');
const http = require('http');
const path = require('path');

const express = require('express');
const { Server } = require('socket.io');

const GameManager = require('./game/GameManager');
const registerLobbyHandlers = require('./socket/lobbyHandlers');
const registerApprovalHandlers = require('./socket/approvalHandlers');
const registerGameHandlers = require('./socket/gameHandlers');

const PROJECT_ROOT = path.join(__dirname, '..');
const CARDS_FILE_PATH = path.join(PROJECT_ROOT, 'cards.json');
const ASSETS_DIRECTORY = path.join(PROJECT_ROOT, 'Assets');
const PUBLIC_DIRECTORY = path.join(PROJECT_ROOT, 'public');
const INDEX_HTML_PATH = path.join(PUBLIC_DIRECTORY, 'index.html');
const PORT = 3000;

function loadCardsOrExit() {
  if (!fs.existsSync(CARDS_FILE_PATH)) {
    console.error('cards.json not found. Run node indexer.js first.');
    process.exit(1);
  }

  try {
    const rawCards = fs.readFileSync(CARDS_FILE_PATH, 'utf8');
    const cards = JSON.parse(rawCards);

    if (!Array.isArray(cards)) {
      console.error('cards.json must contain an array.');
      process.exit(1);
    }

    return cards;
  } catch (error) {
    console.error(`Failed to load cards.json: ${error.message}`);
    process.exit(1);
  }
}

const cards = loadCardsOrExit();
const app = express();

app.use('/Assets', express.static(ASSETS_DIRECTORY));
app.use(express.static(PUBLIC_DIRECTORY));

app.get('/', (req, res) => {
  if (fs.existsSync(INDEX_HTML_PATH)) {
    res.sendFile(INDEX_HTML_PATH);
    return;
  }

  res.status(200).send('Hero to Slay server is running.');
});

const httpServer = http.createServer(app);
const io = new Server(httpServer);
const gameManager = new GameManager(io, cards);

const sharedState = {
  lobbyPlayers: [],
  gameInProgress: false,
  gameManager,
  buildLobbyPayload() {
    return {
      players: this.lobbyPlayers.map((player) => ({
        id: player.id,
        nickname: player.nickname
      })),
      gameInProgress: this.gameInProgress
    };
  },
  broadcastLobbyUpdate() {
    io.emit('lobby_update', this.buildLobbyPayload());
  }
};

io.on('connection', (socket) => {
  socket.emit('lobby_update', sharedState.buildLobbyPayload());

  registerLobbyHandlers(io, socket, sharedState);
  registerGameHandlers(io, socket, sharedState);
  registerApprovalHandlers(io, socket, sharedState);
});

if (require.main === module) {
  httpServer.listen(PORT, () => {
    console.log('Server running on http://localhost:3000');
  });
}

module.exports = { app, io, httpServer, gameManager, sharedState };
