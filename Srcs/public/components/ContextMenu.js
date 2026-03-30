// ============================================================
// FILE: public/components/ContextMenu.js
// ============================================================

(function registerContextMenuComponent() {
  function install(app) {
    app.component('context-menu', {
      props: {
        visible: {
          type: Boolean,
          default: false
        },
        x: {
          type: Number,
          default: 0
        },
        y: {
          type: Number,
          default: 0
        },
        options: {
          type: Array,
          default: () => []
        }
      },
      emits: ['select', 'close'],
      data() {
        return {
          listeningForOutsideClick: false
        };
      },
      computed: {
        menuStyle() {
          return {
            left: `${this.x}px`,
            top: `${this.y}px`
          };
        }
      },
      watch: {
        visible(nextVisible) {
          if (nextVisible) {
            this.enableOutsideClickDetection();
          } else {
            this.disableOutsideClickDetection();
          }
        }
      },
      mounted() {
        if (this.visible) {
          this.enableOutsideClickDetection();
        }
      },
      beforeUnmount() {
        this.disableOutsideClickDetection();
      },
      methods: {
        handleSelect(option) {
          this.$emit('select', option.action);
          this.$emit('close');
        },
        onDocumentInteraction(event) {
          if (!this.visible) {
            return;
          }

          if (this.$el && !this.$el.contains(event.target)) {
            this.$emit('close');
          }
        },
        enableOutsideClickDetection() {
          if (this.listeningForOutsideClick) {
            return;
          }

          document.addEventListener('click', this.onDocumentInteraction);
          document.addEventListener('contextmenu', this.onDocumentInteraction);
          this.listeningForOutsideClick = true;
        },
        disableOutsideClickDetection() {
          if (!this.listeningForOutsideClick) {
            return;
          }

          document.removeEventListener('click', this.onDocumentInteraction);
          document.removeEventListener('contextmenu', this.onDocumentInteraction);
          this.listeningForOutsideClick = false;
        }
      },
      template: `
        <div
          v-if="visible"
          class="context-menu"
          :style="menuStyle"
          @click.stop
          @contextmenu.prevent
        >
          <button
            v-for="(option, index) in options"
            :key="option.label + '-' + index"
            type="button"
            class="context-menu-item"
            @click.stop="handleSelect(option)"
          >
            {{ option.label }}
          </button>
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
