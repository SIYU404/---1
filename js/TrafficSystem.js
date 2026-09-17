/**
 * TrafficSystem.js
 * 都市動態交通車輛系統：模擬巡邏車輛、狂飆衝撞、喇叭鳴笛與玩家碰撞傷害
 */
class TrafficSystem {
  constructor(scene, gameState, audioManager) {
    this.scene = scene;
    this.gameState = gameState;
    this.audio = audioManager;
    this.cars = [];
    this.carCount = 14;

    this.initCars();
  }

  initCars() {
    const carColors = [0xef4444, 0x3b82f6, 0xf59e0b, 0x10b981, 0x8b5cf6, 0xffffff, 0x334155];
    const roadXList = [-63, -57, 57, 63, -123, -117, 117, 123];

    for (let i = 0; i < this.carCount; i++) {
      const isEastWest = (i % 3 === 0);
      const color = carColors[i % carColors.length];
      const carMesh = this.createCarMesh(color);

      let x, z, dirX, dirZ, speed;

      if (isEastWest) {
        // 東西橫向車輛
        const zLanes = [-143, -137, -73, -67, -3, 3, 67, 73, 137, 143];
        z = zLanes[i % zLanes.length];
        x = -170 + Math.random() * 340;
        dirX = (z % 6 === 3 || z > 0) ? 1 : -1;
        dirZ = 0;
        speed = 18 + Math.random() * 16;
        carMesh.rotation.y = (dirX > 0) ? Math.PI / 2 : -Math.PI / 2;
      } else {
        // 南北縱向車輛
        x = roadXList[i % roadXList.length];
        z = -220 + Math.random() * 440;
        dirX = 0;
        dirZ = (x % 6 === 3 || x > 0) ? 1 : -1;
        speed = 20 + Math.random() * 20;
        carMesh.rotation.y = (dirZ > 0) ? 0 : Math.PI;
      }

      carMesh.position.set(x, 0.7, z);
      this.scene.add(carMesh);

      this.cars.push({
        mesh: carMesh,
        dirX: dirX,
        dirZ: dirZ,
        speed: speed,
        isEastWest: isEastWest,
        honkCooldown: 0,
        box: new THREE.Box3()
      });
    }
  }

  createCarMesh(color) {
    const group = new THREE.Group();

    // 車身下部
    const bodyMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.3, metalness: 0.6 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 4.6), bodyMat);
    body.position.y = 0.45;
    body.castShadow = true;
    group.add(body);

    // 車廂座艙
    const cabinMat = new THREE.MeshLambertMaterial({ color: 0x0f172a });
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.75, 2.6), cabinMat);
    cabin.position.set(0, 1.1, -0.2);
    group.add(cabin);

    // 車窗玻璃
    const glassMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const winF = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.6), glassMat);
    winF.position.set(0, 1.1, 1.11);
    group.add(winF);

    // 車輪 (4個)
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111827 });
    const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.35, 12);
    const wheelOffsets = [
      [-1.25, 0.38, 1.4],
      [1.25, 0.38, 1.4],
      [-1.25, 0.38, -1.4],
      [1.25, 0.38, -1.4]
    ];
    wheelOffsets.forEach(([wx, wy, wz]) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, wy, wz);
      group.add(wheel);
    });

    // 車前大燈 (亮黃/白光)
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xffedd5 });
    const hLight1 = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), lightMat);
    hLight1.position.set(-0.8, 0.55, 2.32);
    group.add(hLight1);

    const hLight2 = hLight1.clone();
    hLight2.position.set(0.8, 0.55, 2.32);
    group.add(hLight2);

    // 煞車尾燈 (紅)
    const tailMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const tLight1 = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.15, 0.05), tailMat);
    tLight1.position.set(-0.8, 0.55, -2.32);
    group.add(tLight1);

    const tLight2 = tLight1.clone();
    tLight2.position.set(0.8, 0.55, -2.32);
    group.add(tLight2);

    return group;
  }

  update(delta, playerPos) {
    this.cars.forEach(car => {
      // 移動車輛
      if (car.isEastWest) {
        car.mesh.position.x += car.dirX * car.speed * delta;
        // 邊界循環
        if (car.mesh.position.x > 180) car.mesh.position.x = -180;
        if (car.mesh.position.x < -180) car.mesh.position.x = 180;
      } else {
        car.mesh.position.z += car.dirZ * car.speed * delta;
        // 邊界循環
        if (car.mesh.position.z > 240) car.mesh.position.z = -240;
        if (car.mesh.position.z < -240) car.mesh.position.z = 240;
      }

      // 計算與玩家距離
      const distToPlayer = car.mesh.position.distanceTo(playerPos);

      // 喇叭冷卻與警笛
      if (car.honkCooldown > 0) car.honkCooldown -= delta;
      if (distToPlayer < 18 && car.honkCooldown <= 0) {
        // 如果玩家在同一條車道上 (高度相仿)
        if (Math.abs(playerPos.y - car.mesh.position.y) < 2.0) {
          if (this.audio) this.audio.playCarHorn();
          car.honkCooldown = 5.0 + Math.random() * 4.0;
        }
      }

      // 車輛與玩家碰撞檢測
      if (distToPlayer < 3.2 && Math.abs(playerPos.y - car.mesh.position.y) < 1.8) {
        const damage = Math.floor(45 + car.speed * 1.5);
        this.gameState.takeDamage(damage, '在馬路上被疾馳衝出的車輛撞飛致命');
      }
    });
  }

  getCarPositions() {
    return this.cars.map(c => c.mesh.position);
  }
}

window.TrafficSystem = TrafficSystem;
