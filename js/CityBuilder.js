/**
 * CityBuilder.js
 * 3D 現代都市地圖生成器：包含可進入的室內建築（24H便利店、都市藥局診所、拉麵館、安全屋）、高樓大廈、運河大橋與精緻室內擺設
 */
class CityBuilder {
  constructor(scene) {
    this.scene = scene;
    this.collisionBoxes = [];
    this.lootSpawnPoints = [];
    this.indoorLootPoints = [];
    this.roadSegments = [];
    this.pedestrianPaths = [];
    this.enterableBuildings = [];
    this.waterMesh = null;
  }

  build() {
    this.createGroundAndRoads();
    this.createCanalAndBridges();
    this.createEnterableBuildings(); // 可進入的室內特色建築
    this.createCityBuildings();
    this.createStreetProps();
    this.createAtmosphere();
  }

  createGroundAndRoads() {
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

    // 南北向大道 (X = -62, X = 62, X = -122, X = 122)
    const mainRoadXs = [-62, 62, -122, 122];
    mainRoadXs.forEach(rx => {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(14, 480), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(rx, 0.02, 0);
      road.receiveShadow = true;
      this.scene.add(road);

      for (let z = -230; z <= 230; z += 12) {
        const line = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 6), lineMat);
        line.rotation.x = -Math.PI / 2;
        line.position.set(rx, 0.03, z);
        this.scene.add(line);
      }

      [-8.75, 8.75].forEach(offsetX => {
        const sw = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.2, 480), sidewalkMat);
        sw.position.set(rx + offsetX, 0.1, 0);
        sw.receiveShadow = true;
        this.scene.add(sw);
      });

      this.roadSegments.push({ x: rx, zMin: -230, zMax: 230, dir: 'Z' });
    });

    // 東西向街道 (Z = -140, Z = -70, Z = 0, Z = 70, Z = 140)
    const crossRoadZs = [-140, -70, 0, 70, 140];
    crossRoadZs.forEach(rz => {
      const crossRoad = new THREE.Mesh(new THREE.PlaneGeometry(380, 14), roadMat);
      crossRoad.rotation.x = -Math.PI / 2;
      crossRoad.position.set(0, 0.02, rz);
      crossRoad.receiveShadow = true;
      this.scene.add(crossRoad);

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

    const canalWallMat = new THREE.MeshLambertMaterial({ color: 0x334155 });
    const promenadeMat = new THREE.MeshLambertMaterial({ color: 0x64748b });

    [-11.5, 11.5].forEach(xPos => {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(1.2, 4.5, 490), canalWallMat);
      wall.position.set(xPos, -1.8, 0);
      wall.receiveShadow = true;
      this.scene.add(wall);

      const promX = xPos > 0 ? xPos + 3.8 : xPos - 3.8;
      const prom = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.2, 490), promenadeMat);
      prom.position.set(promX, 0.1, 0);
      prom.receiveShadow = true;
      this.scene.add(prom);
    });

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

      const arch = new THREE.Mesh(new THREE.TorusGeometry(7, 0.3, 8, 24, Math.PI), archMat);
      arch.position.set(0, 1.6, bz - 6.5);
      this.scene.add(arch);

      const arch2 = arch.clone();
      arch2.position.set(0, 1.6, bz + 6.5);
      this.scene.add(arch2);

      const ladder = new THREE.Mesh(new THREE.BoxGeometry(1.8, 4, 0.3), new THREE.MeshLambertMaterial({ color: 0xf59e0b }));
      ladder.position.set(-10.8, -0.5, bz + 8);
      this.scene.add(ladder);
      this.lootSpawnPoints.push(new THREE.Vector3(-10.5, 0.6, bz + 8));
    });
  }

  // 建立可進入的室內特色建築
  createEnterableBuildings() {
    const floorMat = new THREE.MeshLambertMaterial({ color: 0xe2e8f0 });
    const wallMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
    const clinicWallMat = new THREE.MeshLambertMaterial({ color: 0xf8fafc });
    const woodCounterMat = new THREE.MeshLambertMaterial({ color: 0x92400e });
    const shelfMat = new THREE.MeshLambertMaterial({ color: 0x0284c7 });

    // ==========================================
    // 1. 24H 賽博便利超商 (24H Cyber Mart)
    // 位於 X: -34, Z: -35 (寬 14m, 深 16m, 高 4.5m)
    // ==========================================
    const martX = -34, martZ = -35;
    this.createHollowBuilding({
      name: '24H 便利超商',
      centerX: martX,
      centerZ: martZ,
      width: 14,
      depth: 16,
      height: 4.5,
      floorColor: 0x38bdf8,
      wallColor: 0x1e293b,
      entranceSide: 'north', // 門開在 Z- 方向 (面向街道)
      doorWidth: 5
    });

    // 超商招牌
    this.createNeonSign('🏪 24H CONVENIENCE MART', 0x38bdf8, martX, 4.8, martZ - 8.2, 0);

    // 超商室內貨架與收銀台
    const counter1 = new THREE.Mesh(new THREE.BoxGeometry(4, 1.1, 1.2), woodCounterMat);
    counter1.position.set(martX - 3.5, 0.55, martZ - 3);
    this.scene.add(counter1);
    this.collisionBoxes.push(new THREE.Box3().setFromObject(counter1));

    // 貨架 1 & 2
    for (let s = -2; s <= 2; s += 4) {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(6.5, 2.2, 1.0), shelfMat);
      shelf.position.set(martX + 2, 1.1, martZ + s);
      this.scene.add(shelf);
      this.collisionBoxes.push(new THREE.Box3().setFromObject(shelf));
    }

    // 超商室內燈光
    const martLight = new THREE.PointLight(0xffffff, 1.2, 18);
    martLight.position.set(martX, 3.8, martZ);
    this.scene.add(martLight);

    // 超商室內物資 (大量食物與繃帶)
    this.indoorLootPoints.push({ pos: new THREE.Vector3(martX - 3.5, 1.2, martZ - 3), type: 'food' });
    this.indoorLootPoints.push({ pos: new THREE.Vector3(martX + 2, 1.3, martZ - 2), type: 'med' });
    this.indoorLootPoints.push({ pos: new THREE.Vector3(martX + 2, 1.3, martZ + 2), type: 'food' });
    this.indoorLootPoints.push({ pos: new THREE.Vector3(martX, 0.8, martZ + 5), type: 'med' });

    // ==========================================
    // 2. 都市急救診所 / 藥局 (City Clinic & Pharmacy)
    // 位於 X: 34, Z: 35
    // ==========================================
    const clinicX = 34, clinicZ = 35;
    this.createHollowBuilding({
      name: '都市急救診所',
      centerX: clinicX,
      centerZ: clinicZ,
      width: 14,
      depth: 16,
      height: 4.5,
      floorColor: 0x10b981,
      wallColor: 0x0f172a,
      entranceSide: 'south', // 門開在 Z+ 方向
      doorWidth: 5
    });

    this.createNeonSign('🏥 CITY CLINIC & PHARMACY', 0x10b981, clinicX, 4.8, clinicZ + 8.2, Math.PI);

    // 藥局櫃檯與病床
    const clinicCounter = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1.1, 1.2), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    clinicCounter.position.set(clinicX + 3.2, 0.55, clinicZ + 3);
    this.scene.add(clinicCounter);
    this.collisionBoxes.push(new THREE.Box3().setFromObject(clinicCounter));

    const bed = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.8, 5), new THREE.MeshLambertMaterial({ color: 0x38bdf8 }));
    bed.position.set(clinicX - 3.5, 0.4, clinicZ - 2);
    this.scene.add(bed);
    this.collisionBoxes.push(new THREE.Box3().setFromObject(bed));

    const clinicLight = new THREE.PointLight(0xecfdf5, 1.3, 18);
    clinicLight.position.set(clinicX, 3.8, clinicZ);
    this.scene.add(clinicLight);

    // 診所內豐富的專業醫療物資
    this.indoorLootPoints.push({ pos: new THREE.Vector3(clinicX + 3.2, 1.2, clinicZ + 3), type: 'med_large' });
    this.indoorLootPoints.push({ pos: new THREE.Vector3(clinicX - 3.5, 0.9, clinicZ - 2), type: 'med' });
    this.indoorLootPoints.push({ pos: new THREE.Vector3(clinicX, 0.8, clinicZ - 4), type: 'med' });

    // ==========================================
    // 3. 深夜熱騰騰拉麵屋 (Midnight Ramen Diner)
    // 位於 X: -34, Z: 35
    // ==========================================
    const ramenX = -34, ramenZ = 35;
    this.createHollowBuilding({
      name: '深夜拉麵屋',
      centerX: ramenX,
      centerZ: ramenZ,
      width: 14,
      depth: 16,
      height: 4.5,
      floorColor: 0x78350f,
      wallColor: 0x1c1917,
      entranceSide: 'south',
      doorWidth: 5
    });

    this.createNeonSign('🍜 MIDNIGHT RAMEN DINER', 0xf43f5e, ramenX, 4.8, ramenZ + 8.2, Math.PI);

    // 拉麵吧檯
    const ramenBar = new THREE.Mesh(new THREE.BoxGeometry(8, 1.1, 1.5), woodCounterMat);
    ramenBar.position.set(ramenX, 0.55, ramenZ - 2);
    this.scene.add(ramenBar);
    this.collisionBoxes.push(new THREE.Box3().setFromObject(ramenBar));

    const ramenLight = new THREE.PointLight(0xffedd5, 1.4, 18);
    ramenLight.position.set(ramenX, 3.6, ramenZ);
    this.scene.add(ramenLight);

    // 拉麵屋內的高級拉麵食物
    this.indoorLootPoints.push({ pos: new THREE.Vector3(ramenX - 2, 1.2, ramenZ - 2), type: 'ramen' });
    this.indoorLootPoints.push({ pos: new THREE.Vector3(ramenX + 2, 1.2, ramenZ - 2), type: 'ramen' });
    this.indoorLootPoints.push({ pos: new THREE.Vector3(ramenX, 0.8, ramenZ + 3), type: 'food' });

    // ==========================================
    // 4. 地下避難所 / 武裝安全屋 (Armory Safehouse)
    // 位於 X: 34, Z: -35
    // ==========================================
    const safeX = 34, safeZ = -35;
    this.createHollowBuilding({
      name: '軍火安全屋',
      centerX: safeX,
      centerZ: safeZ,
      width: 14,
      depth: 16,
      height: 4.5,
      floorColor: 0x475569,
      wallColor: 0x0f172a,
      entranceSide: 'north',
      doorWidth: 5
    });

    this.createNeonSign('⚡ ARMED SAFEHOUSE', 0xa855f7, safeX, 4.8, safeZ - 8.2, 0);

    const safeLight = new THREE.PointLight(0xf3e8ff, 1.2, 18);
    safeLight.position.set(safeX, 3.6, safeZ);
    this.scene.add(safeLight);

    // 安全屋內的武器、彈藥與急救包
    this.indoorLootPoints.push({ pos: new THREE.Vector3(safeX - 2, 0.8, safeZ + 2), type: 'weapon' });
    this.indoorLootPoints.push({ pos: new THREE.Vector3(safeX + 2, 0.8, safeZ + 2), type: 'med_large' });
    this.indoorLootPoints.push({ pos: new THREE.Vector3(safeX, 0.8, safeZ - 2), type: 'food' });

    // 標記這 4 棟進入式建築物所在區塊，避免一般摩天大樓在此重疊生成
    this.enterableBuildingBlocks = [
      { bx: 2, bz: 2 }, // mart
      { bx: 3, bz: 3 }, // clinic
      { bx: 2, bz: 3 }, // ramen
      { bx: 3, bz: 2 }  // safehouse
    ];
  }

  // 輔助函式：建立具備開放門口的空心可進入建築
  createHollowBuilding(config) {
    const { centerX, centerZ, width, depth, height, floorColor, wallColor, entranceSide, doorWidth } = config;
    const wallThick = 0.5;
    const wallMat = new THREE.MeshLambertMaterial({ color: wallColor });
    const floorMat = new THREE.MeshLambertMaterial({ color: floorColor });
    const ceilingMat = new THREE.MeshLambertMaterial({ color: 0x334155 });

    // 1. 室內地板
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(width - 0.2, depth - 0.2), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(centerX, 0.05, centerZ);
    floor.receiveShadow = true;
    this.scene.add(floor);

    // 2. 天花板/屋頂
    const ceiling = new THREE.Mesh(new THREE.BoxGeometry(width, wallThick, depth), ceilingMat);
    ceiling.position.set(centerX, height, centerZ);
    this.scene.add(ceiling);

    // 3. 左側牆 (West wall)
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, height, depth), wallMat);
    leftWall.position.set(centerX - width / 2, height / 2, centerZ);
    this.scene.add(leftWall);
    this.collisionBoxes.push(new THREE.Box3().setFromObject(leftWall));

    // 4. 右側牆 (East wall)
    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, height, depth), wallMat);
    rightWall.position.set(centerX + width / 2, height / 2, centerZ);
    this.scene.add(rightWall);
    this.collisionBoxes.push(new THREE.Box3().setFromObject(rightWall));

    // 5. 後側牆與帶開口的前側大門牆
    if (entranceSide === 'north') {
      // 門在 North (Z - depth/2)，後牆在 South (Z + depth/2)
      const backWall = new THREE.Mesh(new THREE.BoxGeometry(width, height, wallThick), wallMat);
      backWall.position.set(centerX, height / 2, centerZ + depth / 2);
      this.scene.add(backWall);
      this.collisionBoxes.push(new THREE.Box3().setFromObject(backWall));

      // 前門左右兩側小牆段 (留下中間門洞)
      const sideWallLen = (width - doorWidth) / 2;
      const frontLeft = new THREE.Mesh(new THREE.BoxGeometry(sideWallLen, height, wallThick), wallMat);
      frontLeft.position.set(centerX - width / 2 + sideWallLen / 2, height / 2, centerZ - depth / 2);
      this.scene.add(frontLeft);
      this.collisionBoxes.push(new THREE.Box3().setFromObject(frontLeft));

      const frontRight = new THREE.Mesh(new THREE.BoxGeometry(sideWallLen, height, wallThick), wallMat);
      frontRight.position.set(centerX + width / 2 - sideWallLen / 2, height / 2, centerZ - depth / 2);
      this.scene.add(frontRight);
      this.collisionBoxes.push(new THREE.Box3().setFromObject(frontRight));
    } else {
      // 門在 South (Z + depth/2)，後牆在 North (Z - depth/2)
      const backWall = new THREE.Mesh(new THREE.BoxGeometry(width, height, wallThick), wallMat);
      backWall.position.set(centerX, height / 2, centerZ - depth / 2);
      this.scene.add(backWall);
      this.collisionBoxes.push(new THREE.Box3().setFromObject(backWall));

      const sideWallLen = (width - doorWidth) / 2;
      const frontLeft = new THREE.Mesh(new THREE.BoxGeometry(sideWallLen, height, wallThick), wallMat);
      frontLeft.position.set(centerX - width / 2 + sideWallLen / 2, height / 2, centerZ + depth / 2);
      this.scene.add(frontLeft);
      this.collisionBoxes.push(new THREE.Box3().setFromObject(frontLeft));

      const frontRight = new THREE.Mesh(new THREE.BoxGeometry(sideWallLen, height, wallThick), wallMat);
      frontRight.position.set(centerX + width / 2 - sideWallLen / 2, height / 2, centerZ + depth / 2);
      this.scene.add(frontRight);
      this.collisionBoxes.push(new THREE.Box3().setFromObject(frontRight));
    }
  }

  createNeonSign(text, color, x, y, z, rotY) {
    const signBoard = new THREE.Mesh(
      new THREE.BoxGeometry(8, 1.5, 0.3),
      new THREE.MeshLambertMaterial({ color: 0x0f172a })
    );
    signBoard.position.set(x, y, z);
    signBoard.rotation.y = rotY;
    this.scene.add(signBoard);

    const glow = new THREE.PointLight(color, 1.2, 12);
    glow.position.set(x, y, z + (rotY === 0 ? -0.6 : 0.6));
    this.scene.add(glow);
  }

  createCityBuildings() {
    const buildingColors = [0x1e293b, 0x0f172a, 0x334155, 0x1e1e2f, 0x252a34, 0x182c3c];
    const windowMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const warmWindowMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

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
        // 跳過已建立室內可進入建築的 4 個中央街區
        const isEnterableSpot = (
          (bxIdx === 2 && bzIdx === 2) ||
          (bxIdx === 3 && bzIdx === 3) ||
          (bxIdx === 2 && bzIdx === 3) ||
          (bxIdx === 3 && bzIdx === 2)
        );
        if (isEnterableSpot) return;

        const width = (xRange.max - xRange.min) - 4;
        const depth = (zRange.max - zRange.min) - 4;
        const height = 24 + ((bxIdx * 9 + bzIdx * 17) % 40);
        const centerX = (xRange.min + xRange.max) / 2;
        const centerZ = (zRange.min + zRange.max) / 2;

        const col = buildingColors[(bxIdx + bzIdx) % buildingColors.length];
        const bMat = new THREE.MeshLambertMaterial({ color: col });

        const bMesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), bMat);
        bMesh.position.set(centerX, height / 2, centerZ);
        bMesh.castShadow = true;
        bMesh.receiveShadow = true;
        this.scene.add(bMesh);

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

        // 大樓入口前廳
        const lobby = new THREE.Mesh(new THREE.BoxGeometry(5, 3.2, 2.5), new THREE.MeshLambertMaterial({ color: 0x0284c7 }));
        lobby.position.set(centerX, 1.6, centerZ + depth / 2 + 1.2);
        this.scene.add(lobby);

        // 物資點
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
  }

  createAtmosphere() {
    this.scene.fog = new THREE.FogExp2(0x0b0f19, 0.007);

    const ambientLight = new THREE.AmbientLight(0x475569, 0.95);
    this.scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0x60a5fa, 0x0f172a, 0.65);
    this.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0x93c5fd, 0.8);
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
