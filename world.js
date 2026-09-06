/* Renderer, camera, licht en de achtergrond: sterren, de zon en de aarde die
   laag boven de horizon hangt. De maan en alles wat erop staat zitten in één
   groep (planeet), zodat die als geheel kan draaien. */

(function (MB) {
  'use strict';
  if (!window.THREE) return;

  const ZON = new THREE.Vector3(0.72, 0.30, 0.62).normalize();

  function sterren() {
    const n = 1800;
    const pos = new Float32Array(n * 3);
    const kleuren = new Float32Array(n * 3);
    const rnd = MB.rng(9931);
    const c = new THREE.Color();

    for (let i = 0; i < n; i++) {
      const z = rnd() * 2 - 1;
      const phi = rnd() * Math.PI * 2;
      const s = Math.sqrt(1 - z * z);
      const r = 900;
      pos[i * 3] = s * Math.cos(phi) * r;
      pos[i * 3 + 1] = z * r;
      pos[i * 3 + 2] = s * Math.sin(phi) * r;

      const warm = rnd();
      c.setHSL(warm < 0.75 ? 0.58 : 0.08, 0.35, 0.55 + rnd() * 0.45);
      kleuren[i * 3] = c.r;
      kleuren[i * 3 + 1] = c.g;
      kleuren[i * 3 + 2] = c.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(kleuren, 3));
    return new THREE.Points(geo, new THREE.PointsMaterial({
      size: 1.7, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.95
    }));
  }

  function aarde() {
    const g = new THREE.Group();
    const straal = 20;
    const geo = new THREE.SphereGeometry(straal, 40, 28);
    const pos = geo.attributes.position;
    const kleuren = new Float32Array(pos.count * 3);
    const v = new THREE.Vector3();
    const oceaan = new THREE.Color(0x1c4f96);
    const land = new THREE.Color(0x3f7a44);
    const wolk = new THREE.Color(0xeef4f8);
    const c = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).normalize();
      const n =
        Math.sin(v.x * 3.1 + 0.7) * Math.sin(v.y * 2.6 + 1.9) * Math.sin(v.z * 3.4 + 0.3) +
        0.5 * Math.sin(v.x * 6.3 + 2.2) * Math.sin(v.y * 5.8 + 0.4) * Math.sin(v.z * 6.9 + 1.1);
      c.copy(n > 0.10 ? land : oceaan);
      const w = Math.sin(v.x * 9.2 + v.y * 4.1) * Math.sin(v.z * 8.3 - v.y * 5.5);
      if (w > 0.55) c.lerp(wolk, MB.smoothstep(0.55, 0.9, w) * 0.85);
      if (Math.abs(v.y) > 0.86) c.lerp(wolk, MB.smoothstep(0.86, 0.97, Math.abs(v.y)));
      kleuren[i * 3] = c.r;
      kleuren[i * 3 + 1] = c.g;
      kleuren[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(kleuren, 3));

    g.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.9, metalness: 0.0
    })));
    g.add(new THREE.Mesh(
      new THREE.SphereGeometry(straal * 1.06, 32, 20),
      new THREE.MeshBasicMaterial({ color: 0x6fb2ff, transparent: true, opacity: 0.10, side: THREE.BackSide })
    ));

    g.position.set(-330, 150, -260);
    return g;
  }

  function zonBol() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.SphereGeometry(16, 20, 14),
      new THREE.MeshBasicMaterial({ color: 0xfff6e2 })));
    g.add(new THREE.Mesh(new THREE.SphereGeometry(30, 20, 14),
      new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.18, side: THREE.BackSide })));
    g.position.copy(ZON).multiplyScalar(820);
    return g;
  }

  MB.World = {
    ZON: ZON,

    init: function (canvas) {
      const renderer = new THREE.WebGLRenderer({
        canvas: canvas, antialias: true, powerPreference: 'high-performance'
      });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.95;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x04060c);

      const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 3000);
      camera.position.set(0, 22, 52);

      const zon = new THREE.DirectionalLight(0xfff3e4, 1.55);
      zon.position.copy(ZON).multiplyScalar(400);
      scene.add(zon);

      // zwak blauw bijlicht, zodat de nachtzijde niet pikzwart is
      const bij = new THREE.DirectionalLight(0x6f9dd8, 0.28);
      bij.position.set(-330, 150, -260);
      scene.add(bij);
      scene.add(new THREE.AmbientLight(0x2b3550, 0.40));

      scene.add(sterren());
      scene.add(aarde());
      scene.add(zonBol());

      const planeet = new THREE.Group();
      scene.add(planeet);

      function resize() {
        const w = window.innerWidth, h = window.innerHeight;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
      window.addEventListener('resize', resize);
      resize();

      return {
        renderer: renderer,
        scene: scene,
        camera: camera,
        planeet: planeet,
        render: function () { renderer.render(scene, camera); }
      };
    }
  };
})(window.MB);
