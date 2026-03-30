// ============================================================
// FILE: public/components/GameView.js
// ============================================================

(function registerGameViewComponent() {
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
        pendingApproval: {
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
        lastDiceRoll: {
          type: Number,
          default: null
        },
        approvalMode: {
          type: Boolean,
          default: true
        }
      },
      emits: [
        'request-action',
        'respond-approval',
        'flip-card',
        'view-discard',
        'roll-dice',
        'toggle-approval',
        'reset-lobby'
      ],
      data() {
        return {
          hoveredCard: null,
          contextMenuVisible: false,
          contextMenuX: 0,
          contextMenuY: 0,
          contextMenuOptions: []
        };
      },
      computed: {
        players() {
          return Array.isArray(this.gameState.players) ? this.gameState.players : [];
        },
        localPlayer() {
          return this.players.find((player) => String(player.id) === String(this.localPlayerId)) || null;
        },
        opponents() {
          return this.players.filter((player) => String(player.id) !== String(this.localPlayerId));
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
        safeHeroDeck() {
          return Array.isArray(this.gameState.heroDeck) ? this.gameState.heroDeck : [];
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
      methods: {
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
            if (isOwnCard) {
              return [
                { label: 'Flip', action: { type: 'flip', cardId: card.id, zone: 'board' } },
                { label: 'Discard', action: { type: 'discard', cardId: card.id, zone: 'board' } }
              ];
            }

            return [];
          }

          if (zone === 'hero-deck') {
            return [
              { label: 'Draw', action: { type: 'draw-hero' } },
              { label: 'Shuffle', action: { type: 'shuffle-hero' } }
            ];
          }

          if (zone === 'monster-deck') {
            return [
              { label: 'Reveal top card', action: { type: 'reveal-monster' } },
              { label: 'Shuffle', action: { type: 'shuffle-monster' } }
            ];
          }

          if (zone === 'active-monster') {
            return [
              {
                label: 'Take to my board',
                action: { type: 'take-monster', cardId: card ? card.id : null }
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
            case 'take-from-opponent':
              this.$emit('request-action', 'TAKE_FROM_OPPONENT', {
                fromPlayerId: action.fromPlayerId,
                cardId: action.cardId
              });
              break;
            case 'view-discard':
              this.$emit('view-discard');
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
        requestReset() {
          this.$emit('reset-lobby');
        }
      },
      template: `
        <div class="game-view">
          <header class="top-bar">
            <approval-toggle
              :approval-mode="approvalMode"
              @toggle="$emit('toggle-approval')"
            ></approval-toggle>

            <dice-roller
              :last-roll="lastDiceRoll"
              @roll="$emit('roll-dice')"
            ></dice-roller>

            <button type="button" class="undo-button" @click="requestUndo">Undo</button>
            <button type="button" class="reset-button" @click="requestReset">Reset</button>
          </header>

          <section class="game-board">
            <div class="top-player">
              <player-zone
                v-if="topOpponent"
                :player="topOpponent"
                :is-local="false"
                position="top"
                @card-hover="onCardHover"
                @card-unhover="onCardUnhover"
                @card-rightclick="onCardRightClick"
              ></player-zone>
            </div>

            <div class="left-player">
              <player-zone
                v-if="leftOpponent"
                :player="leftOpponent"
                :is-local="false"
                position="left"
                @card-hover="onCardHover"
                @card-unhover="onCardUnhover"
                @card-rightclick="onCardRightClick"
              ></player-zone>
            </div>

            <div class="right-player">
              <player-zone
                v-if="rightOpponent"
                :player="rightOpponent"
                :is-local="false"
                position="right"
                @card-hover="onCardHover"
                @card-unhover="onCardUnhover"
                @card-rightclick="onCardRightClick"
              ></player-zone>
            </div>

            <div class="bottom-player">
              <player-zone
                v-if="localPlayer"
                :player="localPlayer"
                :is-local="true"
                position="bottom"
                @card-hover="onCardHover"
                @card-unhover="onCardUnhover"
                @card-rightclick="onCardRightClick"
              ></player-zone>
            </div>

            <div class="center-table-cell">
              <center-table
                :hero-deck="safeHeroDeck"
                :monster-deck="safeMonsterDeck"
                :active-monsters="safeActiveMonsters"
                :discard-pile="safeDiscardPile"
                @card-hover="onCardHover"
                @card-unhover="onCardUnhover"
                @card-rightclick="onCardRightClick"
              ></center-table>
            </div>
          </section>

          <focus-preview :card="hoveredCard"></focus-preview>
          <event-log :entries="eventLogEntries"></event-log>
          <restricted-log :entries="restrictedLogEntries"></restricted-log>

          <approval-popup
            :request="visibleApprovalRequest"
            @approve="onApprove"
            @deny="onDeny"
          ></approval-popup>

          <context-menu
            :visible="contextMenuVisible"
            :x="contextMenuX"
            :y="contextMenuY"
            :options="contextMenuOptions"
            @select="onContextMenuSelect"
            @close="closeContextMenu"
          ></context-menu>
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
