/**
 * CityBuilder.js
 * 3D 現代都市地圖生成器：嚴謹劃分建築區塊、道路、人行道與中央運河，確保走道寬敞暢通無穿模阻擋
 */
class CityBuilder {
  constructor(scene) {
    this.scene = scene;
    this.collisionBoxes = [];
    this.lootSpawnPoints = [];
    this.roadSegments = [];
    this.pedestrianPaths = [];
    this.waterMesh = null;
  }

  build() {
    this.createGroundAndRoads();
    this.createCanalAndBridges();
    this.createCityBuildings();
    this.createStreetProps();
    this.createAtmosphere();
  }

  createGroundAndRoads() {
    // 基礎地面
    const groundGeo = new THREE.PlaneGeometry(420, 520);
    const groundMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const roadMat = new THREE.MeshLambertMaterial({ color: 0x0f172a });
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    const zebraMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const sidewalkMat = new THREE.MeshLambertMaterial({ color: 0x475569 });

    // 南北向大道 (X = -62, X = 62, X = -122, X = 122)，車道寬度 14 米
    const mainRoadXs = [-62, 62, -122, 122];
    mainRoadXs.forEach(rx => {
      // 馬路路面
      const road = new THREE.Mesh(new THREE.PlaneGeometry(14, 480), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(rx, 0.02, 0);
      road.receiveShadow = true;
      this.scene.add(road);

      // 車道中央黃色虛線
      for (let z = -230; z <= 230; z += 12) {
        const line = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 6), lineMat);
        line.rotation.x = -Math.PI / 2;
        line.position.set(rx, 0.03, z);
        this.scene.add(line);
      }

      // 人行道 (寬 3.5 米)
      [-8.75, 8.75].forEach(offsetX => {
        const sw = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.2, 480), sidewalkMat);
        sw.position.set(rx + offsetX, 0.1, 0);
        sw.receiveShadow = true;
        this.scene.add(sw);
      });

      this.roadSegments.push({ x: rx, zMin: -230, zMax: 230, dir: 'Z' });
    });

    // 東西向街道 (Z = -140, Z = -70, Z = 0, Z = 70, Z = 140)，寬度 14 米
    const crossRoadZs = [-140, -70, 0, 70, 140];
    crossRoadZs.forEach(rz => {
      const crossRoad = new THREE.Mesh(new THREE.PlaneGeometry(380, 14), roadMat);
      crossRoad.rotation.x = -Math.PI / 2;
      crossRoad.position.set(0, 0.02, rz);
      crossRoad.receiveShadow = true;
      this.scene.add(crossRoad);

      // 斑馬線
      mainRoadXs.forEach(rx => {
        for (let i = -5; i <= 5; i += 1.6) {
          const stripe1 = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 3.5), zebraMat);
          stripe1.rotation.x = -Math.PI / 2;
          stripe1.position.set(rx + i, 0.04, rz - 8.5);
          this.scene.add(stripe1);

          const stripe2 = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 3.5), zebraMat);
          stripe2.rotation.x = -Math.PI / 2;
          stripe2.position.set(rx + i, 0.04, rz + 8.5);
          this.scene.add(stripe2);
        }
      });

      this.roadSegments.push({ z: rz, xMin: -180, xMax: 180, dir: 'X' });
    });
  }

  createCanalAndBridges() {
    // 運河水面 (X: -11 ~ 11, Z: -250 ~ 250)
    const waterGeo = new THREE.PlaneGeometry(22, 490, 20, 30);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.15,
      metalness: 0.8,
      transparent: true,
      opacity: 0.8
    });
    this.waterMesh = new THREE.Mesh(waterGeo, waterMat);
    this.waterMesh.rotation.x = -Math.PI / 2;
    this.waterMesh.position.set(0, 0.1, 0);
    this.scene.add(this.waterMesh);

    // 運河護岸石壁與河畔步道
    const canalWallMat = new THREE.MeshLambertMaterial({ color: 0x334155 });
    const promenadeMat = new THREE.MeshLambertMaterial({ color: 0x64748b });

    [-11.5, 11.5].forEach(xPos => {
      // 堤岸石壁
      const wall = new THREE.Mesh(new THREE.BoxGeometry(1.2, 4.5, 490), canalWallMat);
      wall.position.set(xPos, -1.8, 0);
      wall.receiveShadow = true;
      this.scene.add(wall);

      // 河畔散步大道 (寬 6 米)
      const promX = xPos > 0 ? xPos + 3.8 : xPos - 3.8;
      const prom = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.2, 490), promenadeMat);
      prom.position.set(promX, 0.1, 0);
      prom.receiveShadow = true;
      this.scene.add(prom);
    });

    // 跨河大橋 (連接東西城區)
    const bridgeZs = [-140, -70, 0, 70, 140];
    const bridgeMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
    const archMat = new THREE.MeshLambertMaterial({ color: 0x0284c7 });

    bridgeZs.forEach(bz => {
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(26, 0.8, 14), bridgeMat);
      bridge.position.set(0, 1.5, bz);
      bridge.castShadow = true;
      bridge.receiveShadow = true;
      this.scene.add(bridge);

      [-13, 13].forEach(edgeX => {
        const ramp = new THREE.Mesh(new THREE.BoxGeometry(7, 0.6, 14), bridgeMat);
        ramp.position.set(edgeX + (edgeX > 0 ? 3 : -3), 0.7, bz);
        ramp.rotation.z = (edgeX > 0 ? 0.16 : -0.16);
        this.scene.add(ramp);
      });

      // 裝飾拱門
      const arch = new THREE.Mesh(new THREE.TorusGeometry(7, 0.3, 8, 24, Math.PI), archMat);
      arch.position.set(0, 1.6, bz - 6.5);
      this.scene.add(arch);

      const arch2 = arch.clone();
      arch2.position.set(0, 1.6, bz + 6.5);
      this.scene.add(arch2);

      // 爬梯
      const ladder = new THREE.Mesh(new THREE.BoxGeometry(1.8, 4, 0.3), new THREE.MeshLambertMaterial({ color: 0xf59e0b }));
      ladder.position.set(-10.8, -0.5, bz + 8);
      this.scene.add(ladder);
      this.lootSpawnPoints.push(new THREE.Vector3(-10.5, 0.6, bz + 8));
    });
  }

  createCityBuildings() {
    const buildingColors = [0x1e293b, 0x0f172a, 0x334155, 0x1e1e2f, 0x252a34, 0x182c3c];
    const windowMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const warmWindowMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

    // 嚴格規劃的建築區塊，四周預留充裕人行道空間，絕不佔用馬路
    const blockXRanges = [
      { min: -170, max: -136 },
      { min: -108, max: -76 },
      { min: -48, max: -20 },
      { min: 20, max: 48 },
      { min: 76, max: 108 },
      { min: 136, max: 170 }
    ];

    const blockZRanges = [
      { min: -220, max: -154 },
      { min: -126, max: -84 },
      { min: -56, max: -14 },
      { min: 14, max: 56 },
      { min: 84, max: 126 },
      { min: 154, max: 220 }
    ];

    blockXRanges.forEach((xRange, bxIdx) => {
      blockZRanges.forEach((zRange, bzIdx) => {
        // 建築本體寬度留出 3 米間距走道
        const width = (xRange.max - xRange.min) - 4;
        const depth = (zRange.max - zRange.min) - 4;
        const height = 24 + ((bxIdx * 9 + bzIdx * 17) % 40);
        const centerX = (xRange.min + xRange.max) / 2;
        const centerZ = (zRange.min + zRange.max) / 2;

        const col = buildingColors[(bxIdx + bzIdx) % buildingColors.length];
        const bMat = new THREE.MeshLambertMaterial({ color: col });

        // 主建築體
        const bMesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), bMat);
        bMesh.position.set(centerX, height / 2, centerZ);
        bMesh.castShadow = true;
        bMesh.receiveShadow = true;
        this.scene.add(bMesh);

        // 碰撞箱 (精確吻合建築本體)
        const box = new THREE.Box3().setFromObject(bMesh);
        this.collisionBoxes.push(box);

        // 窗戶
        const winGeo = new THREE.PlaneGeometry(1.2, 1.8);
        for (let wy = 4; wy < height - 3; wy += 5) {
          for (let wx = -width / 2 + 2.5; wx < width / 2 - 2; wx += 4) {
            const isLit = (Math.sin(wx * 8 + wy * 4 + bxIdx) > -0.1);
            if (isLit) {
              const win = new THREE.Mesh(winGeo, (Math.random() > 0.4 ? windowMat : warmWindowMat));
              win.position.set(centerX + wx, wy, centerZ + depth / 2 + 0.05);
              this.scene.add(win);
            }
          }
        }

        // 大樓入口前廳 (可供玩家搜刮避雨)
        const lobby = new THREE.Mesh(new THREE.BoxGeometry(5, 3.2, 2.5), new THREE.MeshLambertMaterial({ color: 0x0284c7 }));
        lobby.position.set(centerX, 1.6, centerZ + depth / 2 + 1.2);
        this.scene.add(lobby);

        // 刷新物資點 (四周寬敞走道上)
        this.lootSpawnPoints.push(new THREE.Vector3(centerX, 0.7, centerZ + depth / 2 + 2.8));
        this.lootSpawnPoints.push(new THREE.Vector3(centerX + width / 2 + 2.0, 0.7, centerZ));
        this.lootSpawnPoints.push(new THREE.Vector3(centerX - width / 2 - 2.0, 0.7, centerZ));
        this.lootSpawnPoints.push(new THREE.Vector3(centerX, 0.7, centerZ - depth / 2 - 2.0));

        // 行人路徑
        this.pedestrianPaths.push(new THREE.Vector3(centerX, 0.5, centerZ + depth / 2 + 4.5));
        this.pedestrianPaths.push(new THREE.Vector3(centerX + width / 2 + 3.5, 0.5, centerZ));
      });
    });
  }

  createStreetProps() {
    const lampMat = new THREE.MeshLambertMaterial({ color: 0x64748b });
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfffbeb });

    const lightPositions = [
      [-72, -140], [-72, -70], [-72, 0], [-72, 70], [-72, 140],
      [-52, -140], [-52, -70], [-52, 0], [-52, 70], [-52, 140],
      [52, -140], [52, -70], [52, 0], [52, 70], [52, 140],
      [72, -140], [72, -70], [72, 0], [72, 70], [72, 140]
    ];

    lightPositions.forEach(([lx, lz]) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 5.5), lampMat);
      pole.position.set(lx, 2.75, lz);
      this.scene.add(pole);

      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 0.12), lampMat);
      arm.position.set(lx + (lx < 0 ? 0.6 : -0.6), 5.4, lz);
      this.scene.add(arm);

      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), bulbMat);
      bulb.position.set(lx + (lx < 0 ? 1.1 : -1.1), 5.1, lz);
      this.scene.add(bulb);

      if (Math.abs(lx) <= 72 && Math.abs(lz) <= 70) {
        const pLight = new THREE.PointLight(0xffedd5, 0.8, 20);
        pLight.position.set(lx, 4.8, lz);
        this.scene.add(pLight);
      }
    });

    // 霓虹發光看板
    const neonTexts = [
      { text: '🍜 RAMEN', col: 0xf43f5e, pos: [-48, 4.5, -58], rot: 0 },
      { text: '💊 PHARMACY', col: 0x10b981, pos: [48, 4.5, 58], rot: Math.PI },
      { text: '🍸 NIGHT BAR', col: 0xa855f7, pos: [-48, 5, 16], rot: 0 },
      { text: '🏪 24H MARKET', col: 0x38bdf8, pos: [48, 4, -38], rot: Math.PI }
    ];

    neonTexts.forEach(sign => {
      const signBoard = new THREE.Mesh(
        new THREE.BoxGeometry(5.5, 1.6, 0.3),
        new THREE.MeshLambertMaterial({ color: 0x0f172a })
      );
      signBoard.position.set(sign.pos[0], sign.pos[1], sign.pos[2]);
      signBoard.rotation.y = sign.rot;
      this.scene.add(signBoard);

      const glowLight = new THREE.PointLight(sign.col, 1.2, 12);
      glowLight.position.set(sign.pos[0], sign.pos[1], sign.pos[2] + (sign.rot === 0 ? 0.8 : -0.8));
      this.scene.add(glowLight);
    });
  }

  createAtmosphere() {
    this.scene.fog = new THREE.FogExp2(0x0b0f19, 0.007);

    const ambientLight = new THREE.AmbientLight(0x475569, 0.9);
    this.scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0x60a5fa, 0x0f172a, 0.6);
    this.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0x93c5fd, 0.75);
    dirLight.position.set(80, 120, 60);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 300;
    const d = 160;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    this.scene.add(dirLight);
  }

  update(time) {
    if (this.waterMesh) {
      this.waterMesh.position.y = 0.05 + Math.sin(time * 2.5) * 0.05;
    }
  }
}

window.CityBuilder = CityBuilder;
