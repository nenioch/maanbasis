/* De kolonisten: poppetjes in een ruimtepak die over de laagvlakte lopen. Ze
   wonen in dezelfde groep als de maan, dus ze draaien mee. Hun plaats houden we
   bij in u/v — dezelfde vlakke coördinaten waarin ook de bouwplekken liggen —
   en pas bij het tekenen wordt daar een punt op de bol van gemaakt. */

(function (MB) {
  'use strict';
  if (!window.THREE) return;

  const Moon = MB.Moon;
  const MAT = MB.Buildings.MAT;

  const MAX = 20;                 // meer poppetjes wordt een mierenhoop
  const TEMPO = 1.15;             // eenheden per seconde
  const AANKOMST = 0.4;
  const MIJD = 2.9;               // zo dicht komen ze niet langs een module
  const VLAKTE = 10.6;            // binnen deze straal blijft de grond vlak

  // ------------------------------------------------------------ materialen

  function std(kleur, ruw, metaal) {
    return new THREE.MeshStandardMaterial({
      color: kleur, roughness: ruw, metalness: metaal, flatShading: true
    });
  }

  const PAK = std(0xe8edf3, 0.60, 0.05);
  const VIZIER = new THREE.MeshStandardMaterial({
    color: 0xd9a441, roughness: 0.15, metalness: 0.95
  });
  // elk pak krijgt een eigen accentkleur, zo houd je ze uit elkaar
  const ACCENTEN = [0xff8b45, 0x62d8ff, 0x6fd66a, 0xd8433a, 0xffd166, 0xb98bff]
    .map((k) => std(k, 0.50, 0.10));

  // ----------------------------------------------------------- onderdelen

  /* Eén set geometrie voor alle poppetjes; alleen de accentkleur verschilt. */
  const G = {
    been: new THREE.CylinderGeometry(0.055, 0.048, 0.34, 6),
    voet: new THREE.BoxGeometry(0.12, 0.06, 0.19),
    lijf: new THREE.CylinderGeometry(0.16, 0.185, 0.36, 10),
    band: new THREE.TorusGeometry(0.175, 0.022, 6, 14),
    rugzak: new THREE.BoxGeometry(0.22, 0.26, 0.13),
    slang: new THREE.CylinderGeometry(0.025, 0.025, 0.16, 5),
    schouder: new THREE.SphereGeometry(0.075, 8, 6),
    arm: new THREE.CylinderGeometry(0.045, 0.040, 0.30, 6),
    hand: new THREE.SphereGeometry(0.055, 7, 5),
    nek: new THREE.CylinderGeometry(0.07, 0.07, 0.06, 8),
    helm: new THREE.SphereGeometry(0.145, 12, 9),
    vizier: new THREE.SphereGeometry(0.128, 12, 9),
    lampje: new THREE.SphereGeometry(0.032, 6, 5)
  };
  G.been.translate(0, -0.17, 0);        // draait om de heup
  G.arm.translate(0, -0.15, 0);         // draait om de schouder

  function deel(geo, mat, x, y, z) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x || 0, y || 0, z || 0);
    return m;
  }

  /* Een poppetje met de voeten op y = 0 en het vizier naar +Z. */
  function maakPoppetje(accent) {
    const g = new THREE.Group();

    const benen = [];
    [-0.085, 0.085].forEach(function (x) {
      const been = new THREE.Group();
      been.position.set(x, 0.34, 0);
      been.add(deel(G.been, PAK, 0, 0, 0));
      been.add(deel(G.voet, MAT.donker, 0, -0.32, 0.03));
      benen.push(been);
      g.add(been);
    });

    g.add(deel(G.lijf, PAK, 0, 0.52, 0));
    const band = deel(G.band, accent, 0, 0.60, 0);
    band.rotation.x = -Math.PI / 2;
    g.add(band);

    g.add(deel(G.rugzak, MAT.donker, 0, 0.55, -0.19));
    g.add(deel(G.slang, MAT.staal, 0.10, 0.70, -0.13));
    g.add(deel(G.lampje, MAT.lamp, 0, 0.66, 0.17));      // borstlamp voor de nacht

    const armen = [];
    [-0.195, 0.195].forEach(function (x) {
      g.add(deel(G.schouder, PAK, x, 0.66, 0));
      const arm = new THREE.Group();
      arm.position.set(x, 0.66, 0);
      arm.add(deel(G.arm, PAK, 0, 0, 0));
      arm.add(deel(G.hand, accent, 0, -0.31, 0));
      armen.push(arm);
      g.add(arm);
    });

    g.add(deel(G.nek, MAT.staal, 0, 0.73, 0));
    g.add(deel(G.helm, PAK, 0, 0.86, 0));
    g.add(deel(G.vizier, VIZIER, 0, 0.86, 0.045));

    g.userData.kolonist = true;
    g.userData.refs = { benen: benen, armen: armen };
    return g;
  }

  // ----------------------------------------------------------- het volkje

  MB.Kolonisten = {
    MAX: MAX,

    maak: function (planeet) {
      const groep = new THREE.Group();
      planeet.add(groep);

      const leden = [];
      const dir = new THREE.Vector3();
      const voorUit = new THREE.Vector3();
      const asX = new THREE.Vector3();
      const asZ = new THREE.Vector3();
      const basis = new THREE.Matrix4();
      const doelQ = new THREE.Quaternion();

      const volk = {
        groep: groep,
        doelen: [],        // waar iets te doen is; het spel houdt dit bij
        leden: leden
      };

      function nieuwDoel(k) {
        const d = volk.doelen;
        if (d.length && Math.random() < 0.72) {
          // naast een module gaan staan, net buiten de ontwijkring
          const p = d[(Math.random() * d.length) | 0];
          const a = Math.random() * Math.PI * 2;
          k.doelU = p.u + Math.cos(a) * 3.4;
          k.doelV = p.v + Math.sin(a) * 3.4;
        } else {
          const a = Math.random() * Math.PI * 2;
          const r = Math.sqrt(Math.random()) * (VLAKTE - 0.6);
          k.doelU = Math.cos(a) * r;
          k.doelV = Math.sin(a) * r;
        }
        const len = Math.hypot(k.doelU, k.doelV);
        if (len > VLAKTE) {
          k.doelU *= VLAKTE / len;
          k.doelV *= VLAKTE / len;
        }
      }

      function voegToe() {
        const g = maakPoppetje(ACCENTEN[leden.length % ACCENTEN.length]);
        groep.add(g);

        // ergens bij het midden van de basis naar buiten stappen
        const a = Math.random() * Math.PI * 2;
        const r = 2.5 + Math.random() * 3;
        const k = {
          groep: g,
          refs: g.userData.refs,
          u: Math.cos(a) * r, v: Math.sin(a) * r,
          doelU: 0, doelV: 0,
          koersU: Math.cos(a), koersV: Math.sin(a),
          wacht: Math.random() * 3,
          fase: Math.random() * 6.28,
          zwaai: 0
        };
        nieuwDoel(k);
        leden.push(k);
      }

      volk.zetAantal = function (n) {
        n = MB.clamp(n, 0, MAX);
        while (leden.length < n) voegToe();
        while (leden.length > n) groep.remove(leden.pop().groep);
      };

      volk.update = function (dt) {
        for (let i = 0; i < leden.length; i++) {
          const k = leden[i];
          let loopt = false;

          if (k.wacht > 0) {
            k.wacht -= dt;
          } else {
            let du = k.doelU - k.u, dv = k.doelV - k.v;
            const afstand = Math.hypot(du, dv);

            if (afstand < AANKOMST) {
              k.wacht = 1.5 + Math.random() * 4.5;       // even rondkijken
              nieuwDoel(k);
            } else {
              du /= afstand;
              dv /= afstand;

              // niet dwars door een module heen lopen
              for (let j = 0; j < volk.doelen.length; j++) {
                const p = volk.doelen[j];
                const ou = k.u - p.u, ov = k.v - p.v;
                const d = Math.hypot(ou, ov);
                if (d > 1e-3 && d < MIJD) {
                  const w = ((MIJD - d) / MIJD) * 1.8;
                  du += (ou / d) * w;
                  dv += (ov / d) * w;
                }
              }
              const len = Math.hypot(du, dv) || 1;
              du /= len;
              dv /= len;

              k.u += du * TEMPO * dt;
              k.v += dv * TEMPO * dt;
              k.koersU = du;
              k.koersV = dv;
              k.fase += dt * 7.5;
              loopt = true;
            }
          }

          // ---- op de bol zetten
          dir.copy(Moon.richtingUitOffset(k.u, k.v));
          k.zwaai += ((loopt ? 1 : 0) - k.zwaai) * Math.min(1, dt * 5);

          // in lage zwaartekracht stuiter je bij elke stap wat op
          const wip = Math.abs(Math.sin(k.fase)) * 0.07 * k.zwaai;
          k.groep.position.copy(dir).multiplyScalar(Moon.hoogteBij(dir) + wip);

          // kijkrichting: de normaal is omhoog, de looprichting is +Z
          voorUit.copy(Moon.richtingUitOffset(k.u + k.koersU * 0.3, k.v + k.koersV * 0.3))
            .sub(dir);
          voorUit.addScaledVector(dir, -voorUit.dot(dir));
          if (voorUit.lengthSq() > 1e-10) {
            voorUit.normalize();
            asX.crossVectors(dir, voorUit).normalize();
            asZ.crossVectors(asX, dir).normalize();
            basis.makeBasis(asX, dir, asZ);
            doelQ.setFromRotationMatrix(basis);
            k.groep.quaternion.slerp(doelQ, Math.min(1, dt * 7));
          }

          // ---- armen en benen
          const s = Math.sin(k.fase) * 0.75 * k.zwaai;
          k.refs.benen[0].rotation.x = s;
          k.refs.benen[1].rotation.x = -s;
          k.refs.armen[0].rotation.x = -s * 0.6;
          k.refs.armen[1].rotation.x = s * 0.6;
        }
      };

      return volk;
    }
  };
})(window.MB);
