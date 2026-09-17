/**
 * Controls.js
 * 第一人稱視角控制：支援 PC 鍵盤滑鼠與手機/平板直覺觸控
 * 特色：點擊物品直接拾取、點擊人物/暴徒直接發動攻擊，無須額外繁瑣按鈕
 */
class FirstPersonControls {
  constructor(camera, domElement, audioManager, gameState) {
    this.camera = camera;
    this.domElement = domElement;
    this.audio = audioManager;
    this.gameState = gameState;

    this.isLocked = false;
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                       (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    this.isTouchDevice = isMobileUA;

    // 視角旋轉物件
    this.pitchObject = new THREE.Object3D();
    this.pitchObject.add(camera);

    this.yawObject = new THREE.Object3D();
    this.yawObject.position.set(0, 1.7, 0);
    this.yawObject.add(this.pitchObject);

    // 移動狀態
    this.moveForward = false;
    this.moveBackward = false;
    this.moveLeft = false;
    this.moveRight = false;
    this.canJump = false;
    this.isSprinting = false;

    // 觸控虛擬搖桿
    this.joystickVector = { x: 0, z: 0 };
    this.joystickTouchId = null;
    this.joystickCenter = { x: 0, y: 0 };
    this.joystickRadius = 45;

    // 觸控視角與輕觸點擊檢測 (Tap vs Drag)
    this.lookTouchId = null;
    this.lastLookTouch = { x: 0, y: 0 };
    this.touchStartTime = 0;
    this.touchStartPos = { x: 0, y: 0 };

    // 速度與物理
    this.velocity = new THREE.Vector3();
    this.walkSpeed = 16.0;
    this.sprintSpeed = 28.0;
    this.jumpForce = 12.0;
    this.gravity = 30.0;

    this.isSwimming = false;
    this.wasUnderwater = false;
    this.stepTimer = 0;

    this.collisionObstacles = [];

    // 外部回調
    this.onTapWorld = null; // 點擊螢幕世界座標 (clientX, clientY)
    this.onAttackTrigger = null;
    this.onInteractTrigger = null;

    this.initEvents();
    this.initTouchControls();
  }

  initEvents() {
    document.addEventListener('mousemove', (e) => this.onMouseMove(e), false);
    document.addEventListener('keydown', (e) => this.onKeyDown(e), false);
    document.addEventListener('keyup', (e) => this.onKeyUp(e), false);

    // PC 點擊滑鼠左鍵
    this.domElement.addEventListener('mousedown', (e) => {
      if (!this.isLocked && !this.isTouchDevice && !this.gameState.isGameOver) {
        this.lock();
        return;
      }
      if (this.isLocked && e.button === 0) {
        if (this.onTapWorld) {
          this.onTapWorld(e.clientX, e.clientY);
        }
      }
    });

    // 點擊互動懸浮提示直接拾取
    const prompt = document.getElementById('interact-prompt');
    if (prompt) {
      prompt.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.onInteractTrigger) this.onInteractTrigger();
      });
      prompt.addEventListener('touchend', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.onInteractTrigger) this.onInteractTrigger();
      });
    }

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
    if (touchControls) {
      touchControls.style.display = this.isTouchDevice ? 'block' : 'none';
    }

    const desktopGuide = document.querySelector('.desktop-guide');
    const mobileGuide = document.querySelector('.mobile-guide');
    if (desktopGuide && mobileGuide) {
      if (this.isTouchDevice) {
        desktopGuide.style.display = 'none';
        mobileGuide.style.display = 'grid';
      } else {
        desktopGuide.style.display = 'grid';
        mobileGuide.style.display = 'none';
      }
    }

    // 1. 左側虛擬搖桿 (Joystick)
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

    // 2. 右側觸控板 (滑動為旋轉視角、輕按點選為點擊拾取/攻擊人物)
    const lookZone = document.getElementById('touch-look-zone');
    if (lookZone) {
      lookZone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.changedTouches[0];
        this.lookTouchId = touch.identifier;
        this.lastLookTouch = { x: touch.clientX, y: touch.clientY };
        this.touchStartPos = { x: touch.clientX, y: touch.clientY };
        this.touchStartTime = performance.now();
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
          const touch = e.changedTouches[i];
          if (touch.identifier === this.lookTouchId) {
            this.lookTouchId = null;

            // 判斷是否為輕觸點擊 (Tap)：手指移動小於 14px 且按壓時間小於 280ms
            const duration = performance.now() - this.touchStartTime;
            const moveDist = Math.hypot(touch.clientX - this.touchStartPos.x, touch.clientY - this.touchStartPos.y);

            if (duration < 280 && moveDist < 14) {
              // 觸發直接點擊 (點擊人物攻擊 / 點擊物品拾取)
              if (this.onTapWorld) {
                this.onTapWorld(touch.clientX, touch.clientY);
              }
            }
            break;
          }
        }
      };

      lookZone.addEventListener('touchend', handleLookEnd, { passive: false });
      lookZone.addEventListener('touchcancel', handleLookEnd, { passive: false });
    }

    // 3. 右側精簡輔助按鈕 (跳躍 & 奔跑)
    const btnJump = document.getElementById('btn-touch-jump');
    const btnSprint = document.getElementById('btn-touch-sprint');

    if (btnJump) {
      btnJump.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.triggerJump();
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

    this.joystickVector.x = dx / this.joystickRadius;
    this.joystickVector.z = -dy / this.joystickRadius;
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
    if (!this.isLocked || this.gameState.isGameOver) return;

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

    if (event.code === 'Space' || event.key === ' ') {
      event.preventDefault();
      this.triggerJump();
      return;
    }

    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight' || event.key === 'Shift') {
      this.isSprinting = true;
      return;
    }

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
      case 'KeyE':
        if (this.onInteractTrigger) this.onInteractTrigger();
        break;
    }
  }

  onKeyUp(event) {
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight' || event.key === 'Shift') {
      this.isSprinting = false;
      return;
    }

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

  checkPointCollision(px, py, pz) {
    const r = 0.5;
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

    const damping = this.isSwimming ? 4.0 : 10.0;
    this.velocity.x -= this.velocity.x * damping * delta;
    this.velocity.z -= this.velocity.z * damping * delta;

    if (this.isSwimming) {
      this.velocity.y -= this.velocity.y * 3.0 * delta;
    } else {
      this.velocity.y -= this.gravity * delta;
    }

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

    const yawAngle = this.yawObject.rotation.y;
    const cosY = Math.cos(yawAngle);
    const sinY = Math.sin(yawAngle);

    const worldMoveX = (cosY * this.velocity.x - sinY * this.velocity.z) * delta;
    const worldMoveZ = (-sinY * this.velocity.x - cosY * this.velocity.z) * delta;

    pos.x += worldMoveX;
    if (this.checkPointCollision(pos.x, pos.y, pos.z)) {
      pos.x -= worldMoveX;
      this.velocity.x = 0;
    }

    pos.z += worldMoveZ;
    if (this.checkPointCollision(pos.x, pos.y, pos.z)) {
      pos.z -= worldMoveZ;
      this.velocity.z = 0;
    }

    pos.y += this.velocity.y * delta;

    let floorHeight = 1.7;
    if (pos.x >= -11 && pos.x <= 11 && pos.z >= -250 && pos.z <= 250 && pos.y < 2.0) {
      floorHeight = -3.5;
    }

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

    pos.x = Math.max(-190, Math.min(190, pos.x));
    pos.z = Math.max(-240, Math.min(240, pos.z));

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
