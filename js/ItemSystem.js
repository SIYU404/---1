/**
 * ItemSystem.js
 * 物資道具搜刮系統：包含醫療繃帶、專業急救箱、招牌拉麵、各類食物與武器掉落，支援室內精準刷新與按 E 拾取
 */
class ItemSystem {
  constructor(scene, gameState, audioManager) {
    this.scene = scene;
    this.gameState = gameState;
    this.audio = audioManager;
    this.items = [];
    this.currentNearbyItem = null;

    this.bindEvents();
  }

  initSpawns(outdoorPoints, indoorPoints = []) {
    // 1. 室外隨機生成
    outdoorPoints.forEach(pt => {
      if (Math.random() > 0.35) {
        const rand = Math.random();
        if (rand < 0.45) {
          this.spawnFoodItem(pt);
        } else if (rand < 0.75) {
          this.spawnMedicalItem(pt);
        } else {
          this.spawnWeaponItem(pt);
        }
      }
    });

    // 2. 室內特色建築必定刷新專屬物資
    indoorPoints.forEach(item => {
      if (item.type === 'food') {
        this.spawnFoodItem(item.pos);
      } else if (item.type === 'med') {
        this.spawnMedicalItem(item.pos, 'bandage');
      } else if (item.type === 'med_large') {
        this.spawnMedicalItem(item.pos, 'medkit');
      } else if (item.type === 'ramen') {
        this.spawnRamenItem(item.pos);
      } else if (item.type === 'weapon') {
        this.spawnWeaponItem(item.pos);
      }
    });
  }

  bindEvents() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyE' && this.currentNearbyItem) {
        this.pickupItem(this.currentNearbyItem);
      }
    });
  }

  // 醫療補血用品 (繃帶 / 急救箱 / 止痛藥)
  spawnMedicalItem(pos, forceType = null) {
    const medTypes = [
      { id: 'bandage', name: '無菌急救繃帶', icon: '🩹', heal: 35, color: 0x10b981, type: 'med' },
      { id: 'medkit', name: '專業急救醫療箱', icon: '🧰', heal: 75, color: 0x059669, type: 'med' },
      { id: 'painkiller', name: '強效止痛消炎藥', icon: '💊', heal: 25, color: 0x34d399, type: 'med' }
    ];

    let med = medTypes[0];
    if (forceType === 'medkit') med = medTypes[1];
    else if (forceType === 'bandage') med = medTypes[0];
    else med = medTypes[Math.floor(Math.random() * medTypes.length)];

    const group = new THREE.Group();

    if (med.id === 'medkit') {
      // 醫療箱 3D 模型 (帶有十字圖標的綠白急救箱)
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.35, 0.3),
        new THREE.MeshLambertMaterial({ color: 0xffffff })
      );
      group.add(box);

      const crossH = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.08, 0.31),
        new THREE.MeshBasicMaterial({ color: 0x10b981 })
      );
      group.add(crossH);

      const crossV = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.24, 0.31),
        new THREE.MeshBasicMaterial({ color: 0x10b981 })
      );
      group.add(crossV);
    } else {
      // 繃帶/藥丸 3D 模型
      const cylinder = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, 0.28, 12),
        new THREE.MeshStandardMaterial({ color: med.color, emissive: med.color, emissiveIntensity: 0.5 })
      );
      cylinder.rotation.z = Math.PI / 4;
      group.add(cylinder);
    }

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.025, 8, 20),
      new THREE.MeshBasicMaterial({ color: med.color })
    );
    ring.rotation.x = Math.PI / 2;
    group.add(ring);

    group.position.copy(pos);
    this.scene.add(group);

    this.items.push({
      mesh: group,
      data: med,
      pos: pos,
      rotSpeed: 2.2
    });
  }

  // 特色拉麵道具
  spawnRamenItem(pos) {
    const ramenData = { name: '招牌豚骨叉燒拉麵', icon: '🍜', hunger: 55, heal: 35, color: 0xf43f5e, type: 'food' };
    const group = new THREE.Group();

    const bowl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.18, 0.22, 12),
      new THREE.MeshLambertMaterial({ color: 0xdc2626 })
    );
    group.add(bowl);

    const noodle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.28, 0.05, 12),
      new THREE.MeshLambertMaterial({ color: 0xfef08a })
    );
    noodle.position.y = 0.09;
    group.add(noodle);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.025, 8, 20),
      new THREE.MeshBasicMaterial({ color: 0xf43f5e })
    );
    ring.rotation.x = Math.PI / 2;
    group.add(ring);

    group.position.copy(pos);
    this.scene.add(group);

    this.items.push({
      mesh: group,
      data: ramenData,
      pos: pos,
      rotSpeed: 2.0
    });
  }

  // 一般街頭食物
  spawnFoodItem(pos) {
    const foodTypes = [
      { name: '熱騰騰披薩', icon: '🍕', hunger: 35, heal: 15, color: 0xf59e0b, type: 'food' },
      { name: '美式牛肉漢堡', icon: '🍔', hunger: 40, heal: 20, color: 0xb45309, type: 'food' },
      { name: '街頭熱狗堡', icon: '🌭', hunger: 30, heal: 12, color: 0xef4444, type: 'food' },
      { name: '高能能量飲料', icon: '🥤', hunger: 25, heal: 25, color: 0x06b6d4, type: 'food' },
      { name: '新鮮紅蘋果', icon: '🍎', hunger: 18, heal: 10, color: 0xdc2626, type: 'food' }
    ];

    const food = foodTypes[Math.floor(Math.random() * foodTypes.length)];
    const group = new THREE.Group();

    const gemGeo = new THREE.OctahedronGeometry(0.28, 0);
    const gemMat = new THREE.MeshStandardMaterial({
      color: food.color,
      emissive: food.color,
      emissiveIntensity: 0.5,
      roughness: 0.2
    });
    const gem = new THREE.Mesh(gemGeo, gemMat);
    group.add(gem);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.38, 0.025, 8, 20),
      new THREE.MeshBasicMaterial({ color: food.color })
    );
    ring.rotation.x = Math.PI / 2;
    group.add(ring);

    group.position.copy(pos);
    this.scene.add(group);

    this.items.push({
      mesh: group,
      data: food,
      pos: pos,
      rotSpeed: 2.0 + Math.random()
    });
  }

  // 武器道具
  spawnWeaponItem(pos) {
    const weaponTypes = [
      { id: 'bat', name: '木製棒球棍', icon: '🏏', color: 0xd97706, type: 'weapon' },
      { id: 'crowbar', name: '鋼製鐵撬', icon: '🪓', color: 0xef4444, type: 'weapon' },
      { id: 'pistol', name: '9mm 手槍 + 彈匣', icon: '🔫', color: 0x38bdf8, ammo: 14, type: 'weapon' }
    ];

    const wpn = weaponTypes[Math.floor(Math.random() * weaponTypes.length)];
    const group = new THREE.Group();

    const boxGeo = new THREE.BoxGeometry(0.5, 0.15, 0.5);
    const boxMat = new THREE.MeshStandardMaterial({
      color: wpn.color,
      emissive: wpn.color,
      emissiveIntensity: 0.6
    });
    const box = new THREE.Mesh(boxGeo, boxMat);
    group.add(box);

    group.position.copy(pos);
    this.scene.add(group);

    this.items.push({
      mesh: group,
      data: wpn,
      pos: pos,
      rotSpeed: 2.5
    });
  }

  pickupItem(item) {
    if (!item) return;

    if (item.data.type === 'food') {
      this.gameState.eatFood(item.data);
      if (window.uiManager) {
        window.uiManager.addLog(`😋 食用了 ${item.data.name} (+${item.data.hunger}% 飽足, +${item.data.heal || 0} HP)`, 'success');
      }
    } else if (item.data.type === 'med') {
      this.gameState.heal(item.data.heal, item.data.name);
    } else if (item.data.type === 'weapon') {
      this.gameState.equipWeapon(item.data.id, item.data.ammo || 0);
      if (window.uiManager) {
        window.uiManager.addLog(`⚔️ 拾取並裝備了 ${item.data.name}`, 'warning');
      }
    }

    this.scene.remove(item.mesh);
    const idx = this.items.indexOf(item);
    if (idx !== -1) this.items.splice(idx, 1);

    this.currentNearbyItem = null;
    const prompt = document.getElementById('interact-prompt');
    if (prompt) prompt.style.display = 'none';
  }

  update(delta, playerPos) {
    let nearest = null;
    let minDist = 3.0;

    const time = performance.now() / 1000;

    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      item.mesh.rotation.y += item.rotSpeed * delta;
      item.mesh.position.y = item.pos.y + Math.sin(time * 3.5 + i) * 0.1;

      const d = item.mesh.position.distanceTo(playerPos);
      if (d < minDist) {
        minDist = d;
        nearest = item;
      }
    }

    this.currentNearbyItem = nearest;
    const prompt = document.getElementById('interact-prompt');
    const promptText = document.getElementById('prompt-text');
    const crosshair = document.getElementById('crosshair');

    if (nearest && prompt && promptText) {
      prompt.style.display = 'block';
      if (nearest.data.type === 'food') {
        promptText.textContent = `拾取 ${nearest.data.icon} ${nearest.data.name} (+${nearest.data.hunger}% 飽足, +${nearest.data.heal} HP)`;
      } else if (nearest.data.type === 'med') {
        promptText.textContent = `使用 ${nearest.data.icon} ${nearest.data.name} (+${nearest.data.heal} HP 補血)`;
      } else {
        promptText.textContent = `裝備 ${nearest.data.icon} ${nearest.data.name}`;
      }
      if (crosshair) crosshair.classList.add('crosshair-interact');
    } else {
      if (prompt) prompt.style.display = 'none';
      if (crosshair) crosshair.classList.remove('crosshair-interact');
    }
  }

  getItemPositions() {
    return this.items.map(i => ({
      pos: i.mesh.position,
      isFood: i.data.type === 'food',
      isMed: i.data.type === 'med'
    }));
  }
}

window.ItemSystem = ItemSystem;
