/* Alles aan elkaar knopen en de tekenlus starten. */

(function (MB) {
  'use strict';
  if (!window.THREE) return;

  const canvas = MB.$('#scene');
  const wereld = MB.World.init(canvas);

  // De maan bouwen kost even; het laadscherm blijft tot het beeld er staat.
  wereld.planeet.add(MB.Moon.bouwMesh());

  const controls = MB.maakControls(canvas, wereld.camera);
  const spel = MB.maakSpel(wereld, controls);

  // handig om in de console mee te prutsen
  MB.wereld = wereld;
  MB.controls = controls;
  MB.spel = spel;

  let vorige = performance.now();
  function frame(nu) {
    const dt = Math.min(0.05, (nu - vorige) / 1000);
    vorige = nu;

    controls.update(dt);
    spel.update(dt);
    wereld.render();

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(function (t) {
    vorige = t;
    frame(t);
    const laden = MB.$('#loader');
    laden.classList.add('weg');
    setTimeout(() => { laden.hidden = true; }, 700);
    MB.$('#help').hidden = false;   // eerste keer meteen de uitleg tonen
  });
})(window.MB);
