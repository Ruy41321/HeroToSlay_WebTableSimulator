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
        localPlayerNickname: null,
        isSpectator: false,
        spectatorDisplayName: null,
        lobbyPlayers: [],
        gameInProgress: false,
        gameState: null,
        pendingApproval: null,
        pendingOwnRequest: null,
        eventLog: [],
        restrictedLog: [],
        showEventLog: false,
        showRestrictedLog: false,
        availableBackgrounds: [
          '/Assets/Miscellaneous/table_background.png',
          '/Assets/Miscellaneous/bg.jpg',
        ],
        currentBackgroundIndex: 0,
        lastDiceRoll: null,
        discardPileModal: [],
        showDiscardModal: false,
        mainHeroPileModal: [],
        showMainHeroModal: false
      };
    },
    computed: {
      currentApprovalMode() {
        if (this.gameState && typeof this.gameState.approvalMode === 'boolean') {
          return this.gameState.approvalMode;
        }

        return false;
      }
    },
    mounted() {
      this.applyCurrentBackground();
    },
    created() {
      if (!this.socket) {
        console.error('Socket.io client is not available.');
        return;
      }

      this.socket.on('connect', () => {
        console.log('[SOCKET] Connected to server');
      });

      this.socket.on('lobby_update', (data = {}) => {
        const wasInGame = this.gameInProgress || this.view === 'game' || this.gameState !== null;
        this.lobbyPlayers = Array.isArray(data.players) ? data.players : [];
        this.gameInProgress = Boolean(data.gameInProgress);

        if (!this.gameInProgress) {
          if (wasInGame) {
            console.log('[LOBBY] Reset — returning to lobby view');
          }
          this.view = 'lobby';
          this.gameState = null;
          this.localPlayerId = null;
          this.localPlayerNickname = null;
          this.isSpectator = false;
          this.spectatorDisplayName = null;
          this.pendingApproval = null;
          this.pendingOwnRequest = null;
          this.eventLog = [];
          this.restrictedLog = [];
          this.lastDiceRoll = null;
          this.discardPileModal = [];
          this.showDiscardModal = false;
          this.mainHeroPileModal = [];
          this.showMainHeroModal = false;
        }
      });

      this.socket.on('game_start', ({ yourPlayerId, yourNickname } = {}) => {
        console.log(`[GAME] Game started — localPlayerId: ${yourPlayerId}`);
        this.localPlayerId = yourPlayerId || null;
        this.localPlayerNickname =
          typeof yourNickname === 'string' && yourNickname.trim().length > 0
            ? yourNickname.trim()
            : null;
        this.isSpectator = false;
        this.spectatorDisplayName = null;
        this.view = 'game';
      });

      this.socket.on('reconnect_success', (data = {}) => {
        console.log('[RECONNECT] Rejoined as', data.yourNickname);
        this.localPlayerId = data.yourPlayerId || null;
        this.localPlayerNickname = data.yourNickname || null;
        this.isSpectator = false;
        this.spectatorDisplayName = null;
        this.view = 'game';
      });

      this.socket.on('spectator_joined', (data = {}) => {
        console.log('[SPECTATOR] Joined as', data.displayName);
        this.localPlayerId = null;
        this.localPlayerNickname = null;
        this.isSpectator = true;
        this.spectatorDisplayName = data.displayName || 'Spectator';
        this.view = 'game';
      });

      this.socket.on('approval_pending', (data = {}) => {
        console.log('[APPROVAL] Pending request:', data.type, 'by', data.requesterNickname);

        if (!data || typeof data !== 'object') {
          return;
        }

        const requesterId = data.requesterId ? String(data.requesterId) : null;
        const localPlayerId = this.localPlayerId ? String(this.localPlayerId) : null;
        const isRequesterById = requesterId && localPlayerId && requesterId === localPlayerId;

        const requesterNickname =
          typeof data.requesterNickname === 'string' ? data.requesterNickname.trim().toLowerCase() : '';
        const localNicknameFromStart =
          typeof this.localPlayerNickname === 'string' ? this.localPlayerNickname.trim().toLowerCase() : '';
        const localNicknameFromState = this.getLocalNickname().trim().toLowerCase();
        const localNickname = localNicknameFromStart || localNicknameFromState;
        const isRequesterByNickname =
          requesterNickname && localNickname && requesterNickname === localNickname;

        if (isRequesterById || isRequesterByNickname) {
          this.pendingOwnRequest = {
            actionId: data.actionId || null,
            type: data.type || null,
            details: data.details || ''
          };
        }
      });

      this.socket.on('approval_pending_cleared', () => {
        console.log('[APPROVAL] Pending request cleared');
        this.pendingOwnRequest = null;
      });

      this.socket.on('state_update', (state) => {
        if (!state || typeof state !== 'object') {
          return;
        }

        this.gameState = state;
        console.log('[STATE] State updated — phase:', this.gameState?.phase);

        if (state.phase === 'playing') {
          this.view = 'game';
          return;
        }

        if (state.phase === 'lobby') {
          this.view = 'lobby';
        }
      });

      this.socket.on('approval_request', (data) => {
        if (!data || typeof data !== 'object') {
          this.pendingApproval = null;
          return;
        }

        console.log(
          `[APPROVAL] Incoming request: ${data.type} from ${data.requesterNickname}`
        );

        const requesterId = data.requesterId ? String(data.requesterId) : null;
        const requesterNickname =
          data.requesterNickname && typeof data.requesterNickname === 'string'
            ? data.requesterNickname.toLowerCase()
            : null;
        const localNickname = this.getLocalNickname();

        const isRequesterById =
          requesterId && this.localPlayerId && String(this.localPlayerId) === String(requesterId);
        const isRequesterByNickname =
          requesterNickname && localNickname && requesterNickname === localNickname.toLowerCase();

        this.pendingApproval = isRequesterById || isRequesterByNickname ? null : data;
      });

      this.socket.on('approval_result', (data = {}) => {
        const { actionId, granted, approverNickname } = data;
        console.log(`[APPROVAL] Result: granted=${granted}`);
        this.pendingApproval = null;
        this.pendingOwnRequest = null;

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

      this.socket.on('dice_result', ({ result } = {}) => {
        this.lastDiceRoll = Number.isInteger(result) ? result : null;
      });

      this.socket.on('discard_pile', (data = {}) => {
        this.discardPileModal = Array.isArray(data.cards) ? data.cards : [];
        this.showDiscardModal = true;
      });

      this.socket.on('mainhero_deck', (data = {}) => {
        this.mainHeroPileModal = Array.isArray(data.cards) ? data.cards : [];
        this.showMainHeroModal = true;
      });

      this.socket.on('error', (data = {}) => {
        if (!data.message) {
          return;
        }

        console.error('[ERROR]', data.message);
        this.prependEvent({
          message: `Error: ${data.message}`,
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

        if (typeof nickname === 'string' && nickname.trim().length > 0) {
          this.localPlayerNickname = nickname.trim();
        }

        this.isSpectator = false;
        this.spectatorDisplayName = null;

        this.socket.emit('join_lobby', { nickname });
      },
      joinSpectator(displayName) {
        if (!this.socket) {
          return;
        }

        this.socket.emit('join_spectator', { displayName });
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

        if (this.pendingOwnRequest) {
          console.warn('[APPROVAL] Ignored request_action while own request is pending.');
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
      moveBoardCard(payload = {}) {
        if (!this.socket || this.isSpectator) {
          return;
        }

        const x = Number(payload.x);
        const y = Number(payload.y);

        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          return;
        }

        this.socket.emit('move_board_card', {
          cardId: payload.cardId,
          targetPlayerId: payload.targetPlayerId,
          x,
          y
        });
      },
      viewDiscard() {
        if (!this.socket) {
          return;
        }

        this.socket.emit('view_discard', {});
      },
      viewMainHeroDeck() {
        if (!this.socket) {
          return;
        }

        this.socket.emit('view_main_heroes', {});
      },
      closeDiscardModal() {
        this.showDiscardModal = false;
      },
      closeMainHeroModal() {
        this.showMainHeroModal = false;
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
      onToggleEventLog() {
        this.showEventLog = !this.showEventLog;
      },
      onToggleRestrictedLog() {
        this.showRestrictedLog = !this.showRestrictedLog;
      },
      applyCurrentBackground() {
        const backgroundImage =
          this.availableBackgrounds[this.currentBackgroundIndex] || this.availableBackgrounds[0];

        if (!backgroundImage || !document || !document.body) {
          return;
        }

        document.body.style.backgroundImage = `url('${backgroundImage}')`;
        document.body.style.backgroundPosition = 'center';
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundRepeat = 'no-repeat';
        document.body.style.backgroundAttachment = 'fixed';
      },
      cycleBackground() {
        if (!Array.isArray(this.availableBackgrounds) || this.availableBackgrounds.length === 0) {
          return;
        }

        this.currentBackgroundIndex =
          (this.currentBackgroundIndex + 1) % this.availableBackgrounds.length;
        this.applyCurrentBackground();
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
          @join-spectator="joinSpectator"
          @start="startGame"
          @reset-lobby="resetLobby"
          @cycle-background="cycleBackground"
        ></lobby-view>

        <game-view
          v-else-if="gameState"
          :game-state="gameState"
          :local-player-id="localPlayerId"
          :pending-approval="pendingApproval"
          :pending-own-request="pendingOwnRequest"
          :event-log-entries="eventLog"
          :restricted-log-entries="restrictedLog"
          :show-event-log="showEventLog"
          :show-restricted-log="showRestrictedLog"
          :last-dice-roll="lastDiceRoll"
          :approval-mode="currentApprovalMode"
          :show-discard-modal="showDiscardModal"
          :discard-pile-modal="discardPileModal"
          :show-main-hero-modal="showMainHeroModal"
          :main-hero-pile-modal="mainHeroPileModal"
          :is-spectator="isSpectator"
          @request-action="requestAction"
          @respond-approval="respondApproval"
          @flip-card="flipCard"
          @move-board-card="moveBoardCard"
          @view-discard="viewDiscard"
          @view-main-hero-deck="viewMainHeroDeck"
          @close-discard-modal="closeDiscardModal"
          @close-main-hero-modal="closeMainHeroModal"
          @roll-dice="rollDice"
          @toggle-approval="toggleApproval"
          @toggle-event-log="onToggleEventLog"
          @toggle-restricted-log="onToggleRestrictedLog"
          @reset-lobby="resetLobby"
          @cycle-background="cycleBackground"
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
