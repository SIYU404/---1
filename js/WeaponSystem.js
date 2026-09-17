/**
 * WeaponSystem.js
 * 第一人稱手部/武器視角模型渲染、攻擊揮擊與射擊動畫、命中判定與打擊火花
 * 支援中央準星攻擊與螢幕直接點選目標發動攻擊
 */
class WeaponSystem {
  constructor(camera, scene, gameState, audioManager, npcSystem) {
    this.camera = camera;
    this.scene = scene;
    this.gameState = gameState;
    this.audio = audioManager;
    this.npcSystem = npcSystem;

    // 武器 Viewmodel 容器
    this.weaponRoot = new THREE.Group();
    this.camera.add(this.weaponRoot);

    // 武器模型物件
    this.weaponMeshes = {};
    this.currentModel = null;

    // 動畫參數
    this.isAttacking = false;
    this.attackProgress = 0;
    this.attackDuration = 0.25;
    this.bobbingTimer = 0;

    // 槍口火花
    this.muzzleFlash = null;
    this.muzzleTimer = 0;

    this.createWeaponModels();
  }

  createWeaponModels() {
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xfbcfe8 });
    const sleeveMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
    const woodMat = new THREE.MeshLambertMaterial({ color: 0xb45309 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.2 });
    const redMat = new THREE.MeshLambertMaterial({ color: 0xef4444 });
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x0f172a });

    // 1. 赤手空拳 (Fist)
    const fistGroup = new THREE.Group();
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.4), sleeveMat);
    arm.rotation.x = Math.PI / 3;
    arm.position.set(0.24, -0.22, -0.45);
    fistGroup.add(arm);

    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.14), skinMat);
    hand.position.set(0.25, -0.12, -0.55);
    fistGroup.add(hand);
    this.weaponMeshes.fist = fistGroup;

    // 2. 棒球棍 (Bat)
    const batGroup = new THREE.Group();
    batGroup.add(fistGroup.clone());
    const bat = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.025, 0.9, 12), woodMat);
    bat.rotation.x = -Math.PI / 3;
    bat.rotation.z = -0.2;
    bat.position.set(0.26, 0.05, -0.6);
    batGroup.add(bat);
    this.weaponMeshes.bat = batGroup;

    // 3. 鋼製鐵撬 (Crowbar)
    const crowbarGroup = new THREE.Group();
    crowbarGroup.add(fistGroup.clone());
    const crowbar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 8), redMat);
    crowbar.rotation.x = -Math.PI / 3.2;
    crowbar.rotation.z = -0.15;
    crowbar.position.set(0.26, 0.02, -0.55);
    crowbarGroup.add(crowbar);

    const crowbarTip = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.02, 8, 12, Math.PI / 1.5), metalMat);
    crowbarTip.position.set(0.26, 0.28, -0.72);
    crowbarGroup.add(crowbarTip);
    this.weaponMeshes.crowbar = crowbarGroup;

    // 4. 9mm 手槍 (Pistol)
    const pistolGroup = new THREE.Group();
    pistolGroup.add(fistGroup.clone());
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.3), darkMat);
    slide.position.set(0.25, -0.05, -0.55);
    pistolGroup.add(slide);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.08), metalMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0.25, -0.04, -0.72);
    pistolGroup.add(barrel);
    this.weaponMeshes.pistol = pistolGroup;

    // 槍口閃光燈
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xfff08a, transparent: true, opacity: 0.9 });
    this.muzzleFlash = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), flashMat);
    this.muzzleFlash.position.set(0.25, -0.04, -0.78);
    this.muzzleFlash.visible = false;
    this.weaponRoot.add(this.muzzleFlash);

    // 初始隱藏所有武器模型
    Object.values(this.weaponMeshes).forEach(m => {
      m.visible = false;
      this.weaponRoot.add(m);
    });

    this.updateActiveWeaponModel();
  }

  updateActiveWeaponModel() {
    const activeId = this.gameState.currentWeaponId;
    Object.keys(this.weaponMeshes).forEach(id => {
      this.weaponMeshes[id].visible = (id === activeId);
    });
    this.currentModel = this.weaponMeshes[activeId] || this.weaponMeshes.fist;
  }

  performAttack(customRaycaster = null) {
    if (this.isAttacking || this.gameState.isGameOver) return;

    const weapon = this.gameState.getCurrentWeapon();
    const now = performance.now() / 1000;

    if (now - this.gameState.lastAttackTime < weapon.cooldown) return;
    this.gameState.lastAttackTime = now;

    // 槍械子彈檢查
    if (weapon.type === 'ranged') {
      if (weapon.ammo <= 0) {
        if (this.audio) this.audio.playFootstep();
        return;
      }
      weapon.ammo--;
      if (this.audio) this.audio.playGunfire();

      if (this.muzzleFlash) {
        this.muzzleFlash.visible = true;
        this.muzzleTimer = 0.08;
      }
    } else {
      if (this.audio) this.audio.playSwing();
    }

    this.isAttacking = true;
    this.attackProgress = 0;
    this.attackDuration = weapon.cooldown * 0.7;

    // 執行命中判定
    this.executeHitCheck(weapon, customRaycaster);
  }

  executeHitCheck(weapon, customRaycaster = null) {
    let raycaster = customRaycaster;
    if (!raycaster) {
      raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    }

    // 檢測是否命中 NPC
    const hitTarget = this.npcSystem.checkHit(raycaster, weapon.range, weapon.damage);

    if (hitTarget) {
      if (this.audio) this.audio.playHit();

      // 準星命中反饋紅光
      const crosshair = document.getElementById('crosshair');
      if (crosshair) {
        crosshair.classList.add('crosshair-hit');
        setTimeout(() => crosshair.classList.remove('crosshair-hit'), 140);
      }
    }
  }

  update(delta, isMoving) {
    this.updateActiveWeaponModel();

    if (this.muzzleTimer > 0) {
      this.muzzleTimer -= delta;
      if (this.muzzleTimer <= 0 && this.muzzleFlash) {
        this.muzzleFlash.visible = false;
      }
    }

    // 走路晃動
    if (isMoving && !this.isAttacking) {
      this.bobbingTimer += delta * 12;
      this.weaponRoot.position.x = Math.sin(this.bobbingTimer * 0.5) * 0.015;
      this.weaponRoot.position.y = Math.abs(Math.sin(this.bobbingTimer)) * 0.012;
    } else if (!this.isAttacking) {
      this.weaponRoot.position.set(0, 0, 0);
    }

    // 攻擊動作動畫
    if (this.isAttacking) {
      this.attackProgress += delta / this.attackDuration;
      const progress = this.attackProgress;

      if (progress >= 1.0) {
        this.isAttacking = false;
        this.weaponRoot.rotation.set(0, 0, 0);
        this.weaponRoot.position.set(0, 0, 0);
      } else {
        const weapon = this.gameState.getCurrentWeapon();
        if (weapon.type === 'melee') {
          const swing = Math.sin(progress * Math.PI);
          this.weaponRoot.rotation.x = swing * 0.45;
          this.weaponRoot.rotation.y = -swing * 0.35;
          this.weaponRoot.position.z = swing * 0.12;
        } else {
          const recoil = Math.sin(progress * Math.PI);
          this.weaponRoot.rotation.x = recoil * 0.3;
          this.weaponRoot.position.z = recoil * 0.08;
        }
      }
    }
  }
}

window.WeaponSystem = WeaponSystem;
