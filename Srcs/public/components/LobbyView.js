// ============================================================
// FILE: public/components/LobbyView.js
// ============================================================

(function registerLobbyViewComponent() {
  function install(app) {
    app.component('lobby-view', {
      props: {
        players: {
          type: Array,
          default: () => []
        },
        gameInProgress: {
          type: Boolean,
          default: false
        }
      },
      emits: ['join', 'join-spectator', 'start', 'reset-lobby', 'cycle-background'],
      data() {
        return {
          nicknameInput: '',
          spectatorName: '',
          showResetConfirmation: false
        };
      },
      computed: {
        canStart() {
          return this.players.length >= 2;
        }
      },
      methods: {
        submitJoin() {
          const nickname = this.nicknameInput.trim();

          if (!nickname) {
            return;
          }

          this.$emit('join', nickname);
          this.nicknameInput = '';
        },
        submitStart() {
          if (!this.canStart) {
            return;
          }

          this.$emit('start');
        },
        requestReset() {
          this.showResetConfirmation = true;
        },
        cancelReset() {
          this.showResetConfirmation = false;
        },
        confirmReset() {
          this.showResetConfirmation = false;
          this.$emit('reset-lobby');
        },
        submitSpectator() {
          this.$emit('join-spectator', this.spectatorName);
          this.spectatorName = '';
        }
      },
      template: `
        <section class="lobby-view">
          <div class="lobby-controls">
            <div class="lobby-header-row">
              <h1>Hero to Slay Lobby</h1>
              <button type="button" class="lobby-bg-button" @click="$emit('cycle-background')">
                Change Background
              </button>
            </div>

            <div v-if="gameInProgress" class="lobby-waiting-message">
              <p>Game in progress - player queue is locked</p>
            </div>

            <div v-if="gameInProgress" class="lobby-join-row">
              <input
                v-model="nicknameInput"
                class="lobby-nickname-input"
                type="text"
                placeholder="Enter previous nickname to rejoin"
                @keyup.enter="submitJoin"
              />

              <button type="button" class="lobby-join-button" @click="submitJoin">
                Rejoin
              </button>
            </div>

            <template v-else>
              <div class="lobby-join-row">
                <input
                  v-model="nicknameInput"
                  class="lobby-nickname-input"
                  type="text"
                  placeholder="Enter nickname"
                  @keyup.enter="submitJoin"
                />

                <button type="button" class="lobby-join-button" @click="submitJoin">
                  Join Queue
                </button>
              </div>

              <div class="lobby-player-count">{{ players.length }} / 4 players</div>

              <ul class="lobby-player-list">
                <li v-for="player in players" :key="player.id">
                  {{ player.nickname }}
                </li>
              </ul>

              <button
                type="button"
                class="lobby-start-button"
                :disabled="!canStart"
                @click="submitStart"
              >
                Start Game
              </button>
            </template>

            <hr class="lobby-separator" />

            <div class="spectator-join">
              <input
                v-model="spectatorName"
                class="lobby-nickname-input"
                type="text"
                placeholder="Display name (optional)"
                maxlength="20"
                @keyup.enter="submitSpectator"
              />

              <button type="button" class="lobby-join-button" @click="submitSpectator">
                👁 Watch as Spectator
              </button>
            </div>

            <button
              type="button"
              class="lobby-reset-button reset-button"
              @click="requestReset"
            >
              Reset Lobby
            </button>

            <div v-if="showResetConfirmation" class="approval-popup-overlay">
              <div class="approval-popup-box">
                <p class="approval-popup-text">
                  Proceeding will end the current match. Are you sure you want to continue?
                </p>

                <div class="approval-popup-actions">
                  <button type="button" class="reset-confirm-button" @click="confirmReset">Reset</button>
                  <button type="button" class="reset-cancel-button" @click="cancelReset">Cancel</button>
                </div>
              </div>
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
