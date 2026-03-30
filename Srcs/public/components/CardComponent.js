// ============================================================
// FILE: public/components/CardComponent.js
// ============================================================

(function registerCardComponent() {
  function install(app) {
    app.component('card-component', {
      props: {
        card: {
          type: Object,
          default: null
        },
        zone: {
          type: String,
          default: 'hand'
        },
        isOwn: {
          type: Boolean,
          default: false
        }
      },
      emits: ['hover', 'unhover', 'rightclick'],
      computed: {
        resolvedType() {
          if (this.card && (this.card.type === 'hero' || this.card.type === 'monster')) {
            return this.card.type;
          }

          if (this.zone === 'monster-deck' || this.zone === 'active-monster') {
            return 'monster';
          }

          return 'hero';
        },
        imageSource() {
          if (this.card && this.card.isFaceUp === true && this.card.path) {
            return this.card.path;
          }

          return this.resolvedType === 'monster'
            ? '/Assets/Cards/monster_card_back.png'
            : '/Assets/Cards/hero_card_back.png';
        },
        imageAlt() {
          if (this.card && this.card.isFaceUp === true && this.card.name) {
            return this.card.name;
          }

          return this.resolvedType === 'monster' ? 'Face-down monster card' : 'Face-down hero card';
        }
      },
      methods: {
        onMouseEnter() {
          this.$emit('hover', this.card);
        },
        onMouseLeave() {
          this.$emit('unhover');
        },
        onRightClick(event) {
          event.preventDefault();
          event.stopPropagation();

          this.$emit('rightclick', {
            card: this.card,
            zone: this.zone,
            x: event.clientX,
            y: event.clientY
          });
        }
      },
      template: `
        <div
          class="card"
          :class="{ 'card-own': isOwn }"
          @mouseenter="onMouseEnter"
          @mouseleave="onMouseLeave"
          @contextmenu="onRightClick"
        >
          <img :src="imageSource" :alt="imageAlt" draggable="false" />
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
