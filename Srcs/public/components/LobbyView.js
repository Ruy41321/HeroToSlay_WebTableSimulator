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
      emits: ['join', 'start', 'reset-lobby'],
      data() {
        return {
          nicknameInput: ''
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
          this.$emit('reset-lobby');
        }
      },
      template: `
        <section class="lobby-view">
          <div v-if="gameInProgress" class="lobby-waiting-message">
            <p>Game in progress - please wait</p>
            <button
              type="button"
              class="lobby-reset-button reset-button"
              @click="requestReset"
            >
              Reset Lobby
            </button>
          </div>

          <div v-else class="lobby-controls">
            <h1>Hero to Slay Lobby</h1>

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

            <button
              type="button"
              class="lobby-reset-button reset-button"
              @click="requestReset"
            >
              Reset Lobby
            </button>
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
