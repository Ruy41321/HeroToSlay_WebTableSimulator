// ============================================================
// FILE: server/game/GameManager.js
// ============================================================

const { v4: uuidv4 } = require('uuid');

const Card = require('../models/Card');
const Deck = require('../models/Deck');
const ApprovalQueue = require('./ApprovalQueue');
const RestrictedLog = require('./RestrictedLog');

const DISCONNECTED_TTL_MS = 10 * 60 * 1000;
const DISCONNECTED_CLEANUP_INTERVAL_MS = 60 * 1000;
const BOARD_SPACE_WIDTH = 340;
const BOARD_SPACE_HEIGHT = 220;
const BOARD_CARD_WIDTH = 80;
const BOARD_CARD_HEIGHT = 112;

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function toNicknameKey(nickname) {
  if (typeof nickname !== 'string') {
    return '';
  }

  return nickname.trim().toLowerCase();
}

class GameManager {
  constructor(io, cards) {
    if (GameManager.instance) {
      if (io) {
        GameManager.instance.io = io;
        GameManager.instance.approvalQueue.io = io;
      }

      if (Array.isArray(cards)) {
        GameManager.instance.rawCards = cards;
      }

      if (!(GameManager.instance.disconnectedPlayers instanceof Map)) {
        GameManager.instance.disconnectedPlayers = new Map();
      }

      if (!(GameManager.instance.spectators instanceof Map)) {
        GameManager.instance.spectators = new Map();
      }

      if (!GameManager.instance.disconnectCleanupIntervalId) {
        GameManager.instance.startDisconnectedCleanup();
      }

      return GameManager.instance;
    }

    this.io = io;
    this.rawCards = Array.isArray(cards) ? cards : [];
    this.approvalQueue = new ApprovalQueue(io);
    this.restrictedLog = new RestrictedLog();
    this.historyStack = [];
    this.state = this.createInitialState();
    this.disconnectedPlayers = new Map();
    this.spectators = new Map();
    this.disconnectCleanupIntervalId = null;
    this.onAutoReset = null;

    this.startDisconnectedCleanup();

    GameManager.instance = this;
  }

  startDisconnectedCleanup() {
    if (this.disconnectCleanupIntervalId) {
      return;
    }

    this.disconnectCleanupIntervalId = setInterval(() => {
      this.cleanupDisconnectedPlayers();
    }, DISCONNECTED_CLEANUP_INTERVAL_MS);

    if (typeof this.disconnectCleanupIntervalId.unref === 'function') {
      this.disconnectCleanupIntervalId.unref();
    }
  }

  cleanupDisconnectedPlayers() {
    const now = Date.now();

    const allPlayersDisconnectedForTTL =
      this.state.phase === 'playing' &&
      this.state.players.length > 0 &&
      this.state.players.every((player) => {
        if (!player || !player.isDisconnected) {
          return false;
        }

        const nicknameKey = toNicknameKey(player.nickname);
        if (!nicknameKey) {
          return false;
        }

        const entry = this.disconnectedPlayers.get(nicknameKey);
        return Boolean(entry && now - entry.disconnectedAt > DISCONNECTED_TTL_MS);
      });

    for (const [nicknameKey, entry] of this.disconnectedPlayers.entries()) {
      const disconnectedAt = entry && Number.isFinite(entry.disconnectedAt) ? entry.disconnectedAt : 0;

      if (now - disconnectedAt > DISCONNECTED_TTL_MS) {
        this.disconnectedPlayers.delete(nicknameKey);
      }
    }

    if (allPlayersDisconnectedForTTL) {
      this.reset();

      if (typeof this.onAutoReset === 'function') {
        this.onAutoReset();
      }
    }
  }

  startGame(players) {
    const safePlayers = Array.isArray(players) ? players : [];
    const normalizedPlayers = safePlayers.map((player) => ({
      ...player,
      socketId: player.socketId || null,
      isDisconnected: false,
      hand: [],
      board: []
    }));

    const heroCards = this.rawCards
      .filter((card) => card.type === 'DeckCards')
      .map((card) => this.createCard(card));

    const mainHeroCards = this.rawCards
      .filter((card) => card.type === 'MainHero')
      .map((card) => this.createCard(card));

    const monsterCards = this.rawCards
      .filter((card) => card.type === 'Monsters')
      .map((card) => this.createCard(card));

    const heroDeck = new Deck('DeckCards', heroCards);
    const mainHeroDeck = new Deck('MainHero', mainHeroCards);
    const monsterDeck = new Deck('Monsters', monsterCards);
    heroDeck.shuffle();
    mainHeroDeck.shuffle();
    monsterDeck.shuffle();

    this.state = {
      players: normalizedPlayers,
      heroDeck: heroDeck.cards,
      mainHeroDeck: mainHeroDeck.cards,
      monsterDeck: monsterDeck.cards,
      activeMonsters: [null, null, null],
      discardPile: [],
      approvalMode: false,
      phase: 'playing'
    };

    this.historyStack = [];
    this.restrictedLog.clear();
    this.approvalQueue.clear();
    this.disconnectedPlayers.clear();

    this.broadcastState();

    if (this.io) {
      this.io.emit('restricted_log', this.restrictedLog.getAll());
    }

    return this.getState();
  }

  getState() {
    return deepClone(this.state);
  }

  buildHiddenHand(hand) {
    return Array.isArray(hand)
      ? hand.map((card) => ({
          id: card.id,
          isFaceUp: false,
          ownerId: card.ownerId
        }))
      : [];
  }

  getStateForPlayer(playerId) {
    const filteredState = this.getState();

    filteredState.players = filteredState.players.map((player) => {
      if (player.id === playerId) {
        return player;
      }

      return {
        ...player,
        hand: this.buildHiddenHand(player.hand)
      };
    });

    return filteredState;
  }

  getStateForSpectator() {
    const filteredState = this.getState();

    filteredState.players = filteredState.players.map((player) => ({
      ...player,
      hand: this.buildHiddenHand(player.hand)
    }));

    return filteredState;
  }

  pushHistory() {
    this.historyStack.push(this.getState());
  }

  undo() {
    if (this.historyStack.length === 0) {
      return false;
    }

    const previousState = this.historyStack.pop();
    this.state = deepClone(previousState);
    return true;
  }

  executeAction(action, approverId, approverNickname) {
    const supportedActionTypes = new Set([
      'DRAW_HERO',
      'TAKE_MAIN_HERO_TO_BOARD',
      'RETURN_MAIN_HERO_TO_DECK',
      'REVEAL_MONSTER',
      'TAKE_MONSTER',
      'RETURN_ACTIVE_MONSTER_TO_BOTTOM',
      'TAKE_FROM_OPPONENT',
      'TAKE_FROM_DISCARD',
      'DISCARD_CARD',
      'ACTIVATE_CARD',
      'RETURN_CARD_TO_HAND',
      'UNDO'
    ]);

    if (!action || !supportedActionTypes.has(action.type)) {
      return false;
    }

    if (action.type !== 'UNDO') {
      this.pushHistory();
    }

    switch (action.type) {
      case 'DRAW_HERO':
        this.handleDrawHero(action);
        break;
      case 'TAKE_MAIN_HERO_TO_BOARD':
        this.handleTakeMainHeroToBoard(action);
        break;
      case 'RETURN_MAIN_HERO_TO_DECK':
        this.handleReturnMainHeroToDeck(action);
        break;
      case 'REVEAL_MONSTER':
        this.handleRevealMonster();
        break;
      case 'TAKE_MONSTER':
        this.handleTakeMonster(action);
        break;
      case 'RETURN_ACTIVE_MONSTER_TO_BOTTOM':
        this.handleReturnActiveMonsterToBottom(action);
        break;
      case 'TAKE_FROM_OPPONENT':
        this.handleTakeFromOpponent(action);
        break;
      case 'TAKE_FROM_DISCARD':
        this.handleTakeFromDiscard(action);
        break;
      case 'DISCARD_CARD':
        this.handleDiscardCard(action);
        break;
      case 'ACTIVATE_CARD':
        this.handleActivateCard(action);
        break;
      case 'RETURN_CARD_TO_HAND':
        this.handleReturnCardToHand(action);
        break;
      case 'UNDO':
        this.undo();
        break;
      default:
        return false;
    }

    this.broadcastState();

    this.restrictedLog.append({
      timestamp: new Date().toISOString(),
      playerNickname: action.requesterNickname || 'UnknownPlayer',
      actionType: action.type,
      details: action.details || this.describeAction(action.type, action.payload),
      approvedBy: approverNickname || 'AUTO'
    });

    if (this.io) {
      this.io.emit('restricted_log', this.restrictedLog.getAll());
    }

    return true;
  }

  requestAction(action, requesterId) {
    const requester = this.findPlayerById(requesterId);
    if (!requester || !action || !action.type) {
      return null;
    }

    const fullAction = {
      actionId: action.actionId || uuidv4(),
      type: action.type,
      requesterId,
      requesterSocketId: requester.socketId,
      requesterNickname: requester.nickname,
      payload: action.payload || {},
      details: action.details || this.describeAction(action.type, action.payload)
    };

    if (!this.state.approvalMode && fullAction.type !== 'UNDO') {
      this.executeAction(fullAction, 'AUTO', 'AUTO');
      return fullAction.actionId;
    }

    return this.approvalQueue.enqueue(
      fullAction,
      ({ approverId, approverNickname } = {}) => {
        this.executeAction(fullAction, approverId || null, approverNickname || 'UnknownApprover');
      },
      ({ reason } = {}) => {
        if (this.io) {
          this.io.emit('event_log', {
            message:
              reason === 'timeout'
                ? `${fullAction.requesterNickname}'s ${fullAction.type} request timed out.`
                : `${fullAction.requesterNickname}'s ${fullAction.type} request was denied.`,
            timestamp: new Date().toISOString()
          });
        }
      }
    );
  }

  toggleApprovalMode() {
    this.state.approvalMode = !this.state.approvalMode;
    this.broadcastState();
    return this.state.approvalMode;
  }

  broadcastState() {
    if (!this.io) {
      return;
    }

    for (const player of this.state.players) {
      if (!player.socketId) {
        continue;
      }

      this.io.to(player.socketId).emit('state_update', this.getStateForPlayer(player.id));
    }

    const spectatorState = this.getStateForSpectator();
    for (const [socketId] of this.spectators) {
      this.io.to(socketId).emit('state_update', spectatorState);
    }
  }

  reset() {
    this.state = this.createInitialState();
    this.historyStack = [];
    this.restrictedLog.clear();
    this.approvalQueue.clear();
    this.disconnectedPlayers.clear();

    if (this.io) {
      this.io.emit('restricted_log', this.restrictedLog.getAll());
    }

    this.broadcastState();
    return this.getState();
  }

  createInitialState() {
    return {
      players: [],
      heroDeck: [],
      mainHeroDeck: [],
      monsterDeck: [],
      activeMonsters: [null, null, null],
      discardPile: [],
      approvalMode: false,
      phase: 'lobby'
    };
  }

  createCard(rawCard) {
    const card = new Card(rawCard.id, rawCard.name, rawCard.type, rawCard.path);
    const bounds = this.getBoardBounds();

    card.isFaceUp = Boolean(rawCard.isFaceUp);
    card.ownerId = rawCard.ownerId || null;
    card.boardPosition =
      rawCard &&
      rawCard.boardPosition &&
      isFiniteNumber(rawCard.boardPosition.x) &&
      isFiniteNumber(rawCard.boardPosition.y)
        ? {
            x: clamp(rawCard.boardPosition.x, bounds.minX, bounds.maxX),
            y: clamp(rawCard.boardPosition.y, bounds.minY, bounds.maxY)
          }
        : null;

    return card;
  }

  getBoardBounds() {
    return {
      minX: 0,
      minY: 0,
      maxX: BOARD_SPACE_WIDTH - BOARD_CARD_WIDTH,
      maxY: BOARD_SPACE_HEIGHT - BOARD_CARD_HEIGHT
    };
  }

  getBoardAnchorForPlayer(playerIndex) {
    const safeIndex = Number.isInteger(playerIndex) ? Math.abs(playerIndex) : 0;

    return {
      x: 12 + (safeIndex % 2) * 8,
      y: 12 + (safeIndex % 3) * 6
    };
  }

  buildDefaultBoardPosition(playerIndex, cardIndex) {
    const safeCardIndex = Number.isInteger(cardIndex) && cardIndex >= 0 ? cardIndex : 0;
    const anchor = this.getBoardAnchorForPlayer(playerIndex);
    const bounds = this.getBoardBounds();

    const x = anchor.x + (safeCardIndex % 5) * 26;
    const y = anchor.y + Math.floor(safeCardIndex / 5) * 28;

    return {
      x: clamp(x, bounds.minX, bounds.maxX),
      y: clamp(y, bounds.minY, bounds.maxY)
    };
  }

  ensureBoardCardLayout(card, playerIndex, cardIndex) {
    if (!card || typeof card !== 'object') {
      return;
    }

    const bounds = this.getBoardBounds();
    const boardPosition = card.boardPosition;

    if (
      boardPosition &&
      typeof boardPosition === 'object' &&
      isFiniteNumber(boardPosition.x) &&
      isFiniteNumber(boardPosition.y)
    ) {
      card.boardPosition = {
        x: clamp(boardPosition.x, bounds.minX, bounds.maxX),
        y: clamp(boardPosition.y, bounds.minY, bounds.maxY)
      };
    } else {
      card.boardPosition = this.buildDefaultBoardPosition(playerIndex, cardIndex);
    }
  }

  clearBoardLayoutMetadata(card) {
    if (!card || typeof card !== 'object') {
      return;
    }

    delete card.boardPosition;
  }

  addCardToBoard(player, card) {
    if (!player || !card) {
      return;
    }

    if (!Array.isArray(player.board)) {
      player.board = [];
    }

    player.board.push(card);

    const playerIndex = this.state.players.findIndex((entry) => entry && entry.id === player.id);
    this.ensureBoardCardLayout(card, playerIndex, player.board.length - 1);
  }

  findBoardCard(cardId) {
    if (cardId === undefined || cardId === null || !Array.isArray(this.state.players)) {
      return null;
    }

    for (let playerIndex = 0; playerIndex < this.state.players.length; playerIndex += 1) {
      const player = this.state.players[playerIndex];
      const board = Array.isArray(player.board) ? player.board : [];

      for (let cardIndex = 0; cardIndex < board.length; cardIndex += 1) {
        const card = board[cardIndex];

        if (card && String(card.id) === String(cardId)) {
          return {
            player,
            playerIndex,
            card,
            cardIndex
          };
        }
      }
    }

    return null;
  }

  moveBoardCard({ cardId, targetPlayerId, x, y } = {}) {
    if (cardId === undefined || cardId === null) {
      return false;
    }

    if (!isFiniteNumber(x) || !isFiniteNumber(y)) {
      return false;
    }

    const located = this.findBoardCard(cardId);
    if (!located) {
      return false;
    }

    const sourcePlayer = located.player;
    const sourcePlayerIndex = located.playerIndex;
    const sourceBoard = Array.isArray(sourcePlayer.board) ? sourcePlayer.board : [];
    const resolvedTargetPlayerId =
      targetPlayerId === undefined || targetPlayerId === null ? sourcePlayer.id : targetPlayerId;
    const targetPlayer = this.findPlayerById(resolvedTargetPlayerId);

    if (!targetPlayer) {
      return false;
    }

    const targetPlayerIndex = this.state.players.findIndex(
      (entry) => entry && String(entry.id) === String(targetPlayer.id)
    );

    this.ensureBoardCardLayout(located.card, sourcePlayerIndex, located.cardIndex);

    const bounds = this.getBoardBounds();
    const nextPosition = {
      x: clamp(x, bounds.minX, bounds.maxX),
      y: clamp(y, bounds.minY, bounds.maxY)
    };

    if (String(sourcePlayer.id) !== String(targetPlayer.id)) {
      const [movedCard] = sourceBoard.splice(located.cardIndex, 1);
      if (!movedCard) {
        return false;
      }

      movedCard.ownerId = targetPlayer.id;
      movedCard.boardPosition = nextPosition;

      if (!Array.isArray(targetPlayer.board)) {
        targetPlayer.board = [];
      }

      targetPlayer.board.push(movedCard);
      this.ensureBoardCardLayout(movedCard, targetPlayerIndex, targetPlayer.board.length - 1);
      movedCard.boardPosition = nextPosition;

      return true;
    }

    located.card.boardPosition = nextPosition;

    return true;
  }

  findPlayerById(playerId) {
    return this.state.players.find((player) => String(player.id) === String(playerId));
  }

  markDisconnected(player) {
    if (!player) {
      return null;
    }

    const nicknameKey = toNicknameKey(player.nickname);
    if (!nicknameKey) {
      return null;
    }

    player.socketId = null;
    player.isDisconnected = true;
    this.disconnectedPlayers.set(nicknameKey, {
      player,
      disconnectedAt: Date.now()
    });

    return player;
  }

  findDisconnectedSlot(nickname) {
    const nicknameKey = toNicknameKey(nickname);
    if (!nicknameKey) {
      return null;
    }

    const entry = this.disconnectedPlayers.get(nicknameKey);
    return entry ? entry.player : null;
  }

  reconnectPlayer(nickname, newSocketId) {
    const player = this.findDisconnectedSlot(nickname);
    if (!player) {
      return null;
    }

    player.socketId = newSocketId;
    player.isDisconnected = false;
    this.disconnectedPlayers.delete(toNicknameKey(player.nickname));

    return {
      player,
      gameState: this.getStateForPlayer(player.id)
    };
  }

  addSpectator(socketId, displayName) {
    const safeDisplayName =
      typeof displayName === 'string' && displayName.trim().length > 0 ? displayName.trim() : 'Spectator';

    const spectator = {
      socketId,
      displayName: safeDisplayName
    };

    this.spectators.set(socketId, spectator);
    return spectator;
  }

  removeSpectator(socketId) {
    this.spectators.delete(socketId);
  }

  getSpectators() {
    return Array.from(this.spectators.values()).map((spectator) => ({
      socketId: spectator.socketId,
      displayName: spectator.displayName
    }));
  }

  describeAction(type, payload) {
    const safePayload = payload || {};

    switch (type) {
      case 'DRAW_HERO':
        return 'drew from DeckCards pile';
      case 'TAKE_MAIN_HERO_TO_BOARD':
        return `took MainHero ${safePayload.cardId || ''} to board`.trim();
      case 'RETURN_MAIN_HERO_TO_DECK':
        return `returned MainHero ${safePayload.cardId || ''} to MainHero Deck`.trim();
      case 'REVEAL_MONSTER':
        return 'revealed top Monsters card';
      case 'TAKE_MONSTER':
        return `took Monsters ${safePayload.cardId || ''}`.trim();
      case 'RETURN_ACTIVE_MONSTER_TO_BOTTOM':
        return `returned active Monsters ${safePayload.cardId || ''} to bottom deck`.trim();
      case 'TAKE_FROM_OPPONENT':
        return `took card ${safePayload.cardId || ''} from opponent ${
          safePayload.fromPlayerId || safePayload.targetPlayerId || ''
        }`.trim();
      case 'TAKE_FROM_DISCARD':
        return `took card ${safePayload.cardId ?? ''} from discard pile`.trim();
      case 'DISCARD_CARD':
        return `discarded card ${safePayload.cardId || ''}`.trim();
      case 'ACTIVATE_CARD':
        return `activated card ${safePayload.cardId || ''}`.trim();
      case 'RETURN_CARD_TO_HAND':
        return `returned card ${safePayload.cardId || ''} to hand`.trim();
      case 'UNDO':
        return 'reverted above action';
      default:
        return 'performed restricted action';
    }
  }

  handleDrawHero(action) {
    const player = this.findPlayerById(action.requesterId);
    if (!player || this.state.heroDeck.length === 0) {
      return;
    }

    const card = this.state.heroDeck.shift();
    card.ownerId = player.id;
    card.isFaceUp = true;
    player.hand.push(card);
  }

  handleTakeMainHeroToBoard(action) {
    const requester = this.findPlayerById(action.requesterId);
    if (!requester) {
      return;
    }

    if (!Array.isArray(this.state.mainHeroDeck)) {
      this.state.mainHeroDeck = [];
    }

    const mainHeroDeck = this.state.mainHeroDeck;
    if (mainHeroDeck.length === 0) {
      return;
    }

    const payload = action.payload || {};
    const cardId = payload.cardId;

    if (cardId === undefined || cardId === null) {
      return;
    }

    const cardIndex = mainHeroDeck.findIndex((card) => String(card.id) === String(cardId));
    if (cardIndex === -1) {
      return;
    }

    const [takenCard] = mainHeroDeck.splice(cardIndex, 1);
    if (!takenCard) {
      return;
    }

    takenCard.ownerId = requester.id;
    takenCard.isFaceUp = true;
    this.addCardToBoard(requester, takenCard);
  }

  handleReturnMainHeroToDeck(action) {
    const requester = this.findPlayerById(action.requesterId);
    if (!requester) {
      return;
    }

    if (!Array.isArray(this.state.mainHeroDeck)) {
      this.state.mainHeroDeck = [];
    }

    const mainHeroDeck = this.state.mainHeroDeck;
    const payload = action.payload || {};
    const cardId = payload.cardId;

    if (cardId === undefined || cardId === null) {
      return;
    }

    const board = Array.isArray(requester.board) ? requester.board : [];
    if (board.length === 0) {
      return;
    }

    const cardIndex = board.findIndex(
      (card) => card && card.type === 'MainHero' && String(card.id) === String(cardId)
    );
    if (cardIndex === -1) {
      return;
    }

    const [returnedCard] = board.splice(cardIndex, 1);
    if (!returnedCard) {
      return;
    }

    this.clearBoardLayoutMetadata(returnedCard);
    returnedCard.ownerId = null;
    returnedCard.isFaceUp = false;
    mainHeroDeck.push(returnedCard);
  }

  handleRevealMonster() {
    if (this.state.monsterDeck.length === 0) {
      return;
    }

    const slotIndex = this.state.activeMonsters.findIndex((monster) => monster === null);
    if (slotIndex === -1) {
      return;
    }

    const monsterCard = this.state.monsterDeck.shift();
    monsterCard.ownerId = null;
    monsterCard.isFaceUp = true;
    this.state.activeMonsters[slotIndex] = monsterCard;
  }

  handleTakeMonster(action) {
    const player = this.findPlayerById(action.requesterId);
    if (!player) {
      return;
    }

    const payload = action.payload || {};

    let slotIndex = Number.isInteger(payload.slotIndex) ? payload.slotIndex : -1;
    if (slotIndex < 0 || slotIndex >= this.state.activeMonsters.length) {
      slotIndex = this.state.activeMonsters.findIndex(
        (monster) => monster && (payload.cardId ? monster.id === payload.cardId : true)
      );
    }

    if (slotIndex === -1 || !this.state.activeMonsters[slotIndex]) {
      return;
    }

    const [takenMonster] = this.state.activeMonsters.splice(slotIndex, 1, null);
    takenMonster.ownerId = player.id;
    takenMonster.isFaceUp = true;
    this.addCardToBoard(player, takenMonster);
  }

  handleReturnActiveMonsterToBottom(action) {
    const payload = action.payload || {};

    let slotIndex = Number.isInteger(payload.slotIndex) ? payload.slotIndex : -1;
    if (slotIndex < 0 || slotIndex >= this.state.activeMonsters.length) {
      slotIndex = this.state.activeMonsters.findIndex(
        (monster) => monster && (payload.cardId ? String(monster.id) === String(payload.cardId) : true)
      );
    }

    if (slotIndex === -1 || !this.state.activeMonsters[slotIndex]) {
      return;
    }

    const [monsterCard] = this.state.activeMonsters.splice(slotIndex, 1, null);
    if (!monsterCard) {
      return;
    }

    monsterCard.ownerId = null;
    monsterCard.isFaceUp = false;
    this.state.monsterDeck.push(monsterCard);
  }

  handleTakeFromOpponent(action) {
    const requester = this.findPlayerById(action.requesterId);
    if (!requester) {
      return;
    }

    const payload = action.payload || {};
    const opponentId =
      payload.fromPlayerId || payload.targetPlayerId || payload.opponentId || payload.sourcePlayerId;
    const opponent = this.findPlayerById(opponentId);

    if (!opponent || opponent.id === requester.id || opponent.hand.length === 0) {
      return;
    }

    let cardIndex = -1;
    if (payload.cardId !== undefined && payload.cardId !== null) {
      cardIndex = opponent.hand.findIndex((card) => card.id === payload.cardId);
    }

    if (cardIndex === -1) {
      cardIndex = 0;
    }

    const [takenCard] = opponent.hand.splice(cardIndex, 1);
    if (!takenCard) {
      return;
    }

    takenCard.ownerId = requester.id;
    takenCard.isFaceUp = true;
    requester.hand.push(takenCard);
  }

  handleTakeFromDiscard(action) {
    const requester = this.findPlayerById(action.requesterId);
    const discardPile = Array.isArray(this.state.discardPile) ? this.state.discardPile : [];

    if (!requester || discardPile.length === 0) {
      return;
    }

    const payload = action.payload || {};
    const cardId = payload.cardId;

    // Safe fallback for missing cardId: do nothing.
    if (cardId === undefined || cardId === null) {
      return;
    }

    const cardIndex = discardPile.findIndex((card) => String(card.id) === String(cardId));
    if (cardIndex === -1) {
      return;
    }

    const [takenCard] = discardPile.splice(cardIndex, 1);
    if (!takenCard) {
      return;
    }

    takenCard.ownerId = requester.id;
    takenCard.isFaceUp = true;
    requester.hand.push(takenCard);
  }

  handleDiscardCard(action) {
    const player = this.findPlayerById(action.requesterId);
    if (!player) {
      return;
    }

    const payload = action.payload || {};
    const zone = payload.zone;
    const cardId = payload.cardId;

    const zonesToSearch = zone === 'hand' || zone === 'board' ? [zone] : ['hand', 'board'];
    let discardedCard = null;
    let discardedFromZone = null;

    for (const zoneName of zonesToSearch) {
      const cardArray = player[zoneName];
      if (!Array.isArray(cardArray) || cardArray.length === 0) {
        continue;
      }

      let cardIndex = -1;
      if (cardId !== undefined && cardId !== null) {
        cardIndex = cardArray.findIndex((card) => card.id === cardId);
      } else {
        cardIndex = 0;
      }

      if (cardIndex === -1) {
        continue;
      }

      [discardedCard] = cardArray.splice(cardIndex, 1);
      discardedFromZone = zoneName;
      break;
    }

    if (!discardedCard) {
      return;
    }

    if (discardedFromZone === 'board') {
      this.clearBoardLayoutMetadata(discardedCard);
    }

    discardedCard.ownerId = null;
    discardedCard.isFaceUp = true;
    this.state.discardPile.push(discardedCard);
  }

  handleActivateCard(action) {
    const player = this.findPlayerById(action.requesterId);
    if (!player) {
      return;
    }

    const payload = action.payload || {};
    const cardId = payload.cardId;

    // Safe fallback for missing cardId: do nothing.
    if (cardId === undefined || cardId === null) {
      return;
    }

    const hand = Array.isArray(player.hand) ? player.hand : [];
    if (hand.length === 0) {
      return;
    }

    const cardIndex = hand.findIndex((card) => String(card.id) === String(cardId));
    if (cardIndex === -1) {
      return;
    }

    const [activatedCard] = hand.splice(cardIndex, 1);
    if (!activatedCard) {
      return;
    }

    activatedCard.ownerId = player.id;
    this.addCardToBoard(player, activatedCard);
  }

  handleReturnCardToHand(action) {
    const player = this.findPlayerById(action.requesterId);
    if (!player) {
      return;
    }

    const payload = action.payload || {};
    const cardId = payload.cardId;

    // Safe fallback for missing cardId: do nothing.
    if (cardId === undefined || cardId === null) {
      return;
    }

    const board = Array.isArray(player.board) ? player.board : [];
    if (board.length === 0) {
      return;
    }

    const cardIndex = board.findIndex((card) => String(card.id) === String(cardId));
    if (cardIndex === -1) {
      return;
    }

    const [returnedCard] = board.splice(cardIndex, 1);
    if (!returnedCard) {
      return;
    }

    this.clearBoardLayoutMetadata(returnedCard);
    returnedCard.ownerId = player.id;
    player.hand.push(returnedCard);
  }
}

GameManager.instance = null;

module.exports = GameManager;