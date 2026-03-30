// ============================================================
// FILE: public/components/DiceRoller.js
// ============================================================

(function registerDiceRollerComponent() {
  function install(app) {
    app.component('dice-roller', {
      props: {
        lastRoll: {
          type: Number,
          default: null
        }
      },
      emits: ['roll'],
      template: `
        <div class="dice-roller">
          <button
            type="button"
            class="dice-roll-button"
            @click="$emit('roll')"
          >
            Roll Dice (d12)
          </button>

          <span v-if="lastRoll !== null" class="dice-roll-result">
            Last roll: {{ lastRoll }}
          </span>
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
