/* Het spel: de bouwplekken op de laagvlakte, de huishouding van stroom,
   voedsel, brandstof en krediet, en alles wat de speler kan aanklikken. */

(function (MB) {
  'use strict';
  if (!window.THREE) return;

  const Moon = MB.Moon;
  const Bouw = MB.Buildings;
  const DEFS = Bouw.DEFS;

  const DRAAI = 0.045;          // radialen per seconde: een etmaal duurt ~140 s
  const ETEN = 0.16;            // voedsel per kolonist per seconde
  const LANCEERPRIJS = 60;      // brandstof per vracht
  // Meer kolonisten = meer handen om te laden, dus een grotere vracht.
  const winst = (kolonisten) => 40 + 12 * kolonisten;

  // Negentien plekken: één in het midden, een binnenring en een buitenring.
  const SLOTS = [{ u: 0, v: 0 }];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    SLOTS.push({ u: Math.cos(a) * 5.9, v: Math.sin(a) * 5.9 });
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + Math.PI / 12;
    SLOTS.push({ u: Math.cos(a) * 10.3, v: Math.sin(a) * 10.3 });
  }

  const START = [
    [0, 'habitat'], [1, 'launchpad'], [2, 'solar'],
    [3, 'fueltank'], [4, 'farm'], [6, 'solar']
  ];

  MB.maakSpel = function (wereld, controls) {
    const planeet = wereld.planeet;
    const bouwwerken = [];
    const markers = [];

    const S = {
      naam: 'Basis Alfa',
      krediet: 80,
      stroom: 120,
      voedsel: 30,
      brandstof: 0,
      kolonisten: 3,
      zon: 1,
      tekort: 1,          // 0..1, hoeveel van de vraag er gedekt wordt
      draait: true,
      volgen: true,
      groeiKlok: 0,
      hongerKlok: 0,
      tijd: 0
    };

    let bouwModus = null;
    let gekozen = null;
    let zweefSlot = null;
    let hudKlok = 0;

    // ------------------------------------------------------------ plekken

    const markerMat = new THREE.MeshBasicMaterial({
      color: 0x62d8ff, transparent: true, opacity: 0.55, side: THREE.DoubleSide
    });
    const markerVlakMat = new THREE.MeshBasicMaterial({
      color: 0x62d8ff, transparent: true, opacity: 0.12, side: THREE.DoubleSide
    });

    SLOTS.forEach(function (slot, i) {
      const dir = Moon.richtingUitOffset(slot.u, slot.v);
      const g = new THREE.Group();
      g.position.copy(dir).multiplyScalar(Moon.hoogteBij(dir) + 0.02);
      g.quaternion.copy(Moon.orientatie(dir));

      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.07, 6, 28), markerMat);
      ring.rotation.x = -Math.PI / 2;
      const vlak = new THREE.Mesh(new THREE.CircleGeometry(2.25, 28), markerVlakMat);
      vlak.rotation.x = -Math.PI / 2;
      g.add(ring, vlak);
      g.visible = false;

      planeet.add(g);
      slot.index = i;
      slot.groep = g;
      slot.raakvlak = vlak;
      vlak.userData.slot = slot;
      markers.push(g);
    });

    const keuzering = new THREE.Mesh(
      new THREE.TorusGeometry(2.5, 0.07, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0xff8b45 })
    );
    keuzering.rotation.x = -Math.PI / 2;
    keuzering.position.y = 0.08;

    // ---------------------------------------------------------- draaipunt

    /* Een leeg object dat als draaipunt dienstdoet wanneer je het wieltje op de
       kale maan indrukt; het hangt in de planeetgroep en draait dus mee. */
    const losDraaipunt = new THREE.Object3D();
    planeet.add(losDraaipunt);

    const draaimerk = new THREE.Group();
    (function () {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xff8b45, transparent: true, opacity: 0.7, depthTest: false
      });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.05, 6, 24), mat);
      ring.rotation.x = -Math.PI / 2;
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.4, 6), mat);
      pin.position.y = 0.7;
      draaimerk.add(ring, pin);
      // altijd zichtbaar, en het mag geen klikken opvangen
      draaimerk.traverse(function (o) {
        o.renderOrder = 5;
        o.raycast = function () {};
      });
    })();

    function zetDraaipunt(obj) {
      controls.zetAnker(obj);
      if (draaimerk.parent) draaimerk.parent.remove(draaimerk);
      if (obj) {
        draaimerk.scale.setScalar(obj.userData.kolonist ? 0.45 : 1);
        obj.add(draaimerk);
      }
    }

    // --------------------------------------------------------- kolonisten

    const volk = MB.Kolonisten.maak(planeet);

    // de poppetjes lopen van module naar module; dit is hun lijstje bezienswaardigheden
    function verversLoopdoelen() {
      volk.doelen = SLOTS.filter((s) => s.bezet).map((s) => ({ u: s.u, v: s.v }));
    }

    // ---------------------------------------------------------- bouwwerken

    function zetNeer(type, slot) {
      const dir = Moon.richtingUitOffset(slot.u, slot.v);
      const g = Bouw.maak(type);
      g.position.copy(dir).multiplyScalar(Moon.hoogteBij(dir));
      g.quaternion.copy(Moon.orientatie(dir));
      planeet.add(g);

      const b = {
        type: type,
        def: DEFS[type],
        slot: slot,
        groep: g,
        refs: g.userData.refs || {},
        groei: 0.1,
        lanceert: false,
        lanceerT: 0,
        beloond: false,
        herbouw: 0
      };
      g.userData.bouwwerk = b;
      slot.bezet = b;
      bouwwerken.push(b);
      verversLoopdoelen();
      return b;
    }

    function sloop(b) {
      if (b.type === 'habitat' && tel('habitat') <= 1) {
        melding('De laatste woonmodule kun je niet slopen.', 'slecht');
        return;
      }
      if (controls.ankerObject && isDeelVan(controls.ankerObject, b.groep)) zetDraaipunt(null);
      planeet.remove(b.groep);
      b.slot.bezet = null;
      bouwwerken.splice(bouwwerken.indexOf(b), 1);
      verversLoopdoelen();
      S.krediet += Math.round(b.def.kosten * 0.5);
      if (gekozen === b) kies(null);
      melding(b.def.naam + ' gesloopt — ' + Math.round(b.def.kosten * 0.5) + ' krediet terug');
    }

    function tel(type) {
      let n = 0;
      for (let i = 0; i < bouwwerken.length; i++) if (bouwwerken[i].type === type) n++;
      return n;
    }

    START.forEach((s) => zetNeer(s[1], SLOTS[s[0]]));

    // ------------------------------------------------------------ rekenen

    function totalen() {
      const t = {
        opwek: 0, vraag: 0, voedsel: 0, brandstof: 0,
        woonruimte: 0, accu: 90, voedselCap: 40, brandstofCap: 0
      };
      for (let i = 0; i < bouwwerken.length; i++) {
        const d = bouwwerken[i].def;
        if (d.opwekking) t.opwek += d.opwekking * S.zon;
        if (d.stroom > 0) t.opwek += d.stroom;
        if (d.stroom < 0) t.vraag += -d.stroom;
        if (d.accu) t.accu += d.accu;
        if (d.woonruimte) t.woonruimte += d.woonruimte;
        if (d.voedsel) t.voedsel += d.voedsel;
        if (d.voedselOpslag) t.voedselCap += d.voedselOpslag;
        if (d.brandstof) t.brandstof += d.brandstof;
        if (d.brandstofOpslag) t.brandstofCap += d.brandstofOpslag;
      }
      return t;
    }

    function simuleer(dt) {
      const basisRichting = Moon.BASE_DIR.clone().applyQuaternion(planeet.quaternion);
      S.zon = MB.clamp(basisRichting.dot(MB.World.ZON), 0, 1);

      const t = totalen();
      S.tot = t;

      // Stroom: wat er beschikbaar is bepaalt hoe hard de verbruikers draaien.
      const beschikbaar = t.opwek * dt + S.stroom;
      const gevraagd = t.vraag * dt;
      S.tekort = gevraagd > 1e-6 ? MB.clamp(beschikbaar / gevraagd, 0, 1) : 1;
      S.stroom = MB.clamp(S.stroom + (t.opwek - t.vraag * S.tekort) * dt, 0, t.accu);

      S.voedsel = MB.clamp(
        S.voedsel + (t.voedsel * S.tekort - ETEN * S.kolonisten) * dt, 0, t.voedselCap);
      S.brandstof = MB.clamp(S.brandstof + t.brandstof * S.tekort * dt, 0, t.brandstofCap);

      // Bevolking
      if (S.voedsel > t.voedselCap * 0.55 && S.kolonisten < t.woonruimte) {
        S.groeiKlok += dt;
        if (S.groeiKlok > 40) {
          S.groeiKlok = 0;
          S.kolonisten++;
          melding('Er is een kolonist bijgekomen — nu ' + S.kolonisten, 'goed');
        }
      } else {
        S.groeiKlok = Math.max(0, S.groeiKlok - dt * 0.5);
      }

      if (S.voedsel <= 0 && S.kolonisten > 1) {
        S.hongerKlok += dt;
        if (S.hongerKlok > 25) {
          S.hongerKlok = 0;
          S.kolonisten--;
          melding('Voedsel op: een kolonist is vertrokken', 'slecht');
        }
      } else {
        S.hongerKlok = 0;
      }
    }

    // ------------------------------------------------------ animatie

    const UP = new THREE.Vector3(0, 1, 0);
    const hulpQ = new THREE.Quaternion();
    const hulpV = new THREE.Vector3();
    const doelQ = new THREE.Quaternion();

    function animeer(dt) {
      Bouw.MAT.lamp.emissiveIntensity = 1.0 + Math.sin(S.tijd * 3.2) * 0.45;

      for (let i = 0; i < bouwwerken.length; i++) {
        const b = bouwwerken[i];

        if (b.type === 'solar' && b.refs.arm) {
          // panelen volgen de zon en blijven staan zodra die onder gaat
          b.groep.getWorldQuaternion(hulpQ);
          hulpV.copy(MB.World.ZON).applyQuaternion(hulpQ.invert());
          if (hulpV.y > 0.10) {
            doelQ.setFromUnitVectors(UP, hulpV);
            b.refs.arm.quaternion.slerp(doelQ, Math.min(1, dt * 1.5));
          }
        }

        if (b.type === 'farm' && b.refs.rijen) {
          b.groei += (S.tekort * dt) / 14;
          if (b.groei >= 1) b.groei = 0.06;
          const h = 0.15 + b.groei * 0.95;
          for (let k = 0; k < b.refs.rijen.length; k++) b.refs.rijen[k].scale.y = h;
        }

        if (b.type === 'fueltank' && b.refs.meter) {
          const cap = S.tot ? S.tot.brandstofCap : 1;
          b.refs.meter.scale.y = Math.max(0.001, cap > 0 ? S.brandstof / cap : 0);
        }

        if (b.type === 'launchpad') animeerRaket(b, dt);
      }
    }

    function animeerRaket(b, dt) {
      const r = b.refs.raket, v = b.refs.vlam;
      if (!r) return;

      if (b.lanceert) {
        b.lanceerT += dt;
        const t = b.lanceerT;
        r.position.y = 0.48 + 2.6 * t * t;
        r.rotation.z = -0.012 * t * t;
        v.visible = true;
        v.scale.set(1 + Math.sin(t * 47) * 0.12, 1 + Math.sin(t * 31) * 0.3, 1 + Math.sin(t * 53) * 0.12);

        if (!b.beloond && r.position.y > 26) {
          b.beloond = true;
          const w = winst(S.kolonisten);
          S.krediet += w;
          melding('Vracht in de baan — ' + w + ' krediet', 'goed');
        }
        if (r.position.y > 110) {
          b.lanceert = false;
          b.herbouw = 12;
          r.visible = false;
          v.visible = false;
          // wie de raket volgde blijft anders in het niets hangen
          if (controls.ankerObject === r) zetDraaipunt(b.groep);
        }
      } else if (b.herbouw > 0) {
        b.herbouw -= dt;
        if (b.herbouw <= 0) {
          b.herbouw = 0;
          r.position.y = 0.48;
          r.rotation.z = 0;
          r.visible = true;
          melding('Er staat een nieuwe raket op het platform');
        }
      }
    }

    function lanceer(b) {
      if (b.lanceert || b.herbouw > 0) return;
      if (S.brandstof < LANCEERPRIJS) { melding('Te weinig brandstof voor een lancering', 'slecht'); return; }
      if (S.kolonisten < 2) { melding('Je hebt minstens twee kolonisten nodig om te lanceren', 'slecht'); return; }
      S.brandstof -= LANCEERPRIJS;
      b.lanceert = true;
      b.lanceerT = 0;
      b.beloond = false;
      melding('Ontsteking…');
      toonPaneel();
    }

    // ---------------------------------------------------------------- HUD

    const el = {
      krediet: MB.$('#v-credits'), crew: MB.$('#v-crew'),
      stroom: MB.$('#v-power'), voedsel: MB.$('#v-food'), brandstof: MB.$('#v-fuel'),
      bStroom: MB.$('#bar-power'), bVoedsel: MB.$('#bar-food'), bBrandstof: MB.$('#bar-fuel'),
      rStroom: MB.$('#r-power'), rVoedsel: MB.$('#r-food'), rBrandstof: MB.$('#r-fuel'),
      paneel: MB.$('#panel'), pNaam: MB.$('#p-name'), pDesc: MB.$('#p-desc'),
      pStats: MB.$('#p-stats'), pActies: MB.$('#p-actions'),
      knoppen: MB.$('#build-buttons'), hint: MB.$('#build-hint'),
      toast: MB.$('#toast'), canvas: MB.$('#scene')
    };

    function tarief(node, waarde) {
      node.textContent = MB.tekens(waarde) + '/s';
      node.className = 'rate' + (waarde < -0.01 ? ' min' : waarde > 0.01 ? ' plus' : '');
    }

    function verversHud() {
      const t = S.tot || totalen();
      el.krediet.textContent = Math.round(S.krediet);
      el.crew.textContent = S.kolonisten + '/' + t.woonruimte;

      el.stroom.textContent = Math.round(S.stroom) + '/' + Math.round(t.accu);
      el.bStroom.style.width = (S.stroom / t.accu) * 100 + '%';
      tarief(el.rStroom, t.opwek - t.vraag * S.tekort);
      el.rStroom.textContent += S.zon > 0.05 ? ' ☀' : ' ☾';

      el.voedsel.textContent = Math.round(S.voedsel) + '/' + Math.round(t.voedselCap);
      el.bVoedsel.style.width = (S.voedsel / Math.max(1, t.voedselCap)) * 100 + '%';
      tarief(el.rVoedsel, t.voedsel * S.tekort - ETEN * S.kolonisten);

      el.brandstof.textContent = Math.round(S.brandstof) + '/' + Math.round(t.brandstofCap);
      el.bBrandstof.style.width = (S.brandstof / Math.max(1, t.brandstofCap)) * 100 + '%';
      tarief(el.rBrandstof, t.brandstof * S.tekort);

      for (const knop of el.knoppen.children) {
        knop.disabled = S.krediet < DEFS[knop.dataset.type].kosten;
      }
      if (gekozen) toonPaneel();
    }

    let toastKlok = 0;
    function melding(tekst, soort) {
      el.toast.textContent = tekst;
      el.toast.className = 'zien' + (soort ? ' ' + soort : '');
      toastKlok = 3.2;
    }

    // ------------------------------------------------------------- paneel

    function regel(naam, waarde, waarschuwing) {
      return '<li' + (waarschuwing ? ' class="waarschuwing"' : '') + '><span>' + naam +
        '</span><span>' + waarde + '</span></li>';
    }

    function toonPaneel() {
      if (!gekozen) { el.paneel.hidden = true; return; }
      const b = gekozen, d = b.def;
      el.paneel.hidden = false;
      el.pNaam.textContent = d.naam;
      el.pDesc.textContent = d.omschrijving;

      const geenStroom = S.tekort < 0.99;
      let r = '';
      if (d.stroom) r += regel('Stroom', MB.tekens(d.stroom) + '/s');
      if (d.opwekking) r += regel('Opwekking', MB.tekens(d.opwekking * S.zon) + '/s') +
        regel('Zon', S.zon > 0.05 ? Math.round(S.zon * 100) + '%' : 'nacht', S.zon <= 0.05) +
        regel('Accu', '+' + d.accu);
      if (d.woonruimte) r += regel('Woonruimte', d.woonruimte + ' kolonisten');
      if (d.voedsel) r += regel('Oogst', MB.tekens(d.voedsel * S.tekort) + '/s', geenStroom) +
        regel('Groei', Math.round(b.groei * 100) + '%');
      if (d.brandstof) r += regel('Winning', MB.tekens(d.brandstof * S.tekort) + '/s', geenStroom) +
        regel('Opslag', d.brandstofOpslag);
      if (b.type === 'launchpad') {
        r += regel('Brandstof', Math.round(S.brandstof) + '/' + LANCEERPRIJS, S.brandstof < LANCEERPRIJS);
        r += regel('Opbrengst', winst(S.kolonisten) + ' krediet');
        r += regel('Status', b.lanceert ? 'onderweg' :
          b.herbouw > 0 ? 'nieuwe raket over ' + Math.ceil(b.herbouw) + 's' : 'gereed');
      }
      if (geenStroom) r += regel('Stroomtekort', Math.round(S.tekort * 100) + '% vermogen', true);
      el.pStats.innerHTML = r;

      el.pActies.innerHTML = '';
      if (b.type === 'launchpad') {
        const knop = document.createElement('button');
        knop.className = 'actie primair';
        knop.textContent = 'Lanceer vracht (' + LANCEERPRIJS + ' brandstof)';
        knop.disabled = b.lanceert || b.herbouw > 0 || S.brandstof < LANCEERPRIJS || S.kolonisten < 2;
        knop.onclick = () => lanceer(b);
        el.pActies.appendChild(knop);
      }
      const hier = controls.ankerObject === b.groep ||
        (b.refs.raket && controls.ankerObject === b.refs.raket);
      const dr = document.createElement('button');
      dr.className = 'actie';
      dr.textContent = hier ? 'Draai weer om de maan' : 'Camera hieromheen draaien';
      dr.onclick = function () {
        zetDraaipunt(hier ? null : b.groep);
        toonPaneel();
      };
      el.pActies.appendChild(dr);

      const sl = document.createElement('button');
      sl.className = 'actie gevaar';
      sl.textContent = 'Slopen (+' + Math.round(d.kosten * 0.5) + ' krediet)';
      sl.onclick = () => sloop(b);
      el.pActies.appendChild(sl);
    }

    function kies(b) {
      gekozen = b;
      if (b) {
        b.groep.add(keuzering);
        toonPaneel();
      } else {
        if (keuzering.parent) keuzering.parent.remove(keuzering);
        el.paneel.hidden = true;
      }
    }

    // ------------------------------------------------------------- bouwen

    Bouw.volgorde.forEach(function (type) {
      const d = DEFS[type];
      const knop = document.createElement('button');
      knop.className = 'bouwknop';
      knop.dataset.type = type;
      knop.innerHTML = '<span class="glyph">' + d.glyph + '</span><span>' + d.naam +
        '<br><span class="prijs">' + d.kosten + ' krediet</span></span>';
      knop.onclick = () => zetBouwModus(bouwModus === type ? null : type);
      el.knoppen.appendChild(knop);
    });

    function zetBouwModus(type) {
      if (type && S.krediet < DEFS[type].kosten) {
        melding('Te weinig krediet voor een ' + DEFS[type].naam.toLowerCase(), 'slecht');
        return;
      }
      bouwModus = type;
      zweefSlot = null;
      for (const knop of el.knoppen.children) knop.classList.toggle('actief', knop.dataset.type === type);
      el.canvas.classList.toggle('bouwen', !!type);
      el.hint.textContent = type
        ? 'klik een blauwe ring op de maan om de ' + DEFS[type].naam.toLowerCase() + ' te plaatsen (Esc annuleert)'
        : 'klik een module en daarna een vrije plek op de maan';
      SLOTS.forEach((s) => { s.groep.visible = !!type && !s.bezet; });
      if (type) kies(null);
    }

    window.addEventListener('keydown', function (e) {
      if (MB.inVeld(e)) return;                 // Esc sluit dan alleen het naamveld
      if (e.key === 'Escape') {
        zetBouwModus(null);
        kies(null);
        if (controls.ankerObject) zetDraaipunt(null);
      }
    });

    // --------------------------------------------------------- aanwijzen

    const straal = new THREE.Raycaster();
    const pA = new THREE.Vector3(), pB = new THREE.Vector3();

    /* Staat dit ding op de zichtbare helft van de maan? De normaal op een bol is
       de positie zelf, dus dat is één inproduct — goedkoper dan de hele maan
       doorrekenen om te zien of hij ervoor zit. */
    function inZicht(obj) {
      obj.getWorldPosition(pA);
      pB.copy(wereld.camera.position).sub(pA);
      return pA.normalize().dot(pB.normalize()) > -0.02;
    }

    function raakBouwwerk(punt) {
      straal.setFromCamera(punt, wereld.camera);
      const groepen = bouwwerken.filter((b) => inZicht(b.groep)).map((b) => b.groep);
      const hits = straal.intersectObjects(groepen, true);
      for (let i = 0; i < hits.length; i++) {
        let o = hits[i].object;
        while (o) {
          if (o.userData && o.userData.bouwwerk) return o.userData.bouwwerk;
          o = o.parent;
        }
      }
      return null;
    }

    function isDeelVan(obj, ouder) {
      for (let o = obj; o; o = o.parent) if (o === ouder) return true;
      return false;
    }

    /* Waar draaien we omheen als het wieltje hier wordt ingedrukt? Een module,
       de raket erop, een kolonist, of anders het punt op de maan onder de cursor. */
    function raakDraaipunt(punt) {
      straal.setFromCamera(punt, wereld.camera);
      const doelen = bouwwerken.filter((b) => inZicht(b.groep)).map((b) => b.groep);
      const maan = planeet.getObjectByName('maan');
      if (maan) doelen.push(maan);
      volk.leden.forEach((k) => { if (inZicht(k.groep)) doelen.push(k.groep); });

      const hits = straal.intersectObjects(doelen, true);
      if (!hits.length) return null;

      for (let o = hits[0].object; o; o = o.parent) {
        if (o.userData && o.userData.kolonist) return o;
        const b = o.userData && o.userData.bouwwerk;
        if (b) {
          const r = b.refs.raket;
          return r && r.visible && isDeelVan(hits[0].object, r) ? r : b.groep;
        }
      }

      const lokaal = planeet.worldToLocal(hits[0].point.clone());
      losDraaipunt.position.copy(lokaal);
      losDraaipunt.quaternion.copy(Moon.orientatie(lokaal.clone().normalize()));
      return losDraaipunt;
    }

    function raakSlot(punt) {
      straal.setFromCamera(punt, wereld.camera);
      const vlakken = SLOTS.filter((s) => !s.bezet && inZicht(s.groep)).map((s) => s.raakvlak);
      const hits = straal.intersectObjects(vlakken, false);
      return hits.length ? hits[0].object.userData.slot : null;
    }

    controls.opKlik = function (punt) {
      if (bouwModus) {
        const slot = raakSlot(punt);
        if (!slot) return;
        const d = DEFS[bouwModus];
        if (S.krediet < d.kosten) { melding('Te weinig krediet', 'slecht'); return; }
        S.krediet -= d.kosten;
        const b = zetNeer(bouwModus, slot);
        melding(d.naam + ' gebouwd', 'goed');
        zetBouwModus(null);
        kies(b);
        return;
      }
      kies(raakBouwwerk(punt));
    };

    controls.opDraaipunt = function (punt) {
      const doel = raakDraaipunt(punt);
      zetDraaipunt(doel);
      if (doel) {
        const b = doel.userData.bouwwerk;
        melding('Draaipunt: ' + (b ? b.def.naam :
          doel.userData.kolonist ? 'een kolonist' :
          doel === losDraaipunt ? 'plek op de maan' : 'de raket'));
      } else {
        melding('Draaipunt terug naar het midden van de maan');
      }
    };

    controls.opZweef = function (punt) {
      if (bouwModus) {
        const slot = raakSlot(punt);
        if (slot !== zweefSlot) {
          if (zweefSlot) zweefSlot.groep.scale.setScalar(1);
          zweefSlot = slot;
          if (slot) slot.groep.scale.setScalar(1.12);
        }
        return;
      }
      el.canvas.classList.toggle('aanwijzen', !!raakBouwwerk(punt));
    };

    // ------------------------------------------------------- schakelaars

    const knopVolgen = MB.$('#btn-follow');
    const knopDraai = MB.$('#btn-rotate');
    knopVolgen.onclick = function () {
      S.volgen = !S.volgen;
      knopVolgen.classList.toggle('on', S.volgen);
    };
    knopDraai.onclick = function () {
      S.draait = !S.draait;
      knopDraai.classList.toggle('on', S.draait);
    };

    const knopRand = MB.$('#btn-edge');
    knopRand.onclick = function () {
      controls.randScroll = !controls.randScroll;
      knopRand.classList.toggle('on', controls.randScroll);
    };

    // -------------------------------------------------------------- naam

    const STANDAARDNAAM = 'Basis Alfa';
    const elNaam = MB.$('#v-name');

    function zetNaam(naam) {
      S.naam = String(naam == null ? '' : naam).trim().slice(0, 28) || STANDAARDNAAM;
      if (elNaam.value !== S.naam) elNaam.value = S.naam;
      document.title = S.naam + ' — Maanbasis';
    }

    elNaam.onchange = () => zetNaam(elNaam.value);
    elNaam.onblur = () => zetNaam(elNaam.value);
    elNaam.onkeydown = function (e) {
      if (e.key === 'Enter' || e.key === 'Escape') elNaam.blur();
    };
    zetNaam(elNaam.value);

    // ------------------------------------------------------- opslaan/laden

    const SAVE_VERSIE = 1;

    function maakSave() {
      return {
        spel: 'maanbasis',
        versie: SAVE_VERSIE,
        bewaard: new Date().toISOString(),
        naam: S.naam,
        tijd: S.tijd,
        draaiing: planeet.rotation.y,
        krediet: S.krediet,
        stroom: S.stroom,
        voedsel: S.voedsel,
        brandstof: S.brandstof,
        kolonisten: S.kolonisten,
        groeiKlok: S.groeiKlok,
        hongerKlok: S.hongerKlok,
        draait: S.draait,
        volgen: S.volgen,
        randScroll: controls.randScroll,
        bouwwerken: bouwwerken.map(function (b) {
          return {
            type: b.type,
            plek: b.slot.index,
            groei: b.groei,
            lanceert: b.lanceert,
            lanceerT: b.lanceerT,
            beloond: b.beloond,
            herbouw: b.herbouw
          };
        })
      };
    }

    // Poppetjes en cameraplek slaan we niet op; die zoeken hun weg wel weer.
    function laadSave(d) {
      zetBouwModus(null);
      kies(null);
      if (controls.ankerObject) zetDraaipunt(null);

      // alles weghalen, buiten de spelregels om
      for (let i = bouwwerken.length - 1; i >= 0; i--) planeet.remove(bouwwerken[i].groep);
      bouwwerken.length = 0;
      SLOTS.forEach(function (s) { s.bezet = null; });

      const lijst = Array.isArray(d.bouwwerken) ? d.bouwwerken : [];
      lijst.forEach(function (o) {
        const slot = SLOTS[o.plek];
        if (!DEFS[o.type] || !slot || slot.bezet) return;     // rommel overslaan
        const b = zetNeer(o.type, slot);
        b.groei = MB.clamp(cijfer(o.groei, 0.1), 0, 1);
        b.lanceert = !!o.lanceert;
        b.lanceerT = Math.max(0, cijfer(o.lanceerT, 0));
        b.beloond = !!o.beloond;
        b.herbouw = Math.max(0, cijfer(o.herbouw, 0));
        if (b.refs.raket) b.refs.raket.visible = b.herbouw <= 0;
        if (b.refs.vlam) b.refs.vlam.visible = b.lanceert;
      });

      S.tijd = Math.max(0, cijfer(d.tijd, 0));
      S.krediet = Math.max(0, cijfer(d.krediet, 80));
      S.stroom = Math.max(0, cijfer(d.stroom, 120));
      S.voedsel = Math.max(0, cijfer(d.voedsel, 30));
      S.brandstof = Math.max(0, cijfer(d.brandstof, 0));
      S.kolonisten = Math.max(1, Math.round(cijfer(d.kolonisten, 3)));
      S.groeiKlok = Math.max(0, cijfer(d.groeiKlok, 0));
      S.hongerKlok = Math.max(0, cijfer(d.hongerKlok, 0));

      planeet.rotation.y = cijfer(d.draaiing, 0);
      S.draait = d.draait !== false;
      S.volgen = d.volgen !== false;
      controls.randScroll = d.randScroll !== false;
      knopDraai.classList.toggle('on', S.draait);
      knopVolgen.classList.toggle('on', S.volgen);
      knopRand.classList.toggle('on', controls.randScroll);

      zetNaam(d.naam);
      controls.kijkNaar(Moon.BASE_DIR.clone().applyQuaternion(planeet.quaternion));
      S.tot = totalen();                        // meters meteen kloppend tonen
      verversHud();
      melding('“' + S.naam + '” geladen', 'goed');
    }

    function cijfer(v, terug) {
      return typeof v === 'number' && isFinite(v) ? v : terug;
    }

    function bestandsnaam() {
      const kaal = S.naam.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      return (kaal || 'maanbasis') + '.maanbasis.json';
    }

    MB.$('#btn-save').onclick = function () {
      const blob = new Blob([JSON.stringify(maakSave(), null, 1)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = bestandsnaam();
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      melding('Opgeslagen als ' + a.download, 'goed');
    };

    function leesBestand(file) {
      const lezer = new FileReader();
      lezer.onload = function () {
        let d = null;
        try { d = JSON.parse(lezer.result); } catch (e) { d = null; }
        if (!d || d.spel !== 'maanbasis') {
          melding('Dat lijkt geen bewaarde maanbasis', 'slecht');
          return;
        }
        laadSave(d);
      };
      lezer.onerror = () => melding('Het bestand kon niet gelezen worden', 'slecht');
      lezer.readAsText(file);
    }

    const kiezer = MB.$('#file-load');
    MB.$('#btn-load').onclick = () => kiezer.click();
    kiezer.onchange = function () {
      const f = kiezer.files && kiezer.files[0];
      if (f) leesBestand(f);
      kiezer.value = '';                      // hetzelfde bestand mag opnieuw
    };

    // een bewaard spel op het venster slepen werkt ook
    window.addEventListener('dragover', function (e) { e.preventDefault(); });
    window.addEventListener('drop', function (e) {
      e.preventDefault();
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) leesBestand(f);
    });

    const hulp = MB.$('#help');
    MB.$('#btn-help').onclick = () => { hulp.hidden = false; };
    MB.$('#help-close').onclick = () => { hulp.hidden = true; };
    MB.$('#p-close').onclick = () => kies(null);

    // ------------------------------------------------------------- lus

    controls.kijkNaar(Moon.BASE_DIR);
    controls.doelAfstand = 52;
    controls.afstand = 105;

    verversHud();

    return {
      staat: S,                 // debug-ingangen, handig vanuit de console
      bouwwerken: bouwwerken,
      lanceer: lanceer,
      maakSave: maakSave,
      laadSave: laadSave,

      update: function (dt) {
        S.tijd += dt;

        if (S.draait) {
          const d = DRAAI * dt;
          planeet.rotation.y += d;
          if (S.volgen) controls.verschuifTheta(d);
        }

        simuleer(dt);
        animeer(dt);

        volk.zetAantal(S.kolonisten);
        // een vertrokken kolonist kan geen draaipunt meer zijn
        if (controls.ankerObject && controls.ankerObject.userData.kolonist &&
          !controls.ankerObject.parent) zetDraaipunt(null);
        volk.update(dt);

        hudKlok += dt;
        if (hudKlok > 0.12) { hudKlok = 0; verversHud(); }

        if (toastKlok > 0) {
          toastKlok -= dt;
          if (toastKlok <= 0) el.toast.className = '';
        }
      }
    };
  };
})(window.MB);
