/**
 * main.js
 * 遊戲主循環、Three.js 渲染管線初始化與全域生命週期協調 (支援 PC 與 行動/平板端)
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
  itemSystem.initSpawns(cityBuilder.lootSpawnPoints);

  // 7. 初始化 NPC 行人與危險暴徒系統
  const npcSystem = new NPCSystem(scene, gameState, audioManager, itemSystem);

  // 8. 初始化交通車輛系統
  const trafficSystem = new TrafficSystem(scene, gameState, audioManager);

  // 9. 初始化第一人稱武器與戰鬥系統
  const weaponSystem = new WeaponSystem(camera, scene, gameState, audioManager, npcSystem);

  // 10. 綁定行動端按鈕回調
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
    controls.lock();
    audioManager.resume();
  });

  // 行動端支援直接點擊開始按鈕
  startBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    controls.lock();
    audioManager.resume();
  });

  restartBtn.addEventListener('click', () => {
    // 重置遊戲數值
    gameState.reset();
    gameOverModal.style.display = 'none';

    // 重設玩家位置
    controls.getObject().position.set(-62, 1.7, -35);
    controls.velocity.set(0, 0, 0);

    // 重新鎖定滑鼠/開啟控制
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
      // 更新生理指標 (飽足感衰減、水下閉氣倒數)
      gameState.update(delta);

      // 更新玩家移動與物理
      controls.update(delta);

      const playerPos = controls.getObject().position;
      const playerYaw = controls.yawObject.rotation.y;
      const isMoving = controls.moveForward || controls.moveBackward || controls.moveLeft || controls.moveRight ||
                       Math.abs(controls.joystickVector.x) > 0.1 || Math.abs(controls.joystickVector.z) > 0.1;

      // 更新武器動畫
      weaponSystem.update(delta, isMoving);

      // 更新都市環境水波
      cityBuilder.update(time);

      // 更新車輛交通
      trafficSystem.update(delta, playerPos);

      // 更新路人與暴徒 AI
      npcSystem.update(delta, playerPos, camera);

      // 更新地面道具
      itemSystem.update(delta, playerPos);

      // 更新 HUD 與雷達小地圖
      uiManager.update(playerPos, playerYaw, trafficSystem, npcSystem, itemSystem);
    }

    renderer.render(scene, camera);
  }

  animate();
});
