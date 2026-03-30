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
        }
      },
      template: `
        <aside class="focus-preview" v-show="isVisible">
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
