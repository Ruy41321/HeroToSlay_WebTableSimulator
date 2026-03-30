// ============================================================
// FILE: public/components/GameView.js
// ============================================================

(function registerGameViewComponent() {
  const BOARD_CARD_WIDTH = 80;
  const BOARD_CARD_HEIGHT = 112;
  const CANONICAL_BOARD_SPACE = {
    width: 340,
    height: 220
  };
  const BOARD_SPACES = {
    horizontal: {
      width: 500,
      height: 244
    },
    vertical: {
      width: 244,
      height: 500
    }
  };

  function normalizeBoardSide(side) {
    if (side === 'top' || side === 'left' || side === 'right' || side === 'bottom') {
      return side;
    }

    return 'bottom';
  }

  function getBoardSpaceBySide(side) {
    const normalized = normalizeBoardSide(side);

    if (normalized === 'left' || normalized === 'right') {
      return BOARD_SPACES.vertical;
    }

    return BOARD_SPACES.horizontal;
  }

  function getMovableBoardBoundsBySide(side) {
    const boardSpace = getBoardSpaceBySide(side);

    return {
      maxX: Math.max(boardSpace.width - BOARD_CARD_WIDTH, 0),
      maxY: Math.max(boardSpace.height - BOARD_CARD_HEIGHT, 0)
    };
  }

  function getCanonicalMovableBoardBounds() {
    return {
      maxX: Math.max(CANONICAL_BOARD_SPACE.width - BOARD_CARD_WIDTH, 0),
      maxY: Math.max(CANONICAL_BOARD_SPACE.height - BOARD_CARD_HEIGHT, 0)
    };
  }

  function install(app) {
    app.component('game-view', {
      props: {
        gameState: {
          type: Object,
          required: true
        },
        localPlayerId: {
          type: String,
          default: null
        },
        isSpectator: {
          type: Boolean,
          default: false
        },
        pendingApproval: {
          type: Object,
          default: null
        },
        pendingOwnRequest: {
          type: Object,
          default: null
        },
        eventLogEntries: {
          type: Array,
          default: () => []
        },
        restrictedLogEntries: {
          type: Array,
          default: () => []
        },
        showEventLog: {
          type: Boolean,
          default: false
        },
        showRestrictedLog: {
          type: Boolean,
          default: false
        },
        lastDiceRoll: {
          type: Number,
          default: null
        },
        approvalMode: {
          type: Boolean,
          default: false
        },
        showDiscardModal: {
          type: Boolean,
          default: false
        },
        discardPileModal: {
          type: Array,
          default: () => []
        },
        showMainHeroModal: {
          type: Boolean,
          default: false
        },
        mainHeroPileModal: {
          type: Array,
          default: () => []
        }
      },
      emits: [
        'request-action',
        'respond-approval',
        'flip-card',
        'move-board-card',
        'view-discard',
        'view-main-hero-deck',
        'close-discard-modal',
        'close-main-hero-modal',
        'roll-dice',
        'toggle-approval',
        'toggle-event-log',
        'toggle-restricted-log',
        'reset-lobby',
        'cycle-background'
      ],
      data() {
        return {
          hoveredCard: null,
          contextMenuVisible: false,
          contextMenuX: 0,
          contextMenuY: 0,
          contextMenuOptions: [],
          localBoardCardMoveOverrides: {},
          localBoardRotationByCardId: {},
          boardOverrideCleanupTimers: {},
          dragState: null,
          activeDragCardId: null,
          lastBoardContainerByCardId: {}
        };
      },
      mounted() {
        window.addEventListener('keydown', this.onGlobalKeyDown);
      },
      beforeUnmount() {
        window.removeEventListener('keydown', this.onGlobalKeyDown);
        this.detachBoardDragListeners();
        this.clearAllBoardOverrideTimers();
      },
      computed: {
        players() {
          return Array.isArray(this.gameState.players) ? this.gameState.players : [];
        },
        effectiveLocalPlayerId() {
          if (this.localPlayerId) {
            return this.localPlayerId;
          }

          if (this.isSpectator && this.players.length > 0) {
            return this.players[0].id;
          }

          return null;
        },
        localPlayer() {
          return (
            this.players.find((player) => String(player.id) === String(this.effectiveLocalPlayerId)) || null
          );
        },
        opponents() {
          return this.players.filter((player) => String(player.id) !== String(this.effectiveLocalPlayerId));
        },
        topOpponent() {
          return this.opponents[0] || null;
        },
        leftOpponent() {
          return this.opponents[1] || null;
        },
        rightOpponent() {
          return this.opponents[2] || null;
        },
        serverBoardContainerByCardId() {
          const snapshot = {};

          for (const player of this.players) {
            const playerId = String(player.id);
            const board = Array.isArray(player.board) ? player.board : [];

            for (const card of board) {
              if (!card) {
                continue;
              }

              snapshot[String(card.id)] = playerId;
            }
          }

          return snapshot;
        },
        boardCardsByPlayerId() {
          const grouped = {};

          for (const player of this.players) {
            grouped[String(player.id)] = [];
          }

          for (const player of this.players) {
            const playerId = String(player.id);
            const board = Array.isArray(player.board) ? player.board : [];

            board.forEach((card, cardIndex) => {
              if (!card) {
                return;
              }

              const cardId = String(card.id);
              const moveOverride = this.localBoardCardMoveOverrides[cardId] || null;
              const rawTargetId = moveOverride && moveOverride.targetPlayerId ? String(moveOverride.targetPlayerId) : playerId;
              const targetPlayerId = Object.prototype.hasOwnProperty.call(grouped, rawTargetId)
                ? rawTargetId
                : playerId;
              const targetBoardSide = this.getBoardSideByPlayerId(targetPlayerId);
              const baseCanonicalPosition = this.getSanitizedBoardPosition(card.boardPosition, cardIndex);
              const runtimeCanonicalPosition =
                moveOverride && this.isFiniteNumber(moveOverride.x) && this.isFiniteNumber(moveOverride.y)
                  ? this.getSanitizedBoardPosition({ x: moveOverride.x, y: moveOverride.y }, cardIndex)
                  : baseCanonicalPosition;
              const runtimePosition = this.fromCanonicalToSideBoardCoordinates(
                runtimeCanonicalPosition,
                targetBoardSide
              );

              grouped[targetPlayerId].push({
                ...card,
                ownerId: card.ownerId || player.id,
                boardPosition: runtimePosition,
                canonicalBoardPosition: runtimeCanonicalPosition,
                boardContainerPlayerId: targetPlayerId,
                localRotationDelta: this.normalizeBoardRotationDelta(this.localBoardRotationByCardId[cardId])
              });
            });
          }

          return grouped;
        },
        safeHeroDeck() {
          return Array.isArray(this.gameState.heroDeck) ? this.gameState.heroDeck : [];
        },
        safeMainHeroDeck() {
          return Array.isArray(this.gameState.mainHeroDeck) ? this.gameState.mainHeroDeck : [];
        },
        safeMonsterDeck() {
          return Array.isArray(this.gameState.monsterDeck) ? this.gameState.monsterDeck : [];
        },
        safeActiveMonsters() {
          return Array.isArray(this.gameState.activeMonsters) ? this.gameState.activeMonsters : [null, null, null];
        },
        safeDiscardPile() {
          return Array.isArray(this.gameState.discardPile) ? this.gameState.discardPile : [];
        },
        visibleApprovalRequest() {
          if (this.isSpectator) {
            return null;
          }

          if (!this.pendingApproval) {
            return null;
          }

          if (
            this.pendingApproval.requesterId &&
            this.localPlayerId &&
            String(this.pendingApproval.requesterId) === String(this.localPlayerId)
          ) {
            return null;
          }

          if (
            this.localPlayer &&
            this.pendingApproval.requesterNickname &&
            this.localPlayer.nickname &&
            this.pendingApproval.requesterNickname.toLowerCase() === this.localPlayer.nickname.toLowerCase()
          ) {
            return null;
          }

          return this.pendingApproval;
        }
      },
      watch: {
        serverBoardContainerByCardId: {
          immediate: true,
          handler(nextSnapshot) {
            const previousSnapshot = this.lastBoardContainerByCardId || {};

            Object.keys(nextSnapshot).forEach((cardId) => {
              if (
                previousSnapshot[cardId] &&
                String(previousSnapshot[cardId]) !== String(nextSnapshot[cardId])
              ) {
                delete this.localBoardRotationByCardId[cardId];
                this.clearBoardCardMoveOverride(cardId);
              }
            });

            Object.keys(this.localBoardRotationByCardId).forEach((cardId) => {
              if (!Object.prototype.hasOwnProperty.call(nextSnapshot, cardId)) {
                delete this.localBoardRotationByCardId[cardId];
              }
            });

            Object.keys(this.localBoardCardMoveOverrides).forEach((cardId) => {
              if (!Object.prototype.hasOwnProperty.call(nextSnapshot, cardId)) {
                this.clearBoardCardMoveOverride(cardId);
              }
            });

            this.lastBoardContainerByCardId = { ...nextSnapshot };

            if (!this.dragState) {
              return;
            }

            const activeCardId = String(this.dragState.cardId);
            const cardStillVisible = Object.prototype.hasOwnProperty.call(nextSnapshot, activeCardId);

            if (!cardStillVisible) {
              this.stopBoardDrag(false);
            }

            const expectedTarget = String(this.dragState.activeTargetPlayerId || this.dragState.originPlayerId);
            if (nextSnapshot[activeCardId] && String(nextSnapshot[activeCardId]) === expectedTarget) {
              this.clearBoardCardMoveOverride(activeCardId);
            }
          }
        }
      },
      methods: {
        isFiniteNumber(value) {
          return typeof value === 'number' && Number.isFinite(value);
        },
        normalizeBoardRotationDelta(rotation) {
          if (!this.isFiniteNumber(rotation)) {
            return 0;
          }

          const snapped = Math.round(rotation / 90) * 90;
          return ((snapped % 360) + 360) % 360;
        },
        isBoardCardOwnedByLocalPlayer(card) {
          const ownerId = card && card.ownerId ? String(card.ownerId) : null;
          return Boolean(ownerId && this.localPlayerId && ownerId === String(this.localPlayerId));
        },
        getBoardSideByPlayerId(playerId) {
          const normalizedPlayerId = String(playerId);

          if (this.localPlayer && String(this.localPlayer.id) === normalizedPlayerId) {
            return 'bottom';
          }

          if (this.topOpponent && String(this.topOpponent.id) === normalizedPlayerId) {
            return 'top';
          }

          if (this.leftOpponent && String(this.leftOpponent.id) === normalizedPlayerId) {
            return 'left';
          }

          if (this.rightOpponent && String(this.rightOpponent.id) === normalizedPlayerId) {
            return 'right';
          }

          return 'bottom';
        },
        getSideMovableBounds(boardSide = 'bottom') {
          return getMovableBoardBoundsBySide(boardSide);
        },
        getCanonicalMovableBounds() {
          return getCanonicalMovableBoardBounds();
        },
        clampRatio(value) {
          if (!this.isFiniteNumber(value)) {
            return 0;
          }

          return Math.min(Math.max(value, 0), 1);
        },
        toNormalizedRatio(value, max) {
          if (!this.isFiniteNumber(value) || !this.isFiniteNumber(max) || max <= 0) {
            return 0;
          }

          return this.clampRatio(value / max);
        },
        fromNormalizedRatio(value, max) {
          if (!this.isFiniteNumber(max) || max <= 0) {
            return 0;
          }

          return Math.round(this.clampRatio(value) * max);
        },
        mapCanonicalRatiosToSide(u, v, boardSide = 'bottom') {
          const side = normalizeBoardSide(boardSide);

          switch (side) {
            case 'top':
              return { u: 1 - u, v: 1 - v };
            case 'right':
              return { u: v, v: 1 - u };
            case 'left':
              return { u: 1 - v, v: u };
            default:
              return { u, v };
          }
        },
        mapSideRatiosToCanonical(u, v, boardSide = 'bottom') {
          const side = normalizeBoardSide(boardSide);

          switch (side) {
            case 'top':
              return { u: 1 - u, v: 1 - v };
            case 'right':
              return { u: 1 - v, v: u };
            case 'left':
              return { u: v, v: 1 - u };
            default:
              return { u, v };
          }
        },
        getFallbackBoardPosition(cardIndex = 0) {
          const safeIndex = Number.isInteger(cardIndex) && cardIndex >= 0 ? cardIndex : 0;
          return this.clampBoardCoordinates(
            12 + (safeIndex % 5) * 26,
            12 + Math.floor(safeIndex / 5) * 28
          );
        },
        getSanitizedBoardPosition(position, cardIndex = 0) {
          if (
            position &&
            typeof position === 'object' &&
            this.isFiniteNumber(position.x) &&
            this.isFiniteNumber(position.y)
          ) {
            return this.clampBoardCoordinates(position.x, position.y);
          }

          return this.getFallbackBoardPosition(cardIndex);
        },
        clampBoardCoordinatesForSide(x, y, boardSide = 'bottom') {
          const bounds = this.getSideMovableBounds(boardSide);

          return {
            x: Math.round(Math.min(Math.max(x, 0), bounds.maxX)),
            y: Math.round(Math.min(Math.max(y, 0), bounds.maxY))
          };
        },
        clampPointerCoordinatesForSide(x, y, boardSide = 'bottom') {
          const boardSpace = getBoardSpaceBySide(boardSide);

          return {
            x: Math.round(Math.min(Math.max(x, 0), boardSpace.width)),
            y: Math.round(Math.min(Math.max(y, 0), boardSpace.height))
          };
        },
        clampBoardCoordinates(x, y) {
          const bounds = this.getCanonicalMovableBounds();

          return {
            x: Math.round(Math.min(Math.max(x, 0), bounds.maxX)),
            y: Math.round(Math.min(Math.max(y, 0), bounds.maxY))
          };
        },
        fromCanonicalToSideBoardCoordinates(position, boardSide = 'bottom') {
          const canonicalPosition = this.getSanitizedBoardPosition(position, 0);
          const canonicalBounds = this.getCanonicalMovableBounds();
          const sideBounds = this.getSideMovableBounds(boardSide);
          const canonicalU = this.toNormalizedRatio(canonicalPosition.x, canonicalBounds.maxX);
          const canonicalV = this.toNormalizedRatio(canonicalPosition.y, canonicalBounds.maxY);
          const mapped = this.mapCanonicalRatiosToSide(canonicalU, canonicalV, boardSide);

          return {
            x: this.fromNormalizedRatio(mapped.u, sideBounds.maxX),
            y: this.fromNormalizedRatio(mapped.v, sideBounds.maxY)
          };
        },
        fromSideToCanonicalBoardCoordinates(position, boardSide = 'bottom') {
          if (
            !position ||
            typeof position !== 'object' ||
            !this.isFiniteNumber(position.x) ||
            !this.isFiniteNumber(position.y)
          ) {
            return this.getFallbackBoardPosition(0);
          }

          const sidePosition = this.clampBoardCoordinatesForSide(position.x, position.y, boardSide);
          const sideBounds = this.getSideMovableBounds(boardSide);
          const canonicalBounds = this.getCanonicalMovableBounds();
          const sideU = this.toNormalizedRatio(sidePosition.x, sideBounds.maxX);
          const sideV = this.toNormalizedRatio(sidePosition.y, sideBounds.maxY);
          const mapped = this.mapSideRatiosToCanonical(sideU, sideV, boardSide);

          return {
            x: this.fromNormalizedRatio(mapped.u, canonicalBounds.maxX),
            y: this.fromNormalizedRatio(mapped.v, canonicalBounds.maxY)
          };
        },
        getBoardCardsForPlayer(playerId) {
          const key = String(playerId);
          const cards = this.boardCardsByPlayerId[key];
          return Array.isArray(cards) ? cards : [];
        },
        setLocalBoardCardMoveOverride(cardId, state) {
          const key = String(cardId);
          if (!key) {
            return;
          }

          this.cancelBoardCardOverrideCleanup(key);

          this.localBoardCardMoveOverrides[key] = {
            targetPlayerId: state && state.targetPlayerId ? String(state.targetPlayerId) : null,
            x: this.isFiniteNumber(state.x) ? state.x : 0,
            y: this.isFiniteNumber(state.y) ? state.y : 0
          };
        },
        clearBoardCardMoveOverride(cardId) {
          const key = String(cardId);
          if (!Object.prototype.hasOwnProperty.call(this.localBoardCardMoveOverrides, key)) {
            return;
          }

          delete this.localBoardCardMoveOverrides[key];
        },
        cancelBoardCardOverrideCleanup(cardId) {
          const key = String(cardId);
          const timerId = this.boardOverrideCleanupTimers[key];

          if (timerId) {
            clearTimeout(timerId);
            delete this.boardOverrideCleanupTimers[key];
          }
        },
        queueBoardCardOverrideCleanup(cardId) {
          const key = String(cardId);
          if (!key) {
            return;
          }

          this.cancelBoardCardOverrideCleanup(key);
          this.boardOverrideCleanupTimers[key] = setTimeout(() => {
            if (this.dragState && String(this.dragState.cardId) === key) {
              return;
            }

            this.clearBoardCardMoveOverride(key);
            delete this.boardOverrideCleanupTimers[key];
          }, 500);
        },
        clearAllBoardOverrideTimers() {
          Object.keys(this.boardOverrideCleanupTimers).forEach((cardId) => {
            clearTimeout(this.boardOverrideCleanupTimers[cardId]);
          });

          this.boardOverrideCleanupTimers = {};
        },
        getBoardElements() {
          if (!this.$el) {
            return [];
          }

          const elements = Array.from(this.$el.querySelectorAll('.player-board[data-player-id]'));

          return elements.map((element) => ({
            element,
            playerId: element.dataset.playerId ? String(element.dataset.playerId) : '',
            boardSide: element.dataset.boardSide || 'bottom'
          }));
        },
        getBoardElementByPlayerId(playerId) {
          const safePlayerId = String(playerId);
          return this.getBoardElements().find((entry) => entry.playerId === safePlayerId) || null;
        },
        findBoardUnderPointer(clientX, clientY) {
          const boardEntries = this.getBoardElements();

          for (const entry of boardEntries) {
            const rect = entry.element.getBoundingClientRect();
            if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
              return entry;
            }
          }

          return null;
        },
        toBoardCoordinates(event, boardElement, boardSide = 'bottom') {
          if (!event || !boardElement || !(boardElement instanceof HTMLElement)) {
            return null;
          }

          const rect = boardElement.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) {
            return null;
          }

          const boardSpace = getBoardSpaceBySide(boardSide);

          const x = ((event.clientX - rect.left) / rect.width) * boardSpace.width;
          const y = ((event.clientY - rect.top) / rect.height) * boardSpace.height;

          return this.clampPointerCoordinatesForSide(x, y, boardSide);
        },
        attachBoardDragListeners() {
          window.addEventListener('pointermove', this.onWindowPointerMove, { passive: false });
          window.addEventListener('pointerup', this.onWindowPointerUp, { passive: false });
          window.addEventListener('pointercancel', this.onWindowPointerUp, { passive: false });
        },
        detachBoardDragListeners() {
          window.removeEventListener('pointermove', this.onWindowPointerMove);
          window.removeEventListener('pointerup', this.onWindowPointerUp);
          window.removeEventListener('pointercancel', this.onWindowPointerUp);
        },
        onBoardCardPointerDown(payload = {}) {
          const event = payload.event;
          const card = payload.card;
          const boardPlayerId = payload.boardPlayerId ? String(payload.boardPlayerId) : null;

          if (this.isSpectator || !card || !event || !boardPlayerId) {
            return;
          }

          if (event.pointerType !== 'touch' && event.button !== 0) {
            return;
          }

          const boardEntry = this.getBoardElementByPlayerId(boardPlayerId);
          if (!boardEntry) {
            return;
          }

          const boardSide = boardEntry.boardSide || 'bottom';
          const pointerPosition = this.toBoardCoordinates(event, boardEntry.element, boardSide);
          if (!pointerPosition) {
            return;
          }

          event.preventDefault();
          this.closeContextMenu();

          const fallbackCanonicalFromSide = this.fromSideToCanonicalBoardCoordinates(card.boardPosition, boardSide);
          const canonicalCardPosition = this.getSanitizedBoardPosition(
            card.canonicalBoardPosition || fallbackCanonicalFromSide,
            0
          );
          const sideCardPosition = this.fromCanonicalToSideBoardCoordinates(canonicalCardPosition, boardSide);
          const cardId = String(card.id);

          this.setLocalBoardCardMoveOverride(cardId, {
            targetPlayerId: boardPlayerId,
            x: canonicalCardPosition.x,
            y: canonicalCardPosition.y
          });

          this.dragState = {
            pointerId: event.pointerId,
            cardId,
            originPlayerId: boardPlayerId,
            activeTargetPlayerId: boardPlayerId,
            offsetX: pointerPosition.x - sideCardPosition.x,
            offsetY: pointerPosition.y - sideCardPosition.y
          };
          this.activeDragCardId = cardId;

          this.attachBoardDragListeners();
        },
        onWindowPointerMove(event) {
          if (!this.dragState || event.pointerId !== this.dragState.pointerId) {
            return;
          }

          const boardEntry =
            this.findBoardUnderPointer(event.clientX, event.clientY) ||
            this.getBoardElementByPlayerId(this.dragState.activeTargetPlayerId || this.dragState.originPlayerId);

          if (!boardEntry) {
            return;
          }

          const boardSide = boardEntry.boardSide || 'bottom';
          const pointerPosition = this.toBoardCoordinates(event, boardEntry.element, boardSide);
          if (!pointerPosition) {
            return;
          }

          event.preventDefault();

          const nextPosition = this.clampBoardCoordinatesForSide(
            pointerPosition.x - this.dragState.offsetX,
            pointerPosition.y - this.dragState.offsetY,
            boardSide
          );
          const nextCanonicalPosition = this.fromSideToCanonicalBoardCoordinates(nextPosition, boardSide);

          this.setLocalBoardCardMoveOverride(this.dragState.cardId, {
            targetPlayerId: boardEntry.playerId,
            x: nextCanonicalPosition.x,
            y: nextCanonicalPosition.y
          });

          this.dragState.activeTargetPlayerId = boardEntry.playerId;
        },
        onWindowPointerUp(event) {
          if (!this.dragState || event.pointerId !== this.dragState.pointerId) {
            return;
          }

          event.preventDefault();
          this.stopBoardDrag(true);
        },
        stopBoardDrag(shouldPersist) {
          if (!this.dragState) {
            return;
          }

          const cardId = this.dragState.cardId;
          const finalState = this.localBoardCardMoveOverrides[cardId] || null;

          this.detachBoardDragListeners();
          this.dragState = null;
          this.activeDragCardId = null;

          if (shouldPersist && finalState) {
            this.$emit('move-board-card', {
              cardId,
              targetPlayerId: finalState.targetPlayerId,
              x: finalState.x,
              y: finalState.y
            });
          }

          this.queueBoardCardOverrideCleanup(cardId);
        },
        onGlobalKeyDown(event) {
          if (!this.dragState || this.isSpectator || !event || typeof event.key !== 'string') {
            return;
          }

          if (event.key.toLowerCase() !== 'r') {
            return;
          }

          event.preventDefault();

          const cardId = this.dragState.cardId;
          this.rotateCardLocally(cardId, 90);
        },
        rotateCardLocally(cardId, delta) {
          const key = String(cardId);
          const currentRotation = this.normalizeBoardRotationDelta(this.localBoardRotationByCardId[key]);
          const increment = this.isFiniteNumber(delta) ? delta : 0;
          const nextRotation = this.normalizeBoardRotationDelta(currentRotation + increment);

          this.localBoardRotationByCardId[key] = nextRotation;

          return nextRotation;
        },
        onCardHover(card) {
          this.hoveredCard = card;
        },
        onCardUnhover() {
          this.hoveredCard = null;
        },
        closeContextMenu() {
          this.contextMenuVisible = false;
          this.contextMenuOptions = [];
        },
        onCardRightClick(payload) {
          if (this.isSpectator) {
            this.closeContextMenu();
            return;
          }

          const options = this.buildContextMenuOptions(payload || {});

          if (options.length === 0) {
            this.closeContextMenu();
            return;
          }

          this.contextMenuOptions = options;
          this.contextMenuVisible = true;
          this.contextMenuX = Number.isFinite(payload.x) ? payload.x : 0;
          this.contextMenuY = Number.isFinite(payload.y) ? payload.y : 0;
        },
        buildContextMenuOptions(payload) {
          const card = payload.card || null;
          const zone = payload.zone || '';
          const ownerId = card && card.ownerId ? String(card.ownerId) : null;
          const isOwnCard = ownerId && String(this.localPlayerId) === ownerId;

          if (zone === 'hand') {
            if (isOwnCard) {
              return [
                { label: 'Activate', action: { type: 'activate', cardId: card.id } },
                { label: 'Flip', action: { type: 'flip', cardId: card.id, zone: 'hand' } },
                { label: 'Discard', action: { type: 'discard', cardId: card.id, zone: 'hand' } }
              ];
            }

            return [
              {
                label: 'Take (steal)',
                action: {
                  type: 'take-from-opponent',
                  cardId: card ? card.id : null,
                  fromPlayerId: ownerId
                }
              }
            ];
          }

          if (zone === 'board') {
            if (!card) {
              return [];
            }

            const options = [
              {
                label: 'Rotate +90',
                action: { type: 'rotate-board-card', cardId: card.id }
              }
            ];

            if (isOwnCard) {
              if (card.type === 'MainHero') {
                options.push({
                  label: 'Return to MainHero Deck',
                  action: { type: 'return-mainhero-to-deck', cardId: card.id }
                });
              }

              options.push(
                { label: 'Return to hand', action: { type: 'return-to-hand', cardId: card.id } },
                { label: 'Flip', action: { type: 'flip', cardId: card.id, zone: 'board' } },
                { label: 'Discard', action: { type: 'discard', cardId: card.id, zone: 'board' } }
              );
            }

            return options;
          }

          if (zone === 'mainhero-deck') {
            return [{ label: 'View full pile', action: { type: 'view-mainhero-deck' } }];
          }

          if (zone === 'hero-deck') {
            return [
              { label: 'Draw DeckCards', action: { type: 'draw-hero' } },
              { label: 'Shuffle', action: { type: 'shuffle-hero' } }
            ];
          }

          if (zone === 'monster-deck') {
            return [
              { label: 'Reveal top Monsters card', action: { type: 'reveal-monster' } },
              { label: 'Shuffle', action: { type: 'shuffle-monster' } }
            ];
          }

          if (zone === 'active-monster') {
            return [
              {
                label: 'Take to my board',
                action: { type: 'take-monster', cardId: card ? card.id : null }
              },
              {
                label: 'Return to bottom of Monster Deck',
                action: {
                  type: 'return-active-monster-to-bottom',
                  cardId: card ? card.id : null,
                  slotIndex: Number.isInteger(payload.slotIndex) ? payload.slotIndex : undefined
                }
              }
            ];
          }

          if (zone === 'discard') {
            return [{ label: 'View full pile', action: { type: 'view-discard' } }];
          }

          return [];
        },
        onContextMenuSelect(action) {
          this.closeContextMenu();

          if (!action || !action.type) {
            return;
          }

          switch (action.type) {
            case 'flip':
              this.$emit('flip-card', action.cardId, action.zone);
              break;
            case 'rotate-board-card':
              this.rotateCardLocally(action.cardId, 90);
              break;
            case 'activate':
              this.$emit('request-action', 'ACTIVATE_CARD', {
                cardId: action.cardId
              });
              break;
            case 'return-to-hand':
              this.$emit('request-action', 'RETURN_CARD_TO_HAND', {
                cardId: action.cardId
              });
              break;
            case 'discard':
              this.$emit('request-action', 'DISCARD_CARD', {
                cardId: action.cardId,
                zone: action.zone
              });
              break;
            case 'draw-hero':
              this.$emit('request-action', 'DRAW_HERO', {});
              break;
            case 'shuffle-hero':
              this.$emit('request-action', 'SHUFFLE_HERO', {});
              break;
            case 'reveal-monster':
              this.$emit('request-action', 'REVEAL_MONSTER', {});
              break;
            case 'shuffle-monster':
              this.$emit('request-action', 'SHUFFLE_MONSTER', {});
              break;
            case 'take-monster':
              this.$emit('request-action', 'TAKE_MONSTER', {
                cardId: action.cardId
              });
              break;
            case 'return-active-monster-to-bottom':
              this.$emit('request-action', 'RETURN_ACTIVE_MONSTER_TO_BOTTOM', {
                cardId: action.cardId,
                slotIndex: action.slotIndex
              });
              break;
            case 'take-from-opponent':
              this.$emit('request-action', 'TAKE_FROM_OPPONENT', {
                fromPlayerId: action.fromPlayerId,
                cardId: action.cardId
              });
              break;
            case 'view-discard':
              this.$emit('view-discard');
              break;
            case 'view-mainhero-deck':
              this.$emit('view-main-hero-deck');
              break;
            case 'return-mainhero-to-deck':
              this.$emit('request-action', 'RETURN_MAIN_HERO_TO_DECK', {
                cardId: action.cardId
              });
              break;
            default:
              break;
          }
        },
        onApprove(actionId) {
          this.$emit('respond-approval', actionId, true);
        },
        onDeny(actionId) {
          this.$emit('respond-approval', actionId, false);
        },
        requestUndo() {
          this.$emit('request-action', 'UNDO', {});
        },
        requestTakeFromDiscard(cardId) {
          if (this.isSpectator) {
            return;
          }

          this.$emit('request-action', 'TAKE_FROM_DISCARD', { cardId });
          this.$emit('close-discard-modal');
        },
        requestTakeMainHeroToBoard(cardId) {
          if (this.isSpectator) {
            return;
          }

          this.$emit('request-action', 'TAKE_MAIN_HERO_TO_BOARD', { cardId });
          this.$emit('close-main-hero-modal');
        },
        requestReset() {
          this.$emit('reset-lobby');
        }
      },
      template: `
        <div class="game-view">
          <header class="top-bar">
            <approval-toggle
              v-if="!isSpectator"
              :approval-mode="approvalMode"
              @toggle="$emit('toggle-approval')"
            ></approval-toggle>

            <dice-roller
              v-if="!isSpectator"
              :last-roll="lastDiceRoll"
              @roll="$emit('roll-dice')"
            ></dice-roller>

            <span v-if="isSpectator" class="spectator-badge">👁 Spectator</span>

            <button
              type="button"
              class="approval-toggle"
              :class="showEventLog ? 'approval-on' : 'approval-off'"
              @click="$emit('toggle-event-log')"
            >
              {{ showEventLog ? 'Hide Event Log' : 'Show Event Log' }}
            </button>

            <button
              type="button"
              class="approval-toggle"
              :class="showRestrictedLog ? 'approval-on' : 'approval-off'"
              @click="$emit('toggle-restricted-log')"
            >
              {{ showRestrictedLog ? 'Hide Action History' : 'Show Action History' }}
            </button>

            <button type="button" class="approval-toggle" @click="$emit('cycle-background')">
              Change Background
            </button>

            <button v-if="!isSpectator" type="button" class="undo-button" @click="requestUndo">Undo</button>
            <button v-if="!isSpectator" type="button" class="reset-button" @click="requestReset">Reset</button>
          </header>

          <section class="game-board">
            <div class="top-player">
              <player-zone
                v-if="topOpponent"
                :player="topOpponent"
                :is-local="false"
                position="top"
                :board-cards="getBoardCardsForPlayer(topOpponent.id)"
                :active-drag-card-id="activeDragCardId"
                @card-hover="onCardHover"
                @card-unhover="onCardUnhover"
                @card-rightclick="onCardRightClick"
                @board-card-pointerdown="onBoardCardPointerDown"
              ></player-zone>
            </div>

            <div class="left-player">
              <player-zone
                v-if="leftOpponent"
                :player="leftOpponent"
                :is-local="false"
                position="left"
                :board-cards="getBoardCardsForPlayer(leftOpponent.id)"
                :active-drag-card-id="activeDragCardId"
                @card-hover="onCardHover"
                @card-unhover="onCardUnhover"
                @card-rightclick="onCardRightClick"
                @board-card-pointerdown="onBoardCardPointerDown"
              ></player-zone>
            </div>

            <div class="right-player">
              <player-zone
                v-if="rightOpponent"
                :player="rightOpponent"
                :is-local="false"
                position="right"
                :board-cards="getBoardCardsForPlayer(rightOpponent.id)"
                :active-drag-card-id="activeDragCardId"
                @card-hover="onCardHover"
                @card-unhover="onCardUnhover"
                @card-rightclick="onCardRightClick"
                @board-card-pointerdown="onBoardCardPointerDown"
              ></player-zone>
            </div>

            <div class="bottom-player">
              <player-zone
                v-if="localPlayer"
                :player="localPlayer"
                :is-local="!isSpectator"
                position="bottom"
                :board-cards="getBoardCardsForPlayer(localPlayer.id)"
                :active-drag-card-id="activeDragCardId"
                @card-hover="onCardHover"
                @card-unhover="onCardUnhover"
                @card-rightclick="onCardRightClick"
                @board-card-pointerdown="onBoardCardPointerDown"
              ></player-zone>
            </div>

            <div class="center-table-cell">
              <center-table
                :hero-deck="safeHeroDeck"
                :main-hero-deck="safeMainHeroDeck"
                :monster-deck="safeMonsterDeck"
                :active-monsters="safeActiveMonsters"
                :discard-pile="safeDiscardPile"
                @card-hover="onCardHover"
                @card-unhover="onCardUnhover"
                @card-rightclick="onCardRightClick"
              ></center-table>
            </div>
          </section>

          <focus-preview
            :card="hoveredCard"
            :centered="showDiscardModal || showMainHeroModal"
          ></focus-preview>
          <event-log :entries="eventLogEntries" :visible="showEventLog"></event-log>
          <restricted-log :entries="restrictedLogEntries" :visible="showRestrictedLog"></restricted-log>

          <approval-popup
            v-if="!isSpectator"
            :request="visibleApprovalRequest"
            @approve="onApprove"
            @deny="onDeny"
          ></approval-popup>

          <div v-if="pendingOwnRequest" class="own-request-overlay">
            <div class="own-request-box">
              <p class="own-request-title">⏳ Waiting for approval...</p>
              <p class="own-request-details">{{ pendingOwnRequest.details }}</p>
              <p class="own-request-hint">At least 1 other player must approve.</p>
            </div>
          </div>

          <context-menu
            v-if="!isSpectator"
            :visible="contextMenuVisible"
            :x="contextMenuX"
            :y="contextMenuY"
            :options="contextMenuOptions"
            @select="onContextMenuSelect"
            @close="closeContextMenu"
          ></context-menu>

          <div
            v-if="showMainHeroModal"
            class="discard-modal-overlay"
            @click.self="$emit('close-main-hero-modal')"
          >
            <div class="discard-modal" role="dialog" aria-modal="true" aria-label="MainHero Deck">
              <h2 class="discard-modal-title">
                MainHero Deck ({{ mainHeroPileModal.length }} cards)
              </h2>

              <div class="discard-modal-grid" v-if="mainHeroPileModal.length > 0">
                <div v-for="card in mainHeroPileModal" :key="card.id" class="discard-modal-card">
                  <card-component
                    :card="{ ...card, isFaceUp: true }"
                    zone="mainhero-deck"
                    :is-own="false"
                    @hover="onCardHover"
                    @unhover="onCardUnhover"
                  ></card-component>

                  <button
                    v-if="!isSpectator"
                    type="button"
                    class="discard-modal-take"
                    :disabled="Boolean(pendingOwnRequest)"
                    @click="requestTakeMainHeroToBoard(card.id)"
                  >
                    Take to my board
                  </button>
                </div>
              </div>

              <p v-else class="discard-modal-empty">No cards in MainHero Deck.</p>

              <div class="discard-modal-actions">
                <button type="button" class="discard-modal-close" @click="$emit('close-main-hero-modal')">
                  Close
                </button>
              </div>
            </div>
          </div>

          <div
            v-if="showDiscardModal"
            class="discard-modal-overlay"
            @click.self="$emit('close-discard-modal')"
          >
            <div class="discard-modal" role="dialog" aria-modal="true" aria-label="Discard Pile">
              <h2 class="discard-modal-title">
                Discard Pile ({{ discardPileModal.length }} cards)
              </h2>

              <div class="discard-modal-grid" v-if="discardPileModal.length > 0">
                <div v-for="card in discardPileModal" :key="card.id" class="discard-modal-card">
                  <card-component
                    :card="{ ...card, isFaceUp: true }"
                    zone="discard"
                    :is-own="false"
                    @hover="onCardHover"
                    @unhover="onCardUnhover"
                  ></card-component>

                  <button
                    v-if="!isSpectator"
                    type="button"
                    class="discard-modal-take"
                    :disabled="Boolean(pendingOwnRequest)"
                    @click="requestTakeFromDiscard(card.id)"
                  >
                    Take this card
                  </button>
                </div>
              </div>

              <p v-else class="discard-modal-empty">No cards in discard pile.</p>

              <div class="discard-modal-actions">
                <button type="button" class="discard-modal-close" @click="$emit('close-discard-modal')">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      `
    });
  }

  if (typeof window.registerHeroToSlayComponent === 'function') {
    window.registerHeroToSlayComponent(install);
  } else {
    window.HeroToSlayInstallers = window.HeroToSlayInstallers || [];
    window.HeroToSlayInstallers.push(install);
  }
})();
