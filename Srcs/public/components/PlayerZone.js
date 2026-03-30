// ============================================================
// FILE: public/components/PlayerZone.js
// ============================================================

(function registerPlayerZoneComponent() {
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
        }
      },
      emits: ['card-hover', 'card-unhover', 'card-rightclick'],
      computed: {
        positionClass() {
          return `position-${this.position}`;
        },
        handCards() {
          const cards = Array.isArray(this.player.hand) ? this.player.hand : [];

          return cards.map((card) => ({
            ...card,
            ownerId: card.ownerId || this.player.id,
            isFaceUp: this.isLocal ? Boolean(card.isFaceUp) : false
          }));
        },
        boardCards() {
          const cards = Array.isArray(this.player.board) ? this.player.board : [];

          return cards.map((card) => ({
            ...card,
            ownerId: card.ownerId || this.player.id
          }));
        }
      },
      methods: {
        forwardHover(card) {
          this.$emit('card-hover', card);
        },
        forwardUnhover() {
          this.$emit('card-unhover');
        },
        forwardRightclick(payload) {
          this.$emit('card-rightclick', payload);
        }
      },
      template: `
        <section class="player-zone" :class="[positionClass, { 'player-zone-local': isLocal }]">
          <div class="player-nickname">{{ player.nickname }}</div>

          <div class="player-board">
            <card-component
              v-for="card in boardCards"
              :key="'board-' + card.id"
              :card="card"
              zone="board"
              :is-own="isLocal"
              @hover="forwardHover"
              @unhover="forwardUnhover"
              @rightclick="forwardRightclick"
            ></card-component>
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
