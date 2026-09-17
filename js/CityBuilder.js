/**
 * CityBuilder.js
 * 3D 現代都市地圖生成器：包含摩天大樓、街道、中央運河、大橋、室內穿堂與霓虹街景
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
    const groundGeo = new THREE.PlaneGeometry(400, 500);
    const groundMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // 道路材質
    const roadMat = new THREE.MeshLambertMaterial({ color: 0x0f172a });
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    const zebraMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const sidewalkMat = new THREE.MeshLambertMaterial({ color: 0x475569 });

    // 東西兩側主要的南北向大道 (X = -60, X = 60, X = -120, X = 120)
    const mainRoadXs = [-60, 60, -120, 120];
    mainRoadXs.forEach(rx => {
      // 車道
      const road = new THREE.Mesh(new THREE.PlaneGeometry(16, 480), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(rx, 0.02, 0);
      road.receiveShadow = true;
      this.scene.add(road);

      // 車道中線 (虛線黃色)
      for (let z = -230; z <= 230; z += 12) {
        const line = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 6), lineMat);
        line.rotation.x = -Math.PI / 2;
        line.position.set(rx, 0.03, z);
        this.scene.add(line);
      }

      // 人行道 (左右兩側)
      [-9.5, 9.5].forEach(offsetX => {
        const sw = new THREE.Mesh(new THREE.BoxGeometry(3, 0.2, 480), sidewalkMat);
        sw.position.set(rx + offsetX, 0.1, 0);
        sw.receiveShadow = true;
        this.scene.add(sw);
      });

      this.roadSegments.push({ x: rx, zMin: -230, zMax: 230, dir: 'Z' });
    });

    // 東西向橫向街道 (Z = -140, Z = -70, Z = 0, Z = 70, Z = 140)
    const crossRoadZs = [-140, -70, 0, 70, 140];
    crossRoadZs.forEach(rz => {
      const crossRoad = new THREE.Mesh(new THREE.PlaneGeometry(360, 16), roadMat);
      crossRoad.rotation.x = -Math.PI / 2;
      crossRoad.position.set(0, 0.02, rz);
      crossRoad.receiveShadow = true;
      this.scene.add(crossRoad);

      // 斑馬線 (在各十字路口)
      mainRoadXs.forEach(rx => {
        for (let i = -6; i <= 6; i += 1.8) {
          const stripe = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 4), zebraMat);
          stripe.rotation.x = -Math.PI / 2;
          stripe.position.set(rx + i, 0.04, rz - 9);
          this.scene.add(stripe);

          const stripe2 = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 4), zebraMat);
          stripe2.rotation.x = -Math.PI / 2;
          stripe2.position.set(rx + i, 0.04, rz + 9);
          this.scene.add(stripe2);
        }
      });

      this.roadSegments.push({ z: rz, xMin: -170, xMax: 170, dir: 'X' });
    });
  }

  createCanalAndBridges() {
    // 運河水面 (X: -12 ~ 12, Z: -250 ~ 250)
    const waterGeo = new THREE.PlaneGeometry(24, 490, 24, 40);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.1,
      metalness: 0.8,
      transparent: true,
      opacity: 0.75
    });
    this.waterMesh = new THREE.Mesh(waterGeo, waterMat);
    this.waterMesh.rotation.x = -Math.PI / 2;
    this.waterMesh.position.set(0, 0.1, 0);
    this.scene.add(this.waterMesh);

    // 運河兩側石壁堤防
    const canalWallMat = new THREE.MeshLambertMaterial({ color: 0x334155 });
    [-12.5, 12.5].forEach(xPos => {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(1.5, 4.5, 490), canalWallMat);
      wall.position.set(xPos, -1.8, 0);
      wall.receiveShadow = true;
      this.scene.add(wall);

      // 沿岸護欄
      const fenceMat = new THREE.MeshLambertMaterial({ color: 0x94a3b8 });
      for (let z = -240; z <= 240; z += 15) {
        // 跳過橋樑開口處
        const nearBridge = [-140, -70, 0, 70, 140].some(bz => Math.abs(z - bz) < 10);
        if (!nearBridge) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.1), fenceMat);
          post.position.set(xPos, 0.55, z);
          this.scene.add(post);

          const bar = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 15), fenceMat);
          bar.position.set(xPos, 0.9, z);
          this.scene.add(bar);
        }
      }
    });

    // 運河跨河大橋 (在每個十字路口連接東西城區)
    const bridgeZs = [-140, -70, 0, 70, 140];
    const bridgeMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
    const archMat = new THREE.MeshLambertMaterial({ color: 0x0284c7 });

    bridgeZs.forEach(bz => {
      // 橋面
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(28, 0.8, 16), bridgeMat);
      bridge.position.set(0, 1.5, bz);
      bridge.castShadow = true;
      bridge.receiveShadow = true;
      this.scene.add(bridge);

      // 橋拱與斜坡道 (方便玩家與車輛開上橋)
      [-14, 14].forEach(edgeX => {
        const ramp = new THREE.Mesh(new THREE.BoxGeometry(8, 0.6, 16), bridgeMat);
        ramp.position.set(edgeX + (edgeX > 0 ? 3 : -3), 0.7, bz);
        ramp.rotation.z = (edgeX > 0 ? 0.18 : -0.18);
        this.scene.add(ramp);
      });

      // 景觀拱門裝飾
      const arch = new THREE.Mesh(new THREE.TorusGeometry(8, 0.35, 8, 24, Math.PI), archMat);
      arch.position.set(0, 1.6, bz - 7.5);
      this.scene.add(arch);

      const arch2 = arch.clone();
      arch2.position.set(0, 1.6, bz + 7.5);
      this.scene.add(arch2);

      // 下水階梯/爬梯 (在橋旁設置，供掉入水中的玩家爬上岸)
      const ladder = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 0.4), new THREE.MeshLambertMaterial({ color: 0xf59e0b }));
      ladder.position.set(-11.5, -0.5, bz + 9);
      this.scene.add(ladder);
      this.lootSpawnPoints.push(new THREE.Vector3(-11, 0.5, bz + 9));
    });
  }

  createCityBuildings() {
    // 建築物網格分佈區塊
    const buildingColors = [0x1e293b, 0x0f172a, 0x334155, 0x1e1e2f, 0x252a34, 0x182c3c];
    const windowMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const warmWindowMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

    // 定義建築物群落的 X 軸與 Z 軸區間 (避開馬路與運河)
    const blockXRanges = [
      { min: -170, max: -130 },
      { min: -110, max: -70 },
      { min: -50, max: -18 },
      { min: 18, max: 50 },
      { min: 70, max: 110 },
      { min: 130, max: 170 }
    ];

    const blockZRanges = [
      { min: -220, max: -150 },
      { min: -130, max: -80 },
      { min: -60, max: -10 },
      { min: 10, max: 60 },
      { min: 80, max: 130 },
      { min: 150, max: 220 }
    ];

    blockXRanges.forEach((xRange, bxIdx) => {
      blockZRanges.forEach((zRange, bzIdx) => {
        // 每個區塊隨機生成 1~2 棟大樓與室內穿堂/暗巷
        const width = (xRange.max - xRange.min) - 4;
        const depth = (zRange.max - zRange.min) - 4;
        const height = 25 + ((bxIdx * 7 + bzIdx * 13) % 45); // 高度 25 ~ 70m
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

        // 記錄碰撞箱 (留出周邊走道與門廊)
        const box = new THREE.Box3().setFromObject(bMesh);
        this.collisionBoxes.push(box);

        // 建築物窗戶陣列
        const winGeo = new THREE.PlaneGeometry(1.2, 1.8);
        for (let wy = 4; wy < height - 3; wy += 5) {
          for (let wx = -width / 2 + 3; wx < width / 2 - 2; wx += 4.5) {
            const isLit = (Math.sin(wx * 10 + wy * 5 + bxIdx) > -0.2);
            if (isLit) {
              const win = new THREE.Mesh(winGeo, (Math.random() > 0.4 ? windowMat : warmWindowMat));
              win.position.set(centerX + wx, wy, centerZ + depth / 2 + 0.05);
              this.scene.add(win);
            }
          }
        }

        // 建築前門大廳/挑高門廊 (可走進去搜刮物資)
        const lobby = new THREE.Mesh(new THREE.BoxGeometry(6, 3.5, 3), new THREE.MeshLambertMaterial({ color: 0x0284c7 }));
        lobby.position.set(centerX, 1.75, centerZ + depth / 2 + 1.2);
        this.scene.add(lobby);

        // 建築物物資刷新點 (門口、大樓背後暗巷)
        this.lootSpawnPoints.push(new THREE.Vector3(centerX, 0.8, centerZ + depth / 2 + 2.5));
        this.lootSpawnPoints.push(new THREE.Vector3(centerX + width / 2 + 1.8, 0.8, centerZ));
        this.lootSpawnPoints.push(new THREE.Vector3(centerX - width / 2 - 1.8, 0.8, centerZ));
        this.lootSpawnPoints.push(new THREE.Vector3(centerX, 0.8, centerZ - depth / 2 - 1.8));

        // 行人路徑巡邏點
        this.pedestrianPaths.push(new THREE.Vector3(centerX, 0.5, centerZ + depth / 2 + 5));
        this.pedestrianPaths.push(new THREE.Vector3(centerX + width / 2 + 3, 0.5, centerZ));
      });
    });
  }

  createStreetProps() {
    const lampMat = new THREE.MeshLambertMaterial({ color: 0x64748b });
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfffbeb });

    // 在主要路口設置路燈與光源
    const lightPositions = [
      [-68, -140], [-68, -70], [-68, 0], [-68, 70], [-68, 140],
      [-52, -140], [-52, -70], [-52, 0], [-52, 70], [-52, 140],
      [52, -140], [52, -70], [52, 0], [52, 70], [52, 140],
      [68, -140], [68, -70], [68, 0], [68, 70], [68, 140],
      [-128, -70], [-128, 70], [128, -70], [128, 70]
    ];

    lightPositions.forEach(([lx, lz]) => {
      // 燈桿
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 6), lampMat);
      pole.position.set(lx, 3, lz);
      this.scene.add(pole);

      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.15, 0.15), lampMat);
      arm.position.set(lx + (lx < 0 ? 0.7 : -0.7), 5.9, lz);
      this.scene.add(arm);

      // 燈泡
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), bulbMat);
      bulb.position.set(lx + (lx < 0 ? 1.3 : -1.3), 5.6, lz);
      this.scene.add(bulb);

      // 點光源 (為效能優化僅放部分，其他使用平行光與氛圍光)
      if (Math.abs(lx) <= 70 && Math.abs(lz) <= 70) {
        const pLight = new THREE.PointLight(0xffedd5, 0.8, 22);
        pLight.position.set(lx, 5.2, lz);
        this.scene.add(pLight);
      }
    });

    // 賽博霓虹招牌
    const neonTexts = [
      { text: '🍜 RAMEN', col: 0xf43f5e, pos: [-48, 4.5, -60], rot: 0 },
      { text: '💊 PHARMACY', col: 0x10b981, pos: [48, 4.5, 60], rot: Math.PI },
      { text: '🍸 NIGHT BAR', col: 0xa855f7, pos: [-48, 5, 20], rot: 0 },
      { text: '🏪 24H MARKET', col: 0x38bdf8, pos: [48, 4, -40], rot: Math.PI }
    ];

    neonTexts.forEach(sign => {
      const signBoard = new THREE.Mesh(
        new THREE.BoxGeometry(6, 1.8, 0.3),
        new THREE.MeshLambertMaterial({ color: 0x0f172a })
      );
      signBoard.position.set(sign.pos[0], sign.pos[1], sign.pos[2]);
      signBoard.rotation.y = sign.rot;
      this.scene.add(signBoard);

      const glowLight = new THREE.PointLight(sign.col, 1.2, 14);
      glowLight.position.set(sign.pos[0], sign.pos[1], sign.pos[2] + (sign.rot === 0 ? 0.8 : -0.8));
      this.scene.add(glowLight);
    });
  }

  createAtmosphere() {
    // 霧氣與微光
    this.scene.fog = new THREE.FogExp2(0x0f172a, 0.008);

    // 環境光
    const ambientLight = new THREE.AmbientLight(0x384259, 0.8);
    this.scene.add(ambientLight);

    // 半球光 (天藍與地表深色過渡)
    const hemiLight = new THREE.HemisphereLight(0x60a5fa, 0x0f172a, 0.5);
    this.scene.add(hemiLight);

    // 主平行光 (月光/都市黃昏天光)
    const dirLight = new THREE.DirectionalLight(0x93c5fd, 0.7);
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
    // 水波輕微起伏
    if (this.waterMesh) {
      this.waterMesh.position.y = 0.05 + Math.sin(time * 2.5) * 0.06;
    }
  }
}

window.CityBuilder = CityBuilder;
