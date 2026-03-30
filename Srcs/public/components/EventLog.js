// ============================================================
// FILE: public/components/EventLog.js
// ============================================================

(function registerEventLogComponent() {
  function install(app) {
    app.component('event-log', {
      props: {
        entries: {
          type: Array,
          default: () => []
        },
        visible: {
          type: Boolean,
          default: true
        }
      },
      methods: {
        formatTimestamp(timestamp) {
          const parsed = new Date(timestamp);

          if (Number.isNaN(parsed.getTime())) {
            return '??:??:??';
          }

          const hours = String(parsed.getHours()).padStart(2, '0');
          const minutes = String(parsed.getMinutes()).padStart(2, '0');
          const seconds = String(parsed.getSeconds()).padStart(2, '0');

          return `${hours}:${minutes}:${seconds}`;
        },
        normalizeMessage(entry) {
          if (entry && typeof entry.message === 'string') {
            return entry.message;
          }

          return '';
        }
      },
      template: `
        <section class="log-panel event-log" v-show="visible">
          <h3>Event Log</h3>

          <div
            v-for="(entry, index) in entries"
            :key="(entry.timestamp || 'no-time') + '-' + index"
            class="log-entry"
          >
            [{{ formatTimestamp(entry.timestamp) }}] {{ normalizeMessage(entry) }}
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
