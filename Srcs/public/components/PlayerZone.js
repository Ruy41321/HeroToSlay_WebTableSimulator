// ============================================================
// FILE: public/components/PlayerZone.js
// ============================================================

(function registerPlayerZoneComponent() {
  const BOARD_CARD_WIDTH = 80;
  const BOARD_CARD_HEIGHT = 112;
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

  function getBoardSpaceByPosition(position) {
    if (position === 'left' || position === 'right') {
      return BOARD_SPACES.vertical;
    }

    return BOARD_SPACES.horizontal;
  }

  function install(app) {
    app.component('player-zone', {
      props: {
        player: {
          type: Object,
          required: true
        },
        isLocal: {
          type: Boolean,
          default: false
        },
        position: {
          type: String,
          default: 'bottom'
        },
        boardCards: {
          type: Array,
          default: () => []
        },
        activeDragCardId: {
          type: String,
          default: null
        }
      },
      emits: ['card-hover', 'card-unhover', 'card-rightclick', 'board-card-pointerdown'],
      computed: {
        positionClass() {
          return `position-${this.position}`;
        },
        baseBoardRotation() {
          const rotationByPosition = {
            bottom: 0,
            left: 90,
            top: 180,
            right: 270
          };

          return rotationByPosition[this.position] || 0;
        },
        handCards() {
          const cards = Array.isArray(this.player.hand) ? this.player.hand : [];

          return cards.map((card) => ({
            ...card,
            ownerId: card.ownerId || this.player.id,
            isFaceUp: this.isLocal ? Boolean(card.isFaceUp) : false
          }));
        },
        resolvedBoardCards() {
          const cards = Array.isArray(this.boardCards) ? this.boardCards : [];

          return cards.map((card, index) => ({
            ...card,
            _boardIndex: index,
            ownerId: card.ownerId || this.player.id
          }));
        }
      },
      methods: {
        getBoardSpace() {
          return getBoardSpaceByPosition(this.position);
        },
        isFiniteNumber(value) {
          return typeof value === 'number' && Number.isFinite(value);
        },
        clampPosition(value, max) {
          return Math.round(Math.min(Math.max(value, 0), max));
        },
        normalizeRotation(rotation) {
          if (!this.isFiniteNumber(rotation)) {
            return 0;
          }

          const snapped = Math.round(rotation / 90) * 90;
          return ((snapped % 360) + 360) % 360;
        },
        getSanitizedBoardPosition(card) {
          const position = card && card.boardPosition;
          const boardSpace = this.getBoardSpace();
          const maxX = boardSpace.width - BOARD_CARD_WIDTH;
          const maxY = boardSpace.height - BOARD_CARD_HEIGHT;

          if (
            position &&
            typeof position === 'object' &&
            this.isFiniteNumber(position.x) &&
            this.isFiniteNumber(position.y)
          ) {
            return {
              x: this.clampPosition(position.x, maxX),
              y: this.clampPosition(position.y, maxY)
            };
          }

          const index = Number.isInteger(card._boardIndex) ? card._boardIndex : 0;
          return {
            x: this.clampPosition(12 + (index % 5) * 26, maxX),
            y: this.clampPosition(12 + Math.floor(index / 5) * 28, maxY)
          };
        },
        buildBoardCardStyle(card) {
          const boardSpace = this.getBoardSpace();
          const boardPosition = this.getSanitizedBoardPosition(card);
          const leftPercent = (boardPosition.x / boardSpace.width) * 100;
          const topPercent = (boardPosition.y / boardSpace.height) * 100;
          const localDelta = this.normalizeRotation(card.localRotationDelta);
          const finalRotation = this.normalizeRotation(this.baseBoardRotation + localDelta);

          return {
            left: `${leftPercent}%`,
            top: `${topPercent}%`,
            transform: `rotate(${finalRotation}deg)`
          };
        },
        isBoardCardOwnedByLocalPlayer(card) {
          const ownerId = card && card.ownerId ? String(card.ownerId) : null;
          return Boolean(this.isLocal && ownerId && ownerId === String(this.player.id));
        },
        onBoardCardPointerDown(event, card) {
          this.$emit('board-card-pointerdown', {
            event,
            card,
            boardPlayerId: this.player.id,
            boardSide: this.position
          });
        },
        forwardHover(card) {
          this.$emit('card-hover', card);
        },
        forwardUnhover() {
          this.$emit('card-unhover');
        },
        forwardRightclick(payload) {
          this.$emit('card-rightclick', payload);
        },
        forwardBoardRightclick(payload) {
          this.$emit('card-rightclick', {
            ...(payload || {}),
            targetPlayerId: this.player.id,
            boardSide: this.position
          });
        }
      },
      template: `
        <section class="player-zone" :class="[positionClass, { 'player-zone-local': isLocal }]">
          <div class="player-nickname">{{ player.nickname }}</div>

          <div class="player-zone-content">
            <div
              class="player-board"
              :data-player-id="player.id"
              :data-board-side="position"
            >
              <div
                v-for="card in resolvedBoardCards"
                :key="'board-' + card.id"
                class="player-board-card"
                :class="{
                  'player-board-card-own': isBoardCardOwnedByLocalPlayer(card),
                  'player-board-card-dragging': activeDragCardId === String(card.id)
                }"
                :style="buildBoardCardStyle(card)"
                @pointerdown="onBoardCardPointerDown($event, card)"
              >
                <card-component
                  :card="card"
                  zone="board"
                  :is-own="isBoardCardOwnedByLocalPlayer(card)"
                  @hover="forwardHover"
                  @unhover="forwardUnhover"
                  @rightclick="forwardBoardRightclick"
                ></card-component>
              </div>
            </div>

            <div class="player-hand">
              <card-component
                v-for="card in handCards"
                :key="'hand-' + card.id"
                :card="card"
                zone="hand"
                :is-own="isLocal"
                @hover="forwardHover"
                @unhover="forwardUnhover"
                @rightclick="forwardRightclick"
              ></card-component>
            </div>
          </div>
        </section>
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
