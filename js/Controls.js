/**
 * Controls.js
 * 第一人稱視角控制：支援 PC 鍵盤滑鼠 (WASD + PointerLock) 與 手機/平板螢幕虛擬搖桿
 * 採用標準獨立軸向滑行碰撞 (Swept Slide Collision)，徹底消除卡牆、左右無法移動的問題
 */
class FirstPersonControls {
  constructor(camera, domElement, audioManager, gameState) {
    this.camera = camera;
    this.domElement = domElement;
    this.audio = audioManager;
    this.gameState = gameState;

    this.isLocked = false;
    this.isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (window.innerWidth <= 900);

    // 視角旋轉物件 (Yaw: 水平旋轉, Pitch: 仰俯角)
    this.pitchObject = new THREE.Object3D();
    this.pitchObject.add(camera);

    this.yawObject = new THREE.Object3D();
    this.yawObject.position.set(0, 1.7, 0);
    this.yawObject.add(this.pitchObject);

    // 移動狀態 (PC 鍵盤)
    this.moveForward = false;
    this.moveBackward = false;
    this.moveLeft = false;
    this.moveRight = false;
    this.canJump = false;
    this.isSprinting = false;

    // 觸控虛擬搖桿向量 (-1.0 ~ 1.0)
    this.joystickVector = { x: 0, z: 0 };
    this.joystickTouchId = null;
    this.joystickCenter = { x: 0, y: 0 };
    this.joystickRadius = 45;

    // 觸控視角滑動
    this.lookTouchId = null;
    this.lastLookTouch = { x: 0, y: 0 };

    // 物理速度與參數
    this.velocity = new THREE.Vector3(); // x: local strafe, y: vertical, z: local forward/back
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

    // 外部回調綁定 (攻擊與拾取)
    this.onAttackTrigger = null;
    this.onInteractTrigger = null;

    this.initEvents();
    this.initTouchControls();
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
        if (!this.gameState.isGameOver && blocker && !this.isTouchDevice) {
          blocker.style.display = 'flex';
        }
      }
    }, false);
  }

  initTouchControls() {
    const touchControls = document.getElementById('touch-controls');
    if (this.isTouchDevice && touchControls) {
      touchControls.style.display = 'block';
    }

    // 1. 左側虛擬搖桿 (Joystick) 觸控事件
    const joystickZone = document.getElementById('joystick-zone');
    const joystickBase = document.getElementById('joystick-base');
    const joystickStick = document.getElementById('joystick-stick');

    if (joystickZone && joystickBase && joystickStick) {
      const handleJoystickStart = (e) => {
        e.preventDefault();
        const touch = e.changedTouches[0];
        this.joystickTouchId = touch.identifier;

        const rect = joystickBase.getBoundingClientRect();
        this.joystickCenter = {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2
        };

        this.updateJoystick(touch.clientX, touch.clientY, joystickStick);
      };

      const handleJoystickMove = (e) => {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
          const touch = e.changedTouches[i];
          if (touch.identifier === this.joystickTouchId) {
            this.updateJoystick(touch.clientX, touch.clientY, joystickStick);
            break;
          }
        }
      };

      const handleJoystickEnd = (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          const touch = e.changedTouches[i];
          if (touch.identifier === this.joystickTouchId) {
            this.joystickTouchId = null;
            this.joystickVector = { x: 0, z: 0 };
            joystickStick.style.transform = `translate(0px, 0px)`;
            break;
          }
        }
      };

      joystickZone.addEventListener('touchstart', handleJoystickStart, { passive: false });
      joystickZone.addEventListener('touchmove', handleJoystickMove, { passive: false });
      joystickZone.addEventListener('touchend', handleJoystickEnd, { passive: false });
      joystickZone.addEventListener('touchcancel', handleJoystickEnd, { passive: false });
    }

    // 2. 右側滑動旋轉視角
    const lookZone = document.getElementById('touch-look-zone');
    if (lookZone) {
      lookZone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.changedTouches[0];
        this.lookTouchId = touch.identifier;
        this.lastLookTouch = { x: touch.clientX, y: touch.clientY };
      }, { passive: false });

      lookZone.addEventListener('touchmove', (e) => {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
          const touch = e.changedTouches[i];
          if (touch.identifier === this.lookTouchId) {
            const deltaX = touch.clientX - this.lastLookTouch.x;
            const deltaY = touch.clientY - this.lastLookTouch.y;

            this.lastLookTouch = { x: touch.clientX, y: touch.clientY };

            const sensitivity = 0.005;
            this.yawObject.rotation.y -= deltaX * sensitivity;
            this.pitchObject.rotation.x -= deltaY * sensitivity;

            const PI_2 = Math.PI / 2;
            this.pitchObject.rotation.x = Math.max(-PI_2 + 0.05, Math.min(PI_2 - 0.05, this.pitchObject.rotation.x));
            break;
          }
        }
      }, { passive: false });

      const handleLookEnd = (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === this.lookTouchId) {
            this.lookTouchId = null;
            break;
          }
        }
      };
      lookZone.addEventListener('touchend', handleLookEnd, { passive: false });
      lookZone.addEventListener('touchcancel', handleLookEnd, { passive: false });
    }

    // 3. 觸控動作按鈕
    const btnAttack = document.getElementById('btn-touch-attack');
    const btnJump = document.getElementById('btn-touch-jump');
    const btnInteract = document.getElementById('btn-touch-interact');
    const btnSprint = document.getElementById('btn-touch-sprint');

    if (btnAttack) {
      btnAttack.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (this.onAttackTrigger) this.onAttackTrigger();
      }, { passive: false });
    }

    if (btnJump) {
      btnJump.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.triggerJump();
      }, { passive: false });
    }

    if (btnInteract) {
      btnInteract.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (this.onInteractTrigger) this.onInteractTrigger();
      }, { passive: false });
    }

    if (btnSprint) {
      btnSprint.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.isSprinting = !this.isSprinting;
        btnSprint.classList.toggle('active', this.isSprinting);
      }, { passive: false });
    }
  }

  updateJoystick(clientX, clientY, stickElement) {
    let dx = clientX - this.joystickCenter.x;
    let dy = clientY - this.joystickCenter.y;
    const distance = Math.hypot(dx, dy);

    if (distance > this.joystickRadius) {
      dx = (dx / distance) * this.joystickRadius;
      dy = (dy / distance) * this.joystickRadius;
    }

    stickElement.style.transform = `translate(${dx}px, ${dy}px)`;

    // 正規化 (-1.0 ~ 1.0)
    this.joystickVector.x = dx / this.joystickRadius;
    this.joystickVector.z = -dy / this.joystickRadius; // 向上為正前 (+Z)
  }

  triggerJump() {
    if (this.isSwimming) {
      this.velocity.y += 6.0;
    } else if (this.canJump) {
      this.velocity.y = this.jumpForce;
      this.canJump = false;
      if (this.audio) this.audio.playJump();
    }
  }

  lock() {
    if (!this.isTouchDevice) {
      this.domElement.requestPointerLock();
    } else {
      this.isLocked = true;
      const blocker = document.getElementById('blocker');
      if (blocker) blocker.style.display = 'none';
    }
  }

  unlock() {
    if (document.exitPointerLock) {
      document.exitPointerLock();
    }
    this.isLocked = false;
  }

  getObject() {
    return this.yawObject;
  }

  onMouseMove(event) {
    if (!this.isLocked || this.gameState.isGameOver || this.isTouchDevice) return;

    const movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
    const movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;

    const sensitivity = 0.0022;

    this.yawObject.rotation.y -= movementX * sensitivity;
    this.pitchObject.rotation.x -= movementY * sensitivity;

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
        this.triggerJump();
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

  checkWater(pos) {
    const inCanalX = (pos.x >= -11 && pos.x <= 11 && pos.z >= -250 && pos.z <= 250);
    const onBridge = (pos.y > 2.0);

    if (inCanalX && !onBridge) {
      this.isSwimming = true;
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

  // 障礙物碰撞檢測
  checkPointCollision(px, py, pz) {
    const r = 0.5; // 玩家半徑
    for (let i = 0; i < this.collisionObstacles.length; i++) {
      const box = this.collisionObstacles[i];
      if (
        px > box.min.x - r &&
        px < box.max.x + r &&
        pz > box.min.z - r &&
        pz < box.max.z + r &&
        py < box.max.y &&
        py + 1.7 > box.min.y
      ) {
        return true;
      }
    }
    return false;
  }

  update(delta) {
    if ((!this.isLocked && !this.isTouchDevice) || this.gameState.isGameOver) return;

    const pos = this.yawObject.position;

    this.checkWater(pos);

    // 速度衰減阻尼
    const damping = this.isSwimming ? 4.0 : 10.0;
    this.velocity.x -= this.velocity.x * damping * delta;
    this.velocity.z -= this.velocity.z * damping * delta;

    if (this.isSwimming) {
      this.velocity.y -= this.velocity.y * 3.0 * delta;
    } else {
      this.velocity.y -= this.gravity * delta;
    }

    // 計算水平輸入向量 (Z: 前後, X: 左右)
    let forwardInput = (Number(this.moveForward) - Number(this.moveBackward)) + this.joystickVector.z;
    let rightInput = (Number(this.moveRight) - Number(this.moveLeft)) + this.joystickVector.x;

    const inputLen = Math.hypot(rightInput, forwardInput);
    if (inputLen > 1.0) {
      rightInput /= inputLen;
      forwardInput /= inputLen;
    }

    const speed = this.isSwimming ? (this.walkSpeed * 0.55) : (this.isSprinting ? this.sprintSpeed : this.walkSpeed);

    if (Math.abs(forwardInput) > 0.01) {
      this.velocity.z += forwardInput * speed * 6.0 * delta;
    }
    if (Math.abs(rightInput) > 0.01) {
      this.velocity.x += rightInput * speed * 6.0 * delta;
    }

    // 取得當前面向方向的世界向量
    const yawAngle = this.yawObject.rotation.y;
    const cosY = Math.cos(yawAngle);
    const sinY = Math.sin(yawAngle);

    // 將區域速度 (velocity.x: 右, velocity.z: 前) 轉換為世界座標位移
    // forward vector in world: (-sinY, -cosY)
    // right vector in world: (cosY, -sinY)
    const worldMoveX = (cosY * this.velocity.x - sinY * this.velocity.z) * delta;
    const worldMoveZ = (-sinY * this.velocity.x - cosY * this.velocity.z) * delta;

    // 分軸滑行碰撞 (X 軸獨立位移與檢測)
    pos.x += worldMoveX;
    if (this.checkPointCollision(pos.x, pos.y, pos.z)) {
      pos.x -= worldMoveX; // 撞牆回退 X，允許沿 Z 軸滑行
      this.velocity.x = 0;
    }

    // Z 軸獨立位移與檢測
    pos.z += worldMoveZ;
    if (this.checkPointCollision(pos.x, pos.y, pos.z)) {
      pos.z -= worldMoveZ; // 撞牆回退 Z，允許沿 X 軸滑行
      this.velocity.z = 0;
    }

    // 垂直位移
    pos.y += this.velocity.y * delta;

    // 地面/水底高度檢測
    let floorHeight = 1.7;
    if (pos.x >= -11 && pos.x <= 11 && pos.z >= -250 && pos.z <= 250 && pos.y < 2.0) {
      floorHeight = -3.5;
    }

    // 跨河大橋判定 (Z 軸 -140, -70, 0, 70, 140)
    const bridgeZs = [-140, -70, 0, 70, 140];
    const isOverBridge = bridgeZs.some(bz => Math.abs(pos.x) <= 13 && Math.abs(pos.z - bz) <= 7);
    if (isOverBridge) {
      floorHeight = 3.2;
    }

    if (pos.y <= floorHeight) {
      this.velocity.y = 0;
      pos.y = floorHeight;
      this.canJump = true;
    }

    // 地圖邊界防穿出
    pos.x = Math.max(-190, Math.min(190, pos.x));
    pos.z = Math.max(-240, Math.min(240, pos.z));

    // 腳步聲
    const isMoving = (Math.abs(rightInput) > 0.1 || Math.abs(forwardInput) > 0.1);
    if (isMoving && (this.canJump || this.isSwimming)) {
      const stepInterval = this.isSprinting ? 0.28 : 0.42;
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
