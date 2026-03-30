// ============================================================
// FILE: public/components/ApprovalToggle.js
// ============================================================

(function registerApprovalToggleComponent() {
  function install(app) {
    app.component('approval-toggle', {
      props: {
        approvalMode: {
          type: Boolean,
          default: true
        }
      },
      emits: ['toggle'],
      computed: {
        modeLabel() {
          return `Approval Mode: ${this.approvalMode ? 'ON' : 'OFF'}`;
        },
        modeClass() {
          return this.approvalMode ? 'approval-on' : 'approval-off';
        }
      },
      template: `
        <button
          type="button"
          class="approval-toggle"
          :class="modeClass"
          @click="$emit('toggle')"
        >
          {{ modeLabel }}
        </button>
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
