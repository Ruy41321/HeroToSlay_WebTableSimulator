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
          listeningForOutsideClick: false,
          menuX: 0,
          menuY: 0,
          listeningForViewportChanges: false
        };
      },
      computed: {
        menuStyle() {
          return {
            left: `${this.menuX}px`,
            top: `${this.menuY}px`
          };
        }
      },
      watch: {
        x() {
          this.scheduleReposition();
        },
        y() {
          this.scheduleReposition();
        },
        options() {
          this.scheduleReposition();
        },
        visible(nextVisible) {
          if (nextVisible) {
            this.enableOutsideClickDetection();
            this.enableViewportChangeDetection();
            this.scheduleReposition();
          } else {
            this.disableOutsideClickDetection();
            this.disableViewportChangeDetection();
          }
        }
      },
      mounted() {
        if (this.visible) {
          this.enableOutsideClickDetection();
          this.enableViewportChangeDetection();
          this.scheduleReposition();
        }
      },
      beforeUnmount() {
        this.disableOutsideClickDetection();
        this.disableViewportChangeDetection();
      },
      methods: {
        scheduleReposition() {
          if (!this.visible) {
            return;
          }

          this.$nextTick(() => {
            this.repositionWithinViewport();
          });
        },
        repositionWithinViewport() {
          const viewportWidth = window.innerWidth || 0;
          const viewportHeight = window.innerHeight || 0;
          const edgePadding = 8;

          const menuWidth = this.$el ? this.$el.offsetWidth : 200;
          const menuHeight = this.$el ? this.$el.offsetHeight : 160;

          let nextX = this.x;
          let nextY = this.y;

          // If there is not enough room on the right, open to the left of cursor.
          if (nextX + menuWidth + edgePadding > viewportWidth) {
            nextX = this.x - menuWidth;
          }

          // Clamp to viewport to avoid cut-off on very small screens.
          if (nextX < edgePadding) {
            nextX = edgePadding;
          }

          if (nextY + menuHeight + edgePadding > viewportHeight) {
            nextY = viewportHeight - menuHeight - edgePadding;
          }

          if (nextY < edgePadding) {
            nextY = edgePadding;
          }

          this.menuX = nextX;
          this.menuY = nextY;
        },
        handleSelect(option) {
          this.$emit('select', option.action);
          this.$emit('close');
        },
        onViewportChange() {
          this.scheduleReposition();
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
        },
        enableViewportChangeDetection() {
          if (this.listeningForViewportChanges) {
            return;
          }

          window.addEventListener('resize', this.onViewportChange);
          this.listeningForViewportChanges = true;
        },
        disableViewportChangeDetection() {
          if (!this.listeningForViewportChanges) {
            return;
          }

          window.removeEventListener('resize', this.onViewportChange);
          this.listeningForViewportChanges = false;
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
