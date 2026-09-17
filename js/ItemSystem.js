/**
 * ItemSystem.js
 * 物資道具搜刮系統：包含建築內外隨機食物刷新、武器掉落、浮動旋轉模型與按 E 拾取
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

  initSpawns(spawnPoints) {
    // 在建築物門口、暗巷隨機生成物資
    spawnPoints.forEach(pt => {
      if (Math.random() > 0.35) {
        if (Math.random() > 0.3) {
          this.spawnFoodItem(pt);
        } else {
          this.spawnWeaponItem(pt);
        }
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

  spawnFoodItem(pos) {
    const foodTypes = [
      { name: '熱騰騰披薩', icon: '🍕', hunger: 35, heal: 15, color: 0xf59e0b, type: 'food' },
      { name: '美式牛肉漢堡', icon: '🍔', hunger: 40, heal: 20, color: 0xb45309, type: 'food' },
      { name: '街頭熱狗堡', icon: '🌭', hunger: 30, heal: 10, color: 0xef4444, type: 'food' },
      { name: '高能能量飲料', icon: '🥤', hunger: 25, heal: 25, color: 0x06b6d4, type: 'food' },
      { name: '新鮮紅蘋果', icon: '🍎', hunger: 18, heal: 10, color: 0xdc2626, type: 'food' }
    ];

    const food = foodTypes[Math.floor(Math.random() * foodTypes.length)];
    const group = new THREE.Group();

    // 道具 3D 幾何 (八面晶體 + 發光環)
    const gemGeo = new THREE.OctahedronGeometry(0.3, 0);
    const gemMat = new THREE.MeshStandardMaterial({
      color: food.color,
      emissive: food.color,
      emissiveIntensity: 0.5,
      roughness: 0.2
    });
    const gem = new THREE.Mesh(gemGeo, gemMat);
    group.add(gem);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.4, 0.025, 8, 20),
      new THREE.MeshBasicMaterial({ color: food.color })
    );
    ring.rotation.x = Math.PI / 2;
    group.add(ring);

    group.position.copy(pos);
    this.scene.add(group);

    const itemData = {
      mesh: group,
      data: food,
      pos: pos,
      rotSpeed: 2.0 + Math.random()
    };
    this.items.push(itemData);
  }

  spawnWeaponItem(pos) {
    const weaponTypes = [
      { id: 'bat', name: '木製棒球棍', icon: '🏏', color: 0xd97706, type: 'weapon' },
      { id: 'crowbar', name: '鋼製鐵撬', icon: '🪓', color: 0xef4444, type: 'weapon' },
      { id: 'pistol', name: '9mm 手槍 + 彈匣', icon: '🔫', color: 0x38bdf8, ammo: 12, type: 'weapon' }
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

    const itemData = {
      mesh: group,
      data: wpn,
      pos: pos,
      rotSpeed: 2.5
    };
    this.items.push(itemData);
  }

  pickupItem(item) {
    if (!item) return;

    if (item.data.type === 'food') {
      this.gameState.eatFood(item.data);
      if (window.uiManager) {
        window.uiManager.addLog(`😋 食用了 ${item.data.name} (+${item.data.hunger}% 飽足)`, 'success');
      }
    } else if (item.data.type === 'weapon') {
      this.gameState.equipWeapon(item.data.id, item.data.ammo || 0);
      if (window.uiManager) {
        window.uiManager.addLog(`⚔️ 拾取並裝備了 ${item.data.name}`, 'warning');
      }
    }

    // 移除模型
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
      // 懸浮與自轉
      item.mesh.rotation.y += item.rotSpeed * delta;
      item.mesh.position.y = item.pos.y + Math.sin(time * 3.5 + i) * 0.12;

      // 距離檢測
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
        promptText.textContent = `拾取 ${nearest.data.icon} ${nearest.data.name} (+${nearest.data.hunger}% 飽足)`;
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
    return this.items.map(i => ({ pos: i.mesh.position, isFood: i.data.type === 'food' }));
  }
}

window.ItemSystem = ItemSystem;
