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
          default: true
        },
        showRestrictedLog: {
          type: Boolean,
          default: true
        },
        lastDiceRoll: {
          type: Number,
          default: null
        },
        approvalMode: {
          type: Boolean,
          default: true
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
        'view-discard',
        'view-main-hero-deck',
        'close-discard-modal',
        'close-main-hero-modal',
        'roll-dice',
        'toggle-approval',
        'toggle-event-log',
        'toggle-restricted-log',
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
            if (isOwnCard) {
              const options = [];

              if (card && card.type === 'mainhero') {
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

              return options;
            }

            return [];
          }

          if (zone === 'mainhero-deck') {
            return [{ label: 'View full pile', action: { type: 'view-mainhero-deck' } }];
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
                :is-local="!isSpectator"
                position="bottom"
                @card-hover="onCardHover"
                @card-unhover="onCardUnhover"
                @card-rightclick="onCardRightClick"
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

          <focus-preview :card="hoveredCard"></focus-preview>
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
