// ============================================================
// FILE: public/components/ApprovalPopup.js
// ============================================================

(function registerApprovalPopupComponent() {
  function install(app) {
    app.component('approval-popup', {
      props: {
        request: {
          type: Object,
          default: null
        }
      },
      emits: ['approve', 'deny'],
      template: `
        <div v-if="request" class="approval-popup-overlay">
          <div class="approval-popup-box">
            <p class="approval-popup-text">
              {{ request.requesterNickname }} wants to {{ request.details }}
            </p>

            <div class="approval-popup-actions">
              <button
                type="button"
                class="btn-approve"
                @click="$emit('approve', request.actionId)"
              >
                Approve
              </button>

              <button
                type="button"
                class="btn-deny"
                @click="$emit('deny', request.actionId)"
              >
                Deny
              </button>
            </div>
          </div>
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
