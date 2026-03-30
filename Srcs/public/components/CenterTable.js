// ============================================================
// FILE: public/components/CenterTable.js
// ============================================================

(function registerCenterTableComponent() {
  function install(app) {
    app.component('center-table', {
      props: {
        heroDeck: {
          type: Array,
          default: () => []
        },
        mainHeroDeck: {
          type: Array,
          default: () => []
        },
        monsterDeck: {
          type: Array,
          default: () => []
        },
        activeMonsters: {
          type: Array,
          default: () => [null, null, null]
        },
        discardPile: {
          type: Array,
          default: () => []
        }
      },
      emits: ['card-hover', 'card-unhover', 'card-rightclick'],
      computed: {
        heroDeckProxyCard() {
          const top = this.heroDeck[0] || null;

          return {
            id: top ? top.id : 'hero-deck',
            type: 'hero',
            isFaceUp: false,
            path: '',
            name: top && top.name ? top.name : 'Hero Deck'
          };
        },
        mainHeroDeckProxyCard() {
          const top = this.mainHeroDeck[0] || null;

          return {
            id: top ? top.id : 'mainhero-deck',
            type: 'mainhero',
            isFaceUp: false,
            path: '',
            name: top && top.name ? top.name : 'MainHero Deck'
          };
        },
        monsterDeckProxyCard() {
          const top = this.monsterDeck[0] || null;

          return {
            id: top ? top.id : 'monster-deck',
            type: 'monster',
            isFaceUp: false,
            path: '',
            name: top && top.name ? top.name : 'Monster Deck'
          };
        },
        normalizedActiveMonsters() {
          const slots = Array.isArray(this.activeMonsters) ? [...this.activeMonsters] : [];

          while (slots.length < 3) {
            slots.push(null);
          }

          return slots.slice(0, 3);
        },
        topDiscardCard() {
          if (!Array.isArray(this.discardPile) || this.discardPile.length === 0) {
            return null;
          }

          return this.discardPile[this.discardPile.length - 1] || null;
        }
      },
      methods: {
        forwardHover(card) {
          this.$emit('card-hover', card);
        },
        forwardUnhover() {
          this.$emit('card-unhover');
        },
        forwardRightclick(payload, slotIndex = null) {
          const enrichedPayload = {
            ...(payload || {})
          };

          if (Number.isInteger(slotIndex)) {
            enrichedPayload.slotIndex = slotIndex;
          }

          this.$emit('card-rightclick', enrichedPayload);
        },
        onDiscardRightClick(event) {
          if (this.topDiscardCard) {
            return;
          }

          event.preventDefault();

          this.$emit('card-rightclick', {
            card: null,
            zone: 'discard',
            x: event.clientX,
            y: event.clientY
          });
        }
      },
      template: `
        <section class="center-table">
          <div class="center-pile mainhero-deck-pile">
            <div class="pile-label">MainHero Deck ({{ mainHeroDeck.length }})</div>
            <card-component
              :card="mainHeroDeckProxyCard"
              zone="mainhero-deck"
              :is-own="false"
              @hover="forwardHover"
              @unhover="forwardUnhover"
              @rightclick="forwardRightclick"
            ></card-component>
          </div>

          <div class="center-pile hero-deck-pile">
            <div class="pile-label">Hero Deck ({{ heroDeck.length }})</div>
            <card-component
              :card="heroDeckProxyCard"
              zone="hero-deck"
              :is-own="false"
              @hover="forwardHover"
              @unhover="forwardUnhover"
              @rightclick="forwardRightclick"
            ></card-component>
          </div>

          <div class="center-pile monster-deck-pile">
            <div class="pile-label">Monster Deck ({{ monsterDeck.length }})</div>
            <card-component
              :card="monsterDeckProxyCard"
              zone="monster-deck"
              :is-own="false"
              @hover="forwardHover"
              @unhover="forwardUnhover"
              @rightclick="forwardRightclick"
            ></card-component>
          </div>

          <div class="active-monster-slots">
            <div class="pile-label">Active Monsters</div>
            <div class="active-monster-row">
              <div
                v-for="(monsterCard, slotIndex) in normalizedActiveMonsters"
                :key="'active-slot-' + slotIndex"
                class="active-monster-slot"
              >
                <card-component
                  v-if="monsterCard"
                  :card="monsterCard"
                  zone="active-monster"
                  :is-own="false"
                  @hover="forwardHover"
                  @unhover="forwardUnhover"
                  @rightclick="forwardRightclick($event, slotIndex)"
                ></card-component>

                <div v-else class="monster-slot-empty"></div>
              </div>
            </div>
          </div>

          <div class="center-pile discard-pile" @contextmenu="onDiscardRightClick">
            <div class="pile-label">Discard ({{ discardPile.length }} cards)</div>

            <card-component
              v-if="topDiscardCard"
              :card="topDiscardCard"
              zone="discard"
              :is-own="false"
              @hover="forwardHover"
              @unhover="forwardUnhover"
              @rightclick="forwardRightclick"
            ></card-component>

            <div v-else class="monster-slot-empty"></div>
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
