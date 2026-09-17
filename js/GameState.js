/**
 * GameState.js
 * 核心遊戲狀態管理模組，統籌生理指標、武器清單、傷害判定與生存計時
 */
class GameState {
  constructor(audioManager) {
    this.audio = audioManager;

    // 生存指標
    this.maxHp = 100;
    this.hp = 100;

    this.maxHunger = 100;
    this.hunger = 100; // 飽足度
    this.hungerDecayRate = 0.6; // 每秒扣除飽足感

    this.maxOxygen = 60.0; // 閉氣時間 60 秒
    this.oxygen = 60.0;
    this.isUnderwater = false;

    // 武器系統
    this.weapons = {
      fist: { id: 'fist', name: '赤手空拳', icon: '👊', damage: 15, range: 2.8, cooldown: 0.4, type: 'melee', ammo: Infinity },
      bat: { id: 'bat', name: '棒球棍', icon: '🏏', damage: 38, range: 3.5, cooldown: 0.55, type: 'melee', ammo: Infinity },
      crowbar: { id: 'crowbar', name: '鋼製鐵撬', icon: '🪓', damage: 45, range: 3.2, cooldown: 0.45, type: 'melee', ammo: Infinity },
      pistol: { id: 'pistol', name: '9mm 手槍', icon: '🔫', damage: 70, range: 50, cooldown: 0.35, type: 'ranged', ammo: 24 }
    };
    this.currentWeaponId = 'fist';
    this.lastAttackTime = 0;

    // 統計數據
    this.survivalTime = 0; // 秒
    this.kills = 0;
    this.foodCollected = 0;
    this.isGameOver = false;
    this.deathCause = '';

    // 受傷無敵硬直 (避免連續多重碰撞暴斃)
    this.invulnerableTimer = 0;

    // 飢餓扣血定時器
    this.starveDamageTimer = 0;
  }

  reset() {
    this.hp = 100;
    this.hunger = 100;
    this.oxygen = 60.0;
    this.isUnderwater = false;
    this.currentWeaponId = 'fist';
    this.weapons.pistol.ammo = 18;
    this.survivalTime = 0;
    this.kills = 0;
    this.foodCollected = 0;
    this.isGameOver = false;
    this.deathCause = '';
    this.invulnerableTimer = 0;
  }

  getCurrentWeapon() {
    return this.weapons[this.currentWeaponId] || this.weapons.fist;
  }

  equipWeapon(weaponId, bonusAmmo = 0) {
    if (this.weapons[weaponId]) {
      this.currentWeaponId = weaponId;
      if (bonusAmmo > 0 && weaponId === 'pistol') {
        this.weapons.pistol.ammo += bonusAmmo;
      }
      if (this.audio) this.audio.playPickup();
      return true;
    }
    return false;
  }

  eatFood(food) {
    if (this.isGameOver) return;
    this.hunger = Math.min(this.maxHunger, this.hunger + (food.hunger || 25));
    this.hp = Math.min(this.maxHp, this.hp + (food.heal || 10));
    this.foodCollected++;
    if (this.audio) this.audio.playEat();
  }

  takeDamage(amount, cause = '受到不明傷害') {
    if (this.isGameOver || this.invulnerableTimer > 0) return false;

    this.hp -= amount;
    this.invulnerableTimer = 0.35; // 0.35秒無敵間隔

    if (this.audio) this.audio.playHurt();

    // 觸發受傷紅屏閃爍
    const overlay = document.getElementById('damage-overlay');
    if (overlay) {
      overlay.style.opacity = '1';
      setTimeout(() => {
        overlay.style.opacity = '0';
      }, 150);
    }

    if (this.hp <= 0) {
      this.hp = 0;
      this.triggerGameOver(cause);
    }
    return true;
  }

  triggerGameOver(cause) {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.deathCause = cause;
    if (this.audio) this.audio.playGameOver();

    // 解除指針鎖定並彈出 Game Over
    if (document.exitPointerLock) {
      document.exitPointerLock();
    }

    const modal = document.getElementById('game-over-modal');
    const causeText = document.getElementById('death-cause-text');
    const statsBox = document.getElementById('game-over-stats');

    if (causeText) causeText.textContent = `死因：${cause}`;
    if (statsBox) {
      const minutes = Math.floor(this.survivalTime / 60);
      const seconds = Math.floor(this.survivalTime % 60);
      statsBox.innerHTML = `
        存活時間：<strong>${minutes}分 ${seconds < 10 ? '0' : ''}${seconds}秒</strong><br>
        擊敗危險暴徒：<strong>${this.kills} 人</strong><br>
        搜刮食物物資：<strong>${this.foodCollected} 份</strong>
      `;
    }
    if (modal) modal.style.display = 'flex';
  }

  update(delta) {
    if (this.isGameOver) return;

    this.survivalTime += delta;

    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer -= delta;
    }

    // 1. 飽足感消耗與飢餓扣血
    this.hunger -= this.hungerDecayRate * delta;
    if (this.hunger <= 0) {
      this.hunger = 0;
      this.starveDamageTimer += delta;
      if (this.starveDamageTimer >= 1.5) { // 每 1.5 秒餓扣 6 HP
        this.starveDamageTimer = 0;
        this.takeDamage(6, '極度飢餓，體力不支餓死');
      }
    } else {
      this.starveDamageTimer = 0;
    }

    // 2. 水中閉氣系統 (限時 60 秒)
    if (this.isUnderwater) {
      this.oxygen -= delta;
      if (this.oxygen <= 0) {
        this.oxygen = 0;
        // 溺水每秒扣除 18 HP
        this.takeDamage(18 * delta, '水下閉氣超過 60 秒溺斃');
      }
    } else {
      // 浮出水面快速回氧 (每秒恢復 25 秒)
      if (this.oxygen < this.maxOxygen) {
        this.oxygen = Math.min(this.maxOxygen, this.oxygen + 25 * delta);
      }
    }
  }
}

window.GameState = GameState;
