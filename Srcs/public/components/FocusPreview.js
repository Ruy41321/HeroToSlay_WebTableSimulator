// ============================================================
// FILE: public/components/FocusPreview.js
// ============================================================

(function registerFocusPreviewComponent() {
  function install(app) {
    app.component('focus-preview', {
      props: {
        card: {
          type: Object,
          default: null
        },
        centered: {
          type: Boolean,
          default: false
        }
      },
      computed: {
        isVisible() {
          return Boolean(this.card && this.card.isFaceUp);
        },
        cardName() {
          return this.card && this.card.name ? this.card.name : '';
        },
        cardPath() {
          return this.card && this.card.path ? this.card.path : '';
        },
        cardType() {
          return this.card && typeof this.card.type === 'string' ? this.card.type.toLowerCase() : '';
        },
        isTallType() {
          return this.cardType === 'mainhero' || this.cardType === 'monster' || this.cardType === 'monsters';
        },
        previewClass() {
          return {
            'focus-preview-centered': this.centered,
            'focus-preview-tall': this.isTallType
          };
        }
      },
      template: `
        <aside class="focus-preview" :class="previewClass" v-show="isVisible">
          <img
            v-if="isVisible"
            class="focus-preview-image"
            :src="cardPath"
            :alt="cardName"
          />
          <div class="focus-preview-name">{{ cardName }}</div>
        </aside>
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
