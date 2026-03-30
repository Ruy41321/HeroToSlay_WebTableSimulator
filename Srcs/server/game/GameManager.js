// ============================================================
// FILE: server/game/GameManager.js
// ============================================================

const { v4: uuidv4 } = require('uuid');

const Card = require('../models/Card');
const Deck = require('../models/Deck');
const ApprovalQueue = require('./ApprovalQueue');
const RestrictedLog = require('./RestrictedLog');

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
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

      return GameManager.instance;
    }

    this.io = io;
    this.rawCards = Array.isArray(cards) ? cards : [];
    this.approvalQueue = new ApprovalQueue(io);
    this.restrictedLog = new RestrictedLog();
    this.historyStack = [];
    this.state = this.createInitialState();

    GameManager.instance = this;
  }

  startGame(players) {
    const safePlayers = Array.isArray(players) ? players : [];
    const normalizedPlayers = safePlayers.map((player) => ({
      ...player,
      hand: [],
      board: []
    }));

    const heroCards = this.rawCards
      .filter((card) => card.type === 'hero')
      .map((card) => this.createCard(card));

    const monsterCards = this.rawCards
      .filter((card) => card.type === 'monster')
      .map((card) => this.createCard(card));

    const heroDeck = new Deck('hero', heroCards);
    const monsterDeck = new Deck('monster', monsterCards);
    heroDeck.shuffle();
    monsterDeck.shuffle();

    this.state = {
      players: normalizedPlayers,
      heroDeck: heroDeck.cards,
      monsterDeck: monsterDeck.cards,
      activeMonsters: [null, null, null],
      discardPile: [],
      approvalMode: true,
      phase: 'playing'
    };

    this.historyStack = [];
    this.restrictedLog.clear();
    this.approvalQueue.clear();

    this.broadcastState();

    if (this.io) {
      this.io.emit('restricted_log', this.restrictedLog.getAll());
    }

    return this.getState();
  }

  getState() {
    return deepClone(this.state);
  }

  getStateForPlayer(playerId) {
    const filteredState = this.getState();

    filteredState.players = filteredState.players.map((player) => {
      if (player.id === playerId) {
        return player;
      }

      const hiddenHand = Array.isArray(player.hand)
        ? player.hand.map((card) => ({
            id: card.id,
            isFaceUp: false,
            ownerId: card.ownerId
          }))
        : [];

      return {
        ...player,
        hand: hiddenHand
      };
    });

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
      'REVEAL_MONSTER',
      'TAKE_MONSTER',
      'TAKE_FROM_OPPONENT',
      'DISCARD_CARD',
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
      case 'REVEAL_MONSTER':
        this.handleRevealMonster();
        break;
      case 'TAKE_MONSTER':
        this.handleTakeMonster(action);
        break;
      case 'TAKE_FROM_OPPONENT':
        this.handleTakeFromOpponent(action);
        break;
      case 'DISCARD_CARD':
        this.handleDiscardCard(action);
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
      requesterNickname: requester.nickname,
      payload: action.payload || {},
      details: action.details || this.describeAction(action.type, action.payload)
    };

    if (!this.state.approvalMode && fullAction.type !== 'UNDO') {
      this.executeAction(fullAction, 'AUTO', 'AUTO');
      return fullAction.actionId;
    }

    this.approvalQueue.enqueue(
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

    return fullAction.actionId;
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
  }

  reset() {
    this.state = this.createInitialState();
    this.historyStack = [];
    this.restrictedLog.clear();
    this.approvalQueue.clear();

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
      monsterDeck: [],
      activeMonsters: [null, null, null],
      discardPile: [],
      approvalMode: true,
      phase: 'lobby'
    };
  }

  createCard(rawCard) {
    const card = new Card(rawCard.id, rawCard.name, rawCard.type, rawCard.path);
    card.isFaceUp = Boolean(rawCard.isFaceUp);
    card.ownerId = rawCard.ownerId || null;
    return card;
  }

  findPlayerById(playerId) {
    return this.state.players.find((player) => player.id === playerId);
  }

  describeAction(type, payload) {
    const safePayload = payload || {};

    switch (type) {
      case 'DRAW_HERO':
        return 'drew from Hero Deck';
      case 'REVEAL_MONSTER':
        return 'revealed top Monster card';
      case 'TAKE_MONSTER':
        return `took Monster ${safePayload.cardId || ''}`.trim();
      case 'TAKE_FROM_OPPONENT':
        return `took card ${safePayload.cardId || ''} from opponent ${
          safePayload.fromPlayerId || safePayload.targetPlayerId || ''
        }`.trim();
      case 'DISCARD_CARD':
        return `discarded card ${safePayload.cardId || ''}`.trim();
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
    card.isFaceUp = false;
    player.hand.push(card);
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
    player.board.push(takenMonster);
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
    takenCard.isFaceUp = false;
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
      break;
    }

    if (!discardedCard) {
      return;
    }

    discardedCard.ownerId = null;
    discardedCard.isFaceUp = true;
    this.state.discardPile.push(discardedCard);
  }
}

GameManager.instance = null;

module.exports = GameManager;