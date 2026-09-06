/* De modules van de basis. Elke bouwer levert een THREE.Group met de voet op
   y = 0; de spelcode zet die groep op het maanoppervlak en draait hem mee met
   de normaal. Onderdelen die later nog bewegen (raket, meter, gewassen) worden
   in group.userData bewaard. */

(function (MB) {
  'use strict';
  if (!window.THREE) return;

  // ---------------------------------------------------------- materialen

  function std(kleur, ruw, metaal, extra) {
    return new THREE.MeshStandardMaterial(Object.assign({
      color: kleur, roughness: ruw, metalness: metaal, flatShading: true
    }, extra || {}));
  }

  const MAT = {
    romp:      std(0xd5dde5, 0.45, 0.25),
    licht:     std(0xeef2f6, 0.55, 0.10),
    donker:    std(0x4d5966, 0.60, 0.45),
    staal:     std(0x8f9aa6, 0.40, 0.60),
    oranje:    std(0xff8b45, 0.50, 0.10),
    rood:      std(0xd8433a, 0.55, 0.10),
    aarde:     std(0x6b6156, 0.95, 0.00),
    gewas:     std(0x5cbf58, 0.85, 0.00),
    paneel:    std(0x1c3c6b, 0.25, 0.70),
    glas:      new THREE.MeshStandardMaterial({
                 color: 0x9fe4ff, roughness: 0.08, metalness: 0.05,
                 transparent: true, opacity: 0.30, side: THREE.DoubleSide
               }),
    raam:      new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffb257, emissiveIntensity: 1.0, roughness: 0.4 }),
    lamp:      new THREE.MeshStandardMaterial({ color: 0xff8b45, emissive: 0xff6a1e, emissiveIntensity: 1.2, roughness: 0.5 }),
    kweeklamp: new THREE.MeshStandardMaterial({ color: 0xff8ec6, emissive: 0xff4fa8, emissiveIntensity: 1.4, roughness: 0.5 }),
    vlam:      new THREE.MeshBasicMaterial({ color: 0xffc46a, transparent: true, opacity: 0.9 })
  };

  function deel(geo, mat, x, y, z) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x || 0, y || 0, z || 0);
    return m;
  }

  // ------------------------------------------------------ lanceerplatform

  function bouwLanceerplatform() {
    const g = new THREE.Group();

    g.add(deel(new THREE.CylinderGeometry(2.35, 2.6, 0.4, 8), MAT.donker, 0, 0.20, 0));
    g.add(deel(new THREE.CylinderGeometry(2.05, 2.05, 0.08, 8), MAT.staal, 0, 0.44, 0));

    // waarschuwingsring van lampjes langs de rand
    const lampjes = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const l = deel(new THREE.SphereGeometry(0.10, 8, 6), MAT.lamp,
        Math.cos(a) * 2.2, 0.5, Math.sin(a) * 2.2);
      lampjes.push(l);
      g.add(l);
    }

    // oprit naar het dek
    const oprit = deel(new THREE.BoxGeometry(1.3, 0.09, 1.7), MAT.donker, 0, 0.24, 2.3);
    oprit.rotation.x = 0.22;
    g.add(oprit);

    // servicetoren
    const toren = new THREE.Group();
    toren.position.set(-2.0, 0, 0);
    toren.add(deel(new THREE.BoxGeometry(0.24, 4.8, 0.24), MAT.staal, 0, 2.4, 0));
    toren.add(deel(new THREE.BoxGeometry(1.3, 0.14, 0.14), MAT.staal, 0.65, 2.0, 0));
    toren.add(deel(new THREE.BoxGeometry(1.3, 0.14, 0.14), MAT.staal, 0.65, 3.4, 0));
    toren.add(deel(new THREE.SphereGeometry(0.12, 8, 6), MAT.lamp, 0, 4.9, 0));
    g.add(toren);

    // ---- de raket
    const raket = new THREE.Group();
    raket.position.y = 0.48;
    raket.add(deel(new THREE.CylinderGeometry(0.28, 0.52, 0.6, 12), MAT.donker, 0, 0.30, 0));
    raket.add(deel(new THREE.CylinderGeometry(0.50, 0.50, 2.4, 14), MAT.licht, 0, 1.80, 0));
    raket.add(deel(new THREE.CylinderGeometry(0.52, 0.52, 0.34, 14), MAT.oranje, 0, 2.45, 0));
    raket.add(deel(new THREE.ConeGeometry(0.50, 1.05, 14), MAT.licht, 0, 3.52, 0));

    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const vin = deel(new THREE.BoxGeometry(0.07, 0.85, 0.62), MAT.oranje,
        Math.sin(a) * 0.52, 1.05, Math.cos(a) * 0.52);
      vin.rotation.y = a;
      raket.add(vin);
    }

    const vlam = deel(new THREE.ConeGeometry(0.42, 1.8, 12), MAT.vlam, 0, -0.85, 0);
    vlam.rotation.x = Math.PI;
    vlam.visible = false;
    raket.add(vlam);

    g.add(raket);

    g.userData.refs = { raket: raket, vlam: vlam, lampjes: lampjes };
    return g;
  }

  // ---------------------------------------------------------- woonmodule

  function bouwWoonmodule() {
    const g = new THREE.Group();

    g.add(deel(new THREE.CylinderGeometry(1.85, 1.98, 0.36, 20), MAT.donker, 0, 0.18, 0));

    const koepel = deel(new THREE.SphereGeometry(1.6, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      MAT.romp, 0, 0.34, 0);
    g.add(koepel);

    const ring = deel(new THREE.TorusGeometry(1.58, 0.07, 8, 26), MAT.oranje, 0, 0.42, 0);
    ring.rotation.x = -Math.PI / 2;
    g.add(ring);

    // ramen rondom, net boven de ring
    const ramen = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      const y = 0.95;
      const r = Math.sqrt(Math.max(0.04, 1.6 * 1.6 - (y - 0.34) * (y - 0.34))) - 0.05;
      const raam = deel(new THREE.BoxGeometry(0.4, 0.26, 0.12), MAT.raam,
        Math.sin(a) * r, y, Math.cos(a) * r);
      raam.rotation.y = a;
      ramen.push(raam);
      g.add(raam);
    }

    // luchtsluis met deur aan de voorkant
    const sluis = deel(new THREE.CylinderGeometry(0.46, 0.46, 1.5, 12), MAT.romp, 0, 0.52, 1.5);
    sluis.rotation.x = Math.PI / 2;
    g.add(sluis);
    const deur = deel(new THREE.CylinderGeometry(0.5, 0.5, 0.12, 12), MAT.oranje, 0, 0.52, 2.25);
    deur.rotation.x = Math.PI / 2;
    g.add(deur);

    // antenne
    g.add(deel(new THREE.CylinderGeometry(0.045, 0.045, 1.0, 6), MAT.staal, 0.6, 2.05, 0));
    const schotel = deel(new THREE.SphereGeometry(0.32, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      MAT.licht, 0.6, 2.5, 0);
    schotel.rotation.set(0.6, 0, 0.35);
    g.add(schotel);

    g.userData.refs = { ramen: ramen };
    return g;
  }

  // ------------------------------------------------------- brandstoftank

  function bouwBrandstoftank() {
    const g = new THREE.Group();

    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      g.add(deel(new THREE.CylinderGeometry(0.10, 0.12, 0.62, 6), MAT.staal,
        Math.cos(a) * 0.85, 0.31, Math.sin(a) * 0.85));
    }
    g.add(deel(new THREE.CylinderGeometry(1.25, 1.25, 0.16, 16), MAT.donker, 0, 0.66, 0));

    g.add(deel(new THREE.CylinderGeometry(0.95, 0.95, 2.2, 18), MAT.romp, 0, 1.84, 0));
    g.add(deel(new THREE.SphereGeometry(0.95, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), MAT.romp, 0, 2.94, 0));
    const onder = deel(new THREE.SphereGeometry(0.95, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), MAT.romp, 0, 0.74, 0);
    onder.rotation.x = Math.PI;
    g.add(onder);

    [1.25, 2.45].forEach(function (y) {
      const t = deel(new THREE.TorusGeometry(0.97, 0.06, 8, 24), MAT.oranje, 0, y, 0);
      t.rotation.x = -Math.PI / 2;
      g.add(t);
    });

    // leiding naar buiten
    const pijp = deel(new THREE.CylinderGeometry(0.13, 0.13, 1.5, 10), MAT.staal, 0, 0.5, 1.3);
    pijp.rotation.x = Math.PI / 2;
    g.add(pijp);
    g.add(deel(new THREE.BoxGeometry(0.5, 0.5, 0.4), MAT.donker, 0, 0.45, 2.1));

    // peilglas: een staafje dat met de vulling meegroeit
    const achter = deel(new THREE.BoxGeometry(0.30, 1.9, 0.10), MAT.donker, 0, 1.85, 0.96);
    g.add(achter);
    const meterGeo = new THREE.BoxGeometry(0.20, 1.8, 0.10);
    meterGeo.translate(0, 0.9, 0);                       // groeit vanaf de onderkant
    const meter = deel(meterGeo, MAT.lamp, 0, 0.92, 1.00);
    meter.scale.y = 0.001;
    g.add(meter);

    g.add(deel(new THREE.SphereGeometry(0.10, 8, 6), MAT.lamp, 0, 3.05, 0));

    g.userData.refs = { meter: meter };
    return g;
  }

  // ------------------------------------------------------------ kweekkas

  function bouwKweekkas() {
    const g = new THREE.Group();

    g.add(deel(new THREE.BoxGeometry(3.7, 0.3, 2.5), MAT.donker, 0, 0.15, 0));
    g.add(deel(new THREE.BoxGeometry(3.4, 0.14, 2.2), MAT.aarde, 0, 0.33, 0));

    // glazen tongewelf
    const kap = deel(new THREE.CylinderGeometry(1.2, 1.2, 3.4, 18, 1, false, 0, Math.PI),
      MAT.glas, 0, 0.30, 0);
    kap.rotation.z = Math.PI / 2;
    g.add(kap);

    // ribben over de kap
    [-1.2, 0, 1.2].forEach(function (x) {
      const rib = deel(new THREE.TorusGeometry(1.2, 0.045, 6, 20, Math.PI), MAT.staal, x, 0.30, 0);
      rib.rotation.y = Math.PI / 2;
      g.add(rib);
    });

    // gewasrijen die groeien
    const rijen = [];
    [-0.68, 0, 0.68].forEach(function (z) {
      const geo = new THREE.BoxGeometry(2.9, 0.5, 0.4);
      geo.translate(0, 0.25, 0);
      const rij = deel(geo, MAT.gewas, 0, 0.40, z);
      rij.scale.y = 0.15;
      rijen.push(rij);
      g.add(rij);
    });

    // kweeklampen onder de nok
    [-0.8, 0.8].forEach(function (x) {
      g.add(deel(new THREE.BoxGeometry(1.3, 0.07, 0.14), MAT.kweeklamp, x, 1.28, 0));
    });

    g.userData.refs = { rijen: rijen };
    return g;
  }

  // --------------------------------------------------------- zonnepaneel

  function bouwZonnepaneel() {
    const g = new THREE.Group();

    g.add(deel(new THREE.CylinderGeometry(0.38, 0.5, 0.26, 10), MAT.donker, 0, 0.13, 0));
    g.add(deel(new THREE.CylinderGeometry(0.10, 0.10, 1.1, 8), MAT.staal, 0, 0.7, 0));

    const arm = new THREE.Group();
    arm.position.y = 1.25;
    arm.rotation.x = -0.55;
    arm.add(deel(new THREE.BoxGeometry(2.8, 0.09, 1.6), MAT.paneel, 0, 0, 0));
    for (let i = -1; i <= 1; i++) {
      arm.add(deel(new THREE.BoxGeometry(0.05, 0.11, 1.6), MAT.staal, i * 0.7, 0, 0));
    }
    arm.add(deel(new THREE.BoxGeometry(2.9, 0.05, 0.06), MAT.staal, 0, 0, 0.8));
    arm.add(deel(new THREE.BoxGeometry(2.9, 0.05, 0.06), MAT.staal, 0, 0, -0.8));
    g.add(arm);

    g.userData.refs = { arm: arm };
    return g;
  }

  // ------------------------------------------------------------ definities

  const DEFS = {
    launchpad: {
      naam: 'Lanceerplatform',
      glyph: '▲',
      kosten: 160,
      omschrijving: 'Stuurt vracht naar de baan om de aarde. Elke lancering kost 60 brandstof en levert krediet op.',
      stroom: -0.3,
      bouw: bouwLanceerplatform
    },
    habitat: {
      naam: 'Woonmodule',
      glyph: '⌂',
      kosten: 110,
      omschrijving: 'Onderdak voor vier kolonisten. De kleine reactor levert wat basisstroom, dag en nacht.',
      stroom: 0.9,
      woonruimte: 4,
      bouw: bouwWoonmodule
    },
    fueltank: {
      naam: 'Brandstoftank',
      glyph: '⬤',
      kosten: 90,
      omschrijving: 'Wint brandstof uit het regoliet en slaat 100 eenheden op. Slurpt stroom.',
      stroom: -1.3,
      brandstof: 0.8,
      brandstofOpslag: 100,
      bouw: bouwBrandstoftank
    },
    farm: {
      naam: 'Kweekkas',
      glyph: '❋',
      kosten: 70,
      omschrijving: 'Verbouwt voedsel onder kweeklampen. Zonder stroom groeit er niets.',
      stroom: -0.9,
      voedsel: 0.6,
      voedselOpslag: 40,
      bouw: bouwKweekkas
    },
    solar: {
      naam: 'Zonnepaneel',
      glyph: '◫',
      kosten: 40,
      omschrijving: 'Levert stroom zolang de zon op de basis schijnt, en vergroot de accu.',
      opwekking: 3.6,
      accu: 60,
      bouw: bouwZonnepaneel
    }
  };

  MB.Buildings = {
    MAT: MAT,
    DEFS: DEFS,
    volgorde: ['solar', 'farm', 'fueltank', 'habitat', 'launchpad'],
    maak: function (type) {
      const def = DEFS[type];
      const g = def.bouw();
      g.userData.type = type;
      return g;
    }
  };
})(window.MB);
