/**
 * main.js
 * 遊戲主循環、Three.js 渲染管線初始化與全域生命週期協調 (支援直覺點擊人物攻擊/點擊物品拾取)
 */
window.addEventListener('DOMContentLoaded', () => {
  // 1. 初始化 Web Audio 音效
  const audioManager = new AudioManager();

  // 2. 初始化遊戲核心狀態
  const gameState = new GameState(audioManager);

  // 3. 初始化 Three.js 場景與渲染器
  const container = document.getElementById('game-container');
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0f19);

  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  container.appendChild(renderer.domElement);

  // 4. 初始化第一人稱控制器
  const controls = new FirstPersonControls(camera, renderer.domElement, audioManager, gameState);
  scene.add(controls.getObject());

  // 玩家起始位置 (出生在中央大道旁寬敞人行道安全區)
  controls.getObject().position.set(-62, 1.7, -35);

  // 5. 生成 3D 都市世界
  const cityBuilder = new CityBuilder(scene);
  cityBuilder.build();
  controls.collisionObstacles = cityBuilder.collisionBoxes;

  // 6. 初始化物資搜刮系統
  const itemSystem = new ItemSystem(scene, gameState, audioManager);
  itemSystem.initSpawns(cityBuilder.lootSpawnPoints, cityBuilder.indoorLootPoints);

  // 7. 初始化 NPC 行人與危險暴徒系統
  const npcSystem = new NPCSystem(scene, gameState, audioManager, itemSystem);

  // 8. 初始化交通車輛系統
  const trafficSystem = new TrafficSystem(scene, gameState, audioManager);

  // 9. 初始化第一人稱武器與戰鬥系統
  const weaponSystem = new WeaponSystem(camera, scene, gameState, audioManager, npcSystem);

  // 10. 綁定「點擊人物即攻擊、點擊物品即拾取」直覺互動回調
  controls.onTapWorld = (clientX, clientY) => {
    if (gameState.isGameOver) return;

    const ndcX = (clientX / window.innerWidth) * 2 - 1;
    const ndcY = -(clientY / window.innerHeight) * 2 + 1;

    const tapRay = new THREE.Raycaster();
    tapRay.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);

    // 1. 優先檢測是否直接點擊到物品 (食物、醫療繃帶、急救箱、武器)
    let clickedItem = null;
    let minItemDist = 12.0; // 點擊拾取感應半徑 12m
    itemSystem.items.forEach(it => {
      const hits = tapRay.intersectObjects(it.mesh.children, true);
      if (hits.length > 0 && hits[0].distance < minItemDist) {
        minItemDist = hits[0].distance;
        clickedItem = it;
      }
    });

    if (clickedItem) {
      itemSystem.pickupItem(clickedItem);
      return;
    }

    // 2. 點擊到人物或空間發動定向攻擊
    weaponSystem.performAttack(tapRay);
  };

  controls.onAttackTrigger = () => {
    weaponSystem.performAttack();
  };

  controls.onInteractTrigger = () => {
    if (itemSystem.currentNearbyItem) {
      itemSystem.pickupItem(itemSystem.currentNearbyItem);
    }
  };

  // 11. 初始化 HUD 介面
  const uiManager = new UIManager(gameState);
  window.uiManager = uiManager;

  // 12. 介面互動事件 (開始遊戲 & 重新開始)
  const startBtn = document.getElementById('start-btn');
  const restartBtn = document.getElementById('restart-btn');
  const blocker = document.getElementById('blocker');
  const gameOverModal = document.getElementById('game-over-modal');

  startBtn.addEventListener('click', () => {
    startBtn.blur();
    controls.lock();
    audioManager.resume();
  });

  startBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    startBtn.blur();
    controls.lock();
    audioManager.resume();
  });

  restartBtn.addEventListener('click', () => {
    gameState.reset();
    gameOverModal.style.display = 'none';

    controls.getObject().position.set(-62, 1.7, -35);
    controls.velocity.set(0, 0, 0);

    controls.lock();
    audioManager.resume();

    uiManager.addLog('🎮 遊戲重新開始，祝你好運！', 'info');
  });

  // 視窗大小改變自適應
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // 13. 主遊戲循環 Loop
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);

    const delta = Math.min(clock.getDelta(), 0.1);
    const time = clock.getElapsedTime();

    if (!gameState.isGameOver) {
      gameState.update(delta);
      controls.update(delta);

      const playerPos = controls.getObject().position;
      const playerYaw = controls.yawObject.rotation.y;
      const isMoving = controls.moveForward || controls.moveBackward || controls.moveLeft || controls.moveRight ||
                       Math.abs(controls.joystickVector.x) > 0.1 || Math.abs(controls.joystickVector.z) > 0.1;

      weaponSystem.update(delta, isMoving);
      cityBuilder.update(time);
      trafficSystem.update(delta, playerPos);
      npcSystem.update(delta, playerPos, camera);
      itemSystem.update(delta, playerPos);
      uiManager.update(playerPos, playerYaw, trafficSystem, npcSystem, itemSystem);
    }

    renderer.render(scene, camera);
  }

  animate();
});
