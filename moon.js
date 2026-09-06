/* De maan zelf: een bol van driehoeken die per hoekpunt omhoog of omlaag wordt
   geduwd. Kraters zijn kommen met een opstaande rand; rond de basis ligt een
   vlakke laagvlakte, zodat de modules netjes op de grond staan. */

(function (MB) {
  'use strict';
  if (!window.THREE) return;

  const R = 20;                   // straal van de maan
  const DETAIL = 32;              // 20 * (32+1)^2 ≈ 21.800 driehoeken
  const PLAIN = 0.56;             // hoekstraal van de vlakte (radialen) -> ~11.2 eenheden
  const BASE_DIR = new THREE.Vector3(0.18, 0.86, 0.48).normalize();

  // ------------------------------------------------------------- kraters

  const kraters = [];
  (function maakKraters() {
    const rnd = MB.rng(20240607);
    let pogingen = 0;
    while (kraters.length < 26 && pogingen < 400) {
      pogingen++;
      // gelijkmatig verdeeld punt op de bol
      const z = rnd() * 2 - 1;
      const phi = rnd() * Math.PI * 2;
      const s = Math.sqrt(1 - z * z);
      const dir = new THREE.Vector3(s * Math.cos(phi), z, s * Math.sin(phi));

      if (dir.dot(BASE_DIR) > Math.cos(PLAIN * 1.1)) continue;   // niet bovenop de basis

      const straal = 0.09 + rnd() * rnd() * 0.24;                // veel kleine, weinig grote
      const diepte = (0.5 + rnd() * 0.9) * straal * 9;
      kraters.push({ dir: dir, r: straal, d: diepte });
    }
  })();

  // Zachte deuken en bulten over het hele oppervlak.
  function bulten(d) {
    return (
      0.32 * Math.sin(d.x * 7.3 + 1.3) * Math.sin(d.y * 6.9 + 2.1) * Math.sin(d.z * 7.7 + 0.7) +
      0.16 * Math.sin(d.x * 16.1 + 4.1) * Math.sin(d.y * 15.3 + 1.7) * Math.sin(d.z * 17.2 + 3.3) +
      0.07 * Math.sin(d.x * 33.0 + 0.4) * Math.sin(d.y * 31.5 + 5.2) * Math.sin(d.z * 29.8 + 2.6)
    );
  }

  /* Hoogte (afstand tot het middelpunt) voor een genormaliseerde richting. */
  function hoogteBij(d) {
    let h = R + bulten(d) * 0.9;

    for (let i = 0; i < kraters.length; i++) {
      const k = kraters[i];
      const hoek = Math.acos(MB.clamp(d.dot(k.dir), -1, 1));
      if (hoek > k.r * 1.5) continue;
      const t = hoek / k.r;
      if (t < 1) h -= k.d * (1 - t * t) * 0.75;          // de kom
      const rim = (t - 0.82) / 0.62;                      // de opstaande rand
      if (rim > 0 && rim < 1) h += k.d * 0.40 * Math.sin(rim * Math.PI);
    }

    // Rond de basis alles platstrijken tot precies R.
    const vanBasis = Math.acos(MB.clamp(d.dot(BASE_DIR), -1, 1));
    const vlak = 1 - MB.smoothstep(PLAIN, PLAIN * 1.22, vanBasis);
    return MB.lerp(h, R, vlak);
  }

  // ---------------------------------------------------- tangentieel stelsel

  // Twee assen die loodrecht op BASE_DIR staan: het "papier" waarop de basis ligt.
  const TAN_U = new THREE.Vector3(0, 1, 0).cross(BASE_DIR).normalize();
  const TAN_V = new THREE.Vector3().crossVectors(BASE_DIR, TAN_U).normalize();

  /* Richting op de bol, u en v eenheden van het middelpunt van de basis vandaan
     (gemeten langs het oppervlak). */
  function richtingUitOffset(u, v) {
    const off = new THREE.Vector3()
      .addScaledVector(TAN_U, u)
      .addScaledVector(TAN_V, v);
    const len = off.length();
    if (len < 1e-6) return BASE_DIR.clone();
    const hoek = len / R;
    return BASE_DIR.clone()
      .multiplyScalar(Math.cos(hoek))
      .addScaledVector(off.multiplyScalar(1 / len), Math.sin(hoek))
      .normalize();
  }

  function puntOpOppervlak(dir) {
    return dir.clone().multiplyScalar(hoogteBij(dir));
  }

  /* Draaiing zodat +Y van een module langs de normaal wijst en +Z naar het
     midden van de basis kijkt. */
  function orientatie(dir) {
    const up = dir.clone();
    let fwd = BASE_DIR.clone().addScaledVector(up, -BASE_DIR.dot(up));
    if (fwd.lengthSq() < 1e-8) fwd = TAN_U.clone();   // precies in het midden
    fwd.normalize();

    const x = new THREE.Vector3().crossVectors(up, fwd).normalize();
    const z = new THREE.Vector3().crossVectors(x, up).normalize();
    const m = new THREE.Matrix4().makeBasis(x, up, z);
    return new THREE.Quaternion().setFromRotationMatrix(m);
  }

  // ------------------------------------------------------------- opbouwen

  function bouwMesh() {
    const geo = new THREE.IcosahedronGeometry(R, DETAIL);
    const pos = geo.attributes.position;
    const v = new THREE.Vector3();

    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).normalize();
      const h = hoogteBij(v);
      pos.setXYZ(i, v.x * h, v.y * h, v.z * h);
    }

    // Kleur per driehoek: dieper = donkerder, randen lichter, plus wat spikkel.
    const kleuren = new Float32Array(pos.count * 3);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    const donker = new THREE.Color(0x33343c);
    const licht = new THREE.Color(0x9a938a);
    const vlakteKleur = new THREE.Color(0x6e6659);
    const kleur = new THREE.Color();

    for (let f = 0; f < pos.count / 3; f++) {
      a.fromBufferAttribute(pos, f * 3);
      b.fromBufferAttribute(pos, f * 3 + 1);
      c.fromBufferAttribute(pos, f * 3 + 2);
      const mid = a.clone().add(b).add(c).multiplyScalar(1 / 3);
      const straal = mid.length();
      const dir = mid.clone().normalize();

      let t = MB.clamp(0.5 + (straal - R) * 0.42, 0, 1);
      t = MB.clamp(t + (MB.hash(f * 0.731) - 0.5) * 0.14, 0, 1);
      kleur.copy(donker).lerp(licht, t);

      // De laagvlakte krijgt een warmere, vertrapte tint.
      const vanBasis = Math.acos(MB.clamp(dir.dot(BASE_DIR), -1, 1));
      const vlak = 1 - MB.smoothstep(PLAIN * 0.7, PLAIN * 1.4, vanBasis);
      if (vlak > 0) kleur.lerp(vlakteKleur, vlak * 0.75);

      for (let k = 0; k < 3; k++) {
        kleuren[(f * 3 + k) * 3 + 0] = kleur.r;
        kleuren[(f * 3 + k) * 3 + 1] = kleur.g;
        kleuren[(f * 3 + k) * 3 + 2] = kleur.b;
      }
    }

    geo.setAttribute('color', new THREE.BufferAttribute(kleuren, 3));
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 1.0,
      metalness: 0.0
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'maan';
    return mesh;
  }

  MB.Moon = {
    R: R,
    BASE_DIR: BASE_DIR,
    hoogteBij: hoogteBij,
    richtingUitOffset: richtingUitOffset,
    puntOpOppervlak: puntOpOppervlak,
    orientatie: orientatie,
    bouwMesh: bouwMesh
  };
})(window.MB);
