// ============================================================
// FILE: public/app.js
// ============================================================

(function bootstrapApp() {
  const installers = window.HeroToSlayInstallers || [];
  const socket = typeof window.io === 'function' ? window.io(window.location.origin) : null;

  const app = window.Vue.createApp({
    data() {
      return {
        socket,
        view: 'lobby',
        localPlayerId: null,
        lobbyPlayers: [],
        gameInProgress: false,
        gameState: null,
        pendingApproval: null,
        eventLog: [],
        restrictedLog: [],
        lastDiceRoll: null
      };
    },
    computed: {
      currentApprovalMode() {
        if (this.gameState && typeof this.gameState.approvalMode === 'boolean') {
          return this.gameState.approvalMode;
        }

        return true;
      }
    },
    created() {
      if (!this.socket) {
        console.error('Socket.io client is not available.');
        return;
      }

      this.socket.on('lobby_update', (data = {}) => {
        this.lobbyPlayers = Array.isArray(data.players) ? data.players : [];
        this.gameInProgress = Boolean(data.gameInProgress);

        if (!this.gameInProgress) {
          this.view = 'lobby';
          this.gameState = null;
          this.localPlayerId = null;
          this.pendingApproval = null;
          this.eventLog = [];
          this.restrictedLog = [];
          this.lastDiceRoll = null;
        }
      });

      this.socket.on('game_start', ({ yourPlayerId } = {}) => {
        this.localPlayerId = yourPlayerId || null;
        this.view = 'game';
      });

      this.socket.on('state_update', (state) => {
        if (!state || typeof state !== 'object') {
          return;
        }

        this.gameState = state;

        if (state.phase === 'playing') {
          this.view = 'game';
          return;
        }

        if (state.phase === 'lobby') {
          this.view = 'lobby';
        }
      });

      this.socket.on('approval_request', (request) => {
        if (!request || typeof request !== 'object') {
          this.pendingApproval = null;
          return;
        }

        const requesterId = request.requesterId ? String(request.requesterId) : null;
        const requesterNickname =
          request.requesterNickname && typeof request.requesterNickname === 'string'
            ? request.requesterNickname.toLowerCase()
            : null;
        const localNickname = this.getLocalNickname();

        const isRequesterById =
          requesterId && this.localPlayerId && String(this.localPlayerId) === String(requesterId);
        const isRequesterByNickname =
          requesterNickname && localNickname && requesterNickname === localNickname.toLowerCase();

        this.pendingApproval = isRequesterById || isRequesterByNickname ? null : request;
      });

      this.socket.on('approval_result', ({ actionId, granted, approverNickname } = {}) => {
        this.pendingApproval = null;

        const resultText = granted ? 'granted' : 'denied';
        const approverText = approverNickname || 'unknown player';

        this.prependEvent({
          message: `Approval ${resultText} for ${actionId || 'unknown action'} by ${approverText}`,
          timestamp: new Date().toISOString()
        });
      });

      this.socket.on('event_log', ({ message, timestamp } = {}) => {
        if (!message || typeof message !== 'string') {
          return;
        }

        this.prependEvent({
          message,
          timestamp: timestamp || new Date().toISOString()
        });
      });

      this.socket.on('restricted_log', (entries) => {
        this.restrictedLog = Array.isArray(entries) ? entries : [];
      });

      this.socket.on('dice_result', ({ nickname, result } = {}) => {
        this.lastDiceRoll = Number.isInteger(result) ? result : null;

        if (nickname && Number.isInteger(result)) {
          this.prependEvent({
            message: `${nickname} rolled a ${result}`,
            timestamp: new Date().toISOString()
          });
        }
      });

      this.socket.on('error', ({ message } = {}) => {
        if (!message) {
          return;
        }

        console.error(message);
        this.prependEvent({
          message: `Error: ${message}`,
          timestamp: new Date().toISOString()
        });
      });
    },
    methods: {
      prependEvent(entry) {
        this.eventLog.unshift(entry);
      },
      getLocalNickname() {
        if (!this.localPlayerId || !this.gameState || !Array.isArray(this.gameState.players)) {
          return '';
        }

        const localPlayer = this.gameState.players.find(
          (player) => String(player.id) === String(this.localPlayerId)
        );

        if (!localPlayer || !localPlayer.nickname) {
          return '';
        }

        return localPlayer.nickname;
      },
      joinLobby(nickname) {
        if (!this.socket) {
          return;
        }

        this.socket.emit('join_lobby', { nickname });
      },
      startGame() {
        if (!this.socket) {
          return;
        }

        this.socket.emit('start_game', {});
      },
      requestAction(type, payload) {
        if (!this.socket) {
          return;
        }

        this.socket.emit('request_action', {
          type,
          payload: payload || {}
        });
      },
      respondApproval(actionId, decision) {
        if (!this.socket) {
          return;
        }

        this.socket.emit('respond_approval', {
          actionId,
          decision: Boolean(decision)
        });
      },
      flipCard(cardId, zone) {
        if (!this.socket) {
          return;
        }

        this.socket.emit('flip_card', {
          cardId,
          zone
        });
      },
      viewDiscard() {
        if (!this.socket) {
          return;
        }

        this.socket.emit('view_discard', {});
      },
      rollDice() {
        if (!this.socket) {
          return;
        }

        this.socket.emit('roll_dice', {});
      },
      toggleApproval() {
        if (!this.socket) {
          return;
        }

        this.socket.emit('toggle_approval', {});
      },
      resetLobby() {
        if (!this.socket) {
          return;
        }

        this.socket.emit('reset_lobby', {});
      }
    },
    template: `
      <div class="app-root">
        <lobby-view
          v-if="view === 'lobby'"
          :players="lobbyPlayers"
          :game-in-progress="gameInProgress"
          @join="joinLobby"
          @start="startGame"
          @reset-lobby="resetLobby"
        ></lobby-view>

        <game-view
          v-else-if="gameState"
          :game-state="gameState"
          :local-player-id="localPlayerId"
          :pending-approval="pendingApproval"
          :event-log-entries="eventLog"
          :restricted-log-entries="restrictedLog"
          :last-dice-roll="lastDiceRoll"
          :approval-mode="currentApprovalMode"
          @request-action="requestAction"
          @respond-approval="respondApproval"
          @flip-card="flipCard"
          @view-discard="viewDiscard"
          @roll-dice="rollDice"
          @toggle-approval="toggleApproval"
          @reset-lobby="resetLobby"
        ></game-view>

        <div v-else class="loading-screen">
          Waiting for game state...
        </div>
      </div>
    `
  });

  window.registerHeroToSlayComponent = function registerHeroToSlayComponent(installer) {
    if (typeof installer === 'function') {
      installer(app);
    }
  };

  for (const installer of installers) {
    if (typeof installer === 'function') {
      installer(app);
    }
  }

  app.mount('#app');
})();
