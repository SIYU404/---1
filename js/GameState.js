/**
 * GameState.js
 * 核心遊戲狀態管理模組：支援生理指標、治療補血、擊殺吸血回復、武器清單與生存計時
 */
class GameState {
  constructor(audioManager) {
    this.audio = audioManager;

    // 生存指標
    this.maxHp = 100;
    this.hp = 100;

    this.maxHunger = 100;
    this.hunger = 100;
    this.hungerDecayRate = 0.1; // 每秒扣除飽足感 (10秒扣除1%)

    this.maxOxygen = 60.0;
    this.oxygen = 60.0;
    this.isUnderwater = false;

    // 武器系統
    this.weapons = {
      fist:    { id: 'fist',    name: '赤手空拳',   icon: '👊', damage: 18, range: 2.8, cooldown: 0.38, type: 'melee',  ammo: Infinity },
      bat:     { id: 'bat',     name: '棒球棍',     icon: '🏏', damage: 42, range: 3.5, cooldown: 0.5,  type: 'melee',  ammo: Infinity },
      crowbar: { id: 'crowbar', name: '鋼製鐵撬',   icon: '🪓', damage: 48, range: 3.2, cooldown: 0.42, type: 'melee',  ammo: Infinity },
      pistol:  { id: 'pistol',  name: '9mm 手槍',  icon: '🔫', damage: 75, range: 50,  cooldown: 0.35, type: 'ranged', ammo: 24 }
    };
    this.weaponOrder = ['fist', 'bat', 'crowbar', 'pistol']; // 切換順序
    this.ownedWeapons = new Set(['fist']); // 已擁有的武器 (拳頭預設)
    this.currentWeaponId = 'fist';
    this.lastAttackTime = 0;

    // 統計數據
    this.survivalTime = 0;
    this.kills = 0;
    this.foodCollected = 0;
    this.medsUsed = 0;
    this.isGameOver = false;
    this.deathCause = '';

    // 受傷無敵硬直
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
    this.ownedWeapons = new Set(['fist']);
    this.weapons.pistol.ammo = 18;
    this.survivalTime = 0;
    this.kills = 0;
    this.foodCollected = 0;
    this.medsUsed = 0;
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
      this.ownedWeapons.add(weaponId); // 記錄已擁有
      if (bonusAmmo > 0 && weaponId === 'pistol') {
        this.weapons.pistol.ammo += bonusAmmo;
      }
      if (this.audio) this.audio.playPickup();
      return true;
    }
    return false;
  }

  // 滾輪切換武器 (direction: +1 向後, -1 向前)
  switchWeapon(direction) {
    if (this.isGameOver) return;
    const owned = this.weaponOrder.filter(id => this.ownedWeapons.has(id));
    if (owned.length <= 1) return;
    const cur = owned.indexOf(this.currentWeaponId);
    const next = (cur + direction + owned.length) % owned.length;
    this.currentWeaponId = owned[next];
    const w = this.weapons[this.currentWeaponId];
    if (window.uiManager) {
      window.uiManager.addLog(`🔄 切換武器：${w.icon} ${w.name}`, 'info');
    }
  }

  // 治療/補血方法
  heal(amount, sourceName = '醫療用品') {
    if (this.isGameOver) return;
    const oldHp = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    const recovered = Math.round(this.hp - oldHp);

    if (this.audio) this.audio.playHeal();
    this.medsUsed++;

    // 觸發綠色治癒光芒特效
    const healOverlay = document.getElementById('heal-overlay');
    if (healOverlay) {
      healOverlay.style.opacity = '1';
      setTimeout(() => {
        healOverlay.style.opacity = '0';
      }, 200);
    }

    if (window.uiManager) {
      window.uiManager.addLog(`💖 ${sourceName} 恢復了 ${recovered} HP (目前: ${Math.round(this.hp)}/100)`, 'success');
    }
  }

  // 擊敗暴徒擊殺回血獎勵
  onEnemyKilled() {
    this.kills++;
    const killHealAmount = 18;
    const oldHp = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + killHealAmount);
    const recovered = Math.round(this.hp - oldHp);

    if (this.audio) this.audio.playHeal();

    if (window.uiManager) {
      window.uiManager.addLog(`⚔️ 擊倒暴徒！獲得戰鬥吸血 +${recovered} HP！`, 'success');
    }
  }

  eatFood(food) {
    if (this.isGameOver) return;
    this.hunger = Math.min(this.maxHunger, this.hunger + (food.hunger || 25));
    if (food.heal && food.heal > 0) {
      this.hp = Math.min(this.maxHp, this.hp + food.heal);
    }
    this.foodCollected++;
    if (this.audio) this.audio.playEat();
  }

  takeDamage(amount, cause = '受到不明傷害') {
    if (this.isGameOver || this.invulnerableTimer > 0) return false;

    this.hp -= amount;
    this.invulnerableTimer = 0.35;

    if (this.audio) this.audio.playHurt();

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
        搜刮食物與醫療：<strong>${this.foodCollected + this.medsUsed} 份</strong>
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

    // 飽足感消耗與飢餓扣血
    this.hunger -= this.hungerDecayRate * delta;
    if (this.hunger <= 0) {
      this.hunger = 0;
      this.starveDamageTimer += delta;
      if (this.starveDamageTimer >= 1.5) {
        this.starveDamageTimer = 0;
        this.takeDamage(6, '極度飢餓，體力不支餓死');
      }
    } else {
      this.starveDamageTimer = 0;
    }

    // 水中閉氣系統
    if (this.isUnderwater) {
      this.oxygen -= delta;
      if (this.oxygen <= 0) {
        this.oxygen = 0;
        this.takeDamage(18 * delta, '水下閉氣超過 60 秒溺斃');
      }
    } else {
      if (this.oxygen < this.maxOxygen) {
        this.oxygen = Math.min(this.maxOxygen, this.oxygen + 25 * delta);
      }
    }
  }
}

window.GameState = GameState;
