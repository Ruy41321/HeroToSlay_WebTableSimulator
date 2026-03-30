// ============================================================
// FILE: public/components/RestrictedLog.js
// ============================================================

(function registerRestrictedLogComponent() {
  function install(app) {
    app.component('restricted-log', {
      props: {
        entries: {
          type: Array,
          default: () => []
        }
      },
      computed: {
        normalizedEntries() {
          return [...this.entries]
            .map((entry) => {
              if (typeof entry === 'string') {
                return entry;
              }

              if (entry && typeof entry.message === 'string') {
                return entry.message;
              }

              return '';
            })
            .filter((entry) => entry.length > 0)
            .reverse();
        }
      },
      methods: {
        isUndoEntry(entry) {
          return entry.includes('UNDO');
        }
      },
      template: `
        <section class="log-panel restricted-log">
          <h3>Restricted Action History</h3>

          <div
            v-for="(entry, index) in normalizedEntries"
            :key="entry + '-' + index"
            class="log-entry"
            :class="{ 'restricted-log-undo': isUndoEntry(entry) }"
          >
            <span v-if="isUndoEntry(entry)">↩ </span>{{ entry }}
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
