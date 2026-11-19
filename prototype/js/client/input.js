// Input fra tastatur og touch (pointer events, så joysticket også kan prøves med musen).
// snapshot() giver det, simuleringen skal bruge; tryk (dodge, potion …) tælles én gang.

const KEYMAP = {
  Space: 'attack', KeyJ: 'attack',
  KeyK: 'bolt',
  ShiftLeft: 'dodge', ShiftRight: 'dodge', KeyL: 'dodge',
  KeyQ: 'potion',
  KeyR: 'ration',
  KeyF: 'interact', Enter: 'interact',
  Escape: 'pause', KeyC: 'pause',
  Backquote: 'debug',
};
const MOVE = {
  KeyW: [0, -1], ArrowUp: [0, -1],
  KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
};
const HOLD = new Set(['attack', 'bolt']);
const JOY_RADIUS = 50;

function capture(el, pointerId) {
  try {
    el.setPointerCapture(pointerId);
  } catch {
    // Nogle browsere afviser capture for syntetiske eller allerede afsluttede pointere.
  }
}

export function createInput() {
  const keys = new Set();
  const held = new Set();
  const pressed = new Set();
  const joy = { id: null, x: 0, y: 0, cx: 0, cy: 0 };

  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    keys.add(e.code);
    const act = KEYMAP[e.code];
    if (act || MOVE[e.code]) e.preventDefault();
    if (act && !e.repeat) pressed.add(act);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => reset());

  // Touch-knapper
  for (const button of document.querySelectorAll('#touch-buttons .tb')) {
    const act = button.dataset.act;
    const release = () => {
      held.delete(act);
      button.classList.remove('pressed');
    };
    button.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      capture(button, e.pointerId);
      button.classList.add('pressed');
      if (HOLD.has(act)) held.add(act);
      else pressed.add(act);
    });
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
  }

  // Joystick: det sted, man sætter fingeren, bliver midten.
  const zone = document.getElementById('joy-zone');
  const base = document.getElementById('joy-base');
  const knob = document.getElementById('joy-knob');
  const placeKnob = () => {
    knob.style.transform = `translate(${joy.x * JOY_RADIUS}px, ${joy.y * JOY_RADIUS}px)`;
  };
  const endJoy = () => {
    joy.id = null;
    joy.x = 0;
    joy.y = 0;
    base.style.left = '';
    base.style.top = '';
    placeKnob();
  };
  zone.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    capture(zone, e.pointerId);
    const rect = zone.getBoundingClientRect();
    joy.id = e.pointerId;
    joy.cx = e.clientX;
    joy.cy = e.clientY;
    base.style.left = `${e.clientX - rect.left}px`;
    base.style.top = `${e.clientY - rect.top}px`;
  });
  zone.addEventListener('pointermove', (e) => {
    if (e.pointerId !== joy.id) return;
    let dx = (e.clientX - joy.cx) / JOY_RADIUS;
    let dy = (e.clientY - joy.cy) / JOY_RADIUS;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    joy.x = dx;
    joy.y = dy;
    placeKnob();
  });
  zone.addEventListener('pointerup', endJoy);
  zone.addEventListener('pointercancel', endJoy);

  function reset() {
    keys.clear();
    held.clear();
    pressed.clear();
    endJoy();
  }

  const keyAction = (a) => [...keys].some((k) => KEYMAP[k] === a);

  return {
    snapshot() {
      let mx = 0;
      let my = 0;
      for (const k of keys) {
        if (MOVE[k]) {
          mx += MOVE[k][0];
          my += MOVE[k][1];
        }
      }
      if (joy.id !== null) {
        // Lille dødzone, så en hvilende finger ikke flytter figuren.
        const len = Math.hypot(joy.x, joy.y);
        if (len > 0.15) {
          mx += joy.x;
          my += joy.y;
        }
      }
      return {
        moveX: mx,
        moveY: my,
        attack: held.has('attack') || keyAction('attack'),
        bolt: held.has('bolt') || keyAction('bolt'),
        dodge: pressed.has('dodge'),
        potion: pressed.has('potion'),
        ration: pressed.has('ration'),
        interact: pressed.has('interact'),
      };
    },
    // Tryk, som simuleringen har brugt.
    consumePresses() {
      for (const a of ['dodge', 'potion', 'ration', 'interact']) pressed.delete(a);
    },
    take(action) {
      const had = pressed.has(action);
      pressed.delete(action);
      return had;
    },
    reset,
  };
}
