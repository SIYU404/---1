/**
 * Controls.js
 * 第一人稱視角滑鼠鎖定與 WASD 移動控制、跳躍、重力與水中游泳物理
 */
class FirstPersonControls {
  constructor(camera, domElement, audioManager, gameState) {
    this.camera = camera;
    this.domElement = domElement;
    this.audio = audioManager;
    this.gameState = gameState;

    this.isLocked = false;

    // 視角旋轉物件 (Yaw: 水平旋轉, Pitch: 仰俯角)
    this.pitchObject = new THREE.Object3D();
    this.pitchObject.add(camera);

    this.yawObject = new THREE.Object3D();
    this.yawObject.position.set(0, 1.7, 0); // 眼睛預設高度 1.7m
    this.yawObject.add(this.pitchObject);

    // 移動狀態
    this.moveForward = false;
    this.moveBackward = false;
    this.moveLeft = false;
    this.moveRight = false;
    this.canJump = false;
    this.isSprinting = false;

    // 物理速度與參數
    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.walkSpeed = 16.0;
    this.sprintSpeed = 28.0;
    this.jumpForce = 12.0;
    this.gravity = 30.0;

    // 水下/游泳狀態
    this.isSwimming = false;
    this.wasUnderwater = false;

    // 腳步聲計時器
    this.stepTimer = 0;

    // 建築物與障礙碰撞箱
    this.collisionObstacles = [];

    this.initEvents();
  }

  initEvents() {
    document.addEventListener('mousemove', (e) => this.onMouseMove(e), false);
    document.addEventListener('keydown', (e) => this.onKeyDown(e), false);
    document.addEventListener('keyup', (e) => this.onKeyUp(e), false);

    document.addEventListener('pointerlockchange', () => {
      this.isLocked = document.pointerLockElement === this.domElement;
      const blocker = document.getElementById('blocker');
      if (this.isLocked) {
        if (blocker) blocker.style.display = 'none';
        if (this.audio) this.audio.resume();
      } else {
        if (!this.gameState.isGameOver && blocker) {
          blocker.style.display = 'flex';
        }
      }
    }, false);
  }

  lock() {
    this.domElement.requestPointerLock();
  }

  unlock() {
    document.exitPointerLock();
  }

  getObject() {
    return this.yawObject;
  }

  onMouseMove(event) {
    if (!this.isLocked || this.gameState.isGameOver) return;

    const movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
    const movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;

    const sensitivity = 0.0022;

    this.yawObject.rotation.y -= movementX * sensitivity;
    this.pitchObject.rotation.x -= movementY * sensitivity;

    // 限制仰俯角 (-85° ~ +85°)
    const PI_2 = Math.PI / 2;
    this.pitchObject.rotation.x = Math.max(-PI_2 + 0.05, Math.min(PI_2 - 0.05, this.pitchObject.rotation.x));
  }

  onKeyDown(event) {
    if (this.gameState.isGameOver) return;

    switch (event.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.moveForward = true;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.moveLeft = true;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.moveBackward = true;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.moveRight = true;
        break;
      case 'Space':
        if (this.isSwimming) {
          // 游泳時空白鍵向上浮升
          this.velocity.y += 6.0;
        } else if (this.canJump) {
          this.velocity.y = this.jumpForce;
          this.canJump = false;
          if (this.audio) this.audio.playJump();
        }
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.isSprinting = true;
        break;
    }
  }

  onKeyUp(event) {
    switch (event.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.moveForward = false;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.moveLeft = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.moveBackward = false;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.moveRight = false;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.isSprinting = false;
        break;
    }
  }

  // 檢查是否在運河水域範圍 (X 座標在 -14 到 14 之間，Y 在水面高度 -0.2 以下)
  checkWater(pos) {
    // 運河設定：X在 -12 到 12 之間，Z在 -250 到 250
    const inCanalX = (pos.x >= -12 && pos.x <= 12 && pos.z >= -250 && pos.z <= 250);
    // 檢查是不是在橋樑上方 (橋樑高度約 Y=3.0)
    const onBridge = (pos.y > 2.0);

    if (inCanalX && !onBridge) {
      this.isSwimming = true;
      // 水面高度為 Y=0.0，如果眼睛位置低於 0.2，則進入完全潛水 (憋氣狀態)
      const isDiving = pos.y < 0.2;
      this.gameState.isUnderwater = isDiving;

      if (!this.wasUnderwater && isDiving) {
        if (this.audio) this.audio.playSplash();
      }
      this.wasUnderwater = isDiving;
      return true;
    } else {
      this.isSwimming = false;
      this.gameState.isUnderwater = false;
      this.wasUnderwater = false;
      return false;
    }
  }

  // 簡易建築物 AABB 碰撞檢測與滑動
  handleObstacleCollisions(oldPos, newPos) {
    const playerRadius = 0.5;
    for (let i = 0; i < this.collisionObstacles.length; i++) {
      const box = this.collisionObstacles[i];
      // 擴展碰撞盒以容納玩家半徑
      if (
        newPos.x > box.min.x - playerRadius &&
        newPos.x < box.max.x + playerRadius &&
        newPos.z > box.min.z - playerRadius &&
        newPos.z < box.max.z + playerRadius &&
        newPos.y < box.max.y &&
        newPos.y + 1.7 > box.min.y
      ) {
        // 沿碰撞法線阻擋
        const overlapX = Math.min(Math.abs(newPos.x - (box.min.x - playerRadius)), Math.abs(box.max.x + playerRadius - newPos.x));
        const overlapZ = Math.min(Math.abs(newPos.z - (box.min.z - playerRadius)), Math.abs(box.max.z + playerRadius - newPos.z));

        if (overlapX < overlapZ) {
          newPos.x = oldPos.x;
        } else {
          newPos.z = oldPos.z;
        }
      }
    }
  }

  update(delta) {
    if (!this.isLocked || this.gameState.isGameOver) return;

    const pos = this.yawObject.position;
    const oldPos = pos.clone();

    // 檢查水域與游泳
    this.checkWater(pos);

    // 速度衰減阻尼
    const damping = this.isSwimming ? 4.0 : 9.0;
    this.velocity.x -= this.velocity.x * damping * delta;
    this.velocity.z -= this.velocity.z * damping * delta;

    if (this.isSwimming) {
      this.velocity.y -= this.velocity.y * 3.0 * delta; // 水中浮力阻尼
    } else {
      this.velocity.y -= this.gravity * delta; // 地面重力
    }

    // 計算水平移動方向
    this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
    this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
    this.direction.normalize();

    const speed = this.isSwimming ? (this.walkSpeed * 0.55) : (this.isSprinting ? this.sprintSpeed : this.walkSpeed);

    if (this.moveForward || this.moveBackward) {
      this.velocity.z -= this.direction.z * speed * 5.0 * delta;
    }
    if (this.moveLeft || this.moveRight) {
      this.velocity.x += this.direction.x * speed * 5.0 * delta;
    }

    // 應用水平移動 (基於 YawObject 旋轉)
    this.yawObject.translateX(this.velocity.x * delta);
    this.yawObject.translateZ(this.velocity.z * delta);

    // 應用垂直位移
    this.yawObject.position.y += this.velocity.y * delta;

    // 地面/水底高度檢測
    let floorHeight = 1.7; // 地面標準眼睛高度
    if (pos.x >= -12 && pos.x <= 12 && pos.z >= -250 && pos.z <= 250 && pos.y < 2.0) {
      floorHeight = -3.5; // 運河水底深度
    }

    // 橋樑高度碰撞 (橋樑在 Z 軸每 60 米處一座)
    const isOverBridge = (Math.abs(pos.x) <= 14 && (
      Math.abs(pos.z - 0) <= 5 ||
      Math.abs(pos.z - 70) <= 5 ||
      Math.abs(pos.z + 70) <= 5 ||
      Math.abs(pos.z - 140) <= 5 ||
      Math.abs(pos.z + 140) <= 5
    ));
    if (isOverBridge) {
      floorHeight = 3.2;
    }

    if (this.yawObject.position.y <= floorHeight) {
      this.velocity.y = 0;
      this.yawObject.position.y = floorHeight;
      this.canJump = true;
    }

    // 地圖邊界防穿出 (-180 ~ +180)
    this.yawObject.position.x = Math.max(-180, Math.min(180, this.yawObject.position.x));
    this.yawObject.position.z = Math.max(-230, Math.min(230, this.yawObject.position.z));

    // 障礙物碰撞
    this.handleObstacleCollisions(oldPos, this.yawObject.position);

    // 腳步聲邏輯
    const isMoving = this.moveForward || this.moveBackward || this.moveLeft || this.moveRight;
    if (isMoving && (this.canJump || this.isSwimming)) {
      const stepInterval = this.isSprinting ? 0.3 : 0.45;
      this.stepTimer += delta;
      if (this.stepTimer >= stepInterval) {
        this.stepTimer = 0;
        if (this.audio) this.audio.playFootstep(this.isSwimming);
      }
    } else {
      this.stepTimer = 0.2;
    }
  }
}

window.FirstPersonControls = FirstPersonControls;
