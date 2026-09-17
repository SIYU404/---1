/**
 * UIManager.js
 * HUD 介面更新模組：包含生命值/飽足度/閉氣條、武器欄位、雷達小地圖繪製與日誌提示
 */
class UIManager {
  constructor(gameState) {
    this.gameState = gameState;

    // DOM 元素
    this.hpVal = document.getElementById('hp-val');
    this.hpBar = document.getElementById('hp-bar');
    this.hungerVal = document.getElementById('hunger-val');
    this.hungerBar = document.getElementById('hunger-bar');
    this.oxygenRow = document.getElementById('oxygen-row');
    this.oxygenVal = document.getElementById('oxygen-val');
    this.oxygenBar = document.getElementById('oxygen-bar');

    this.weaponIcon = document.getElementById('weapon-icon');
    this.weaponName = document.getElementById('weapon-name');
    this.ammoCount = document.getElementById('ammo-count');

    this.eventLog = document.getElementById('event-log');
    this.underwaterOverlay = document.getElementById('underwater-overlay');

    // 雷達 Canvas
    this.radarCanvas = document.getElementById('radar-canvas');
    this.radarCtx = this.radarCanvas ? this.radarCanvas.getContext('2d') : null;
  }

  addLog(message, type = 'info') {
    if (!this.eventLog) return;
    const item = document.createElement('div');
    item.className = `log-item ${type}`;
    item.textContent = message;
    this.eventLog.appendChild(item);

    setTimeout(() => {
      if (item.parentNode) {
        item.parentNode.removeChild(item);
      }
    }, 4000);
  }

  update(playerPos, playerYaw, trafficSystem, npcSystem, itemSystem) {
    // 1. 生命值
    const hp = Math.max(0, Math.ceil(this.gameState.hp));
    if (this.hpVal) this.hpVal.textContent = `${hp} / ${this.gameState.maxHp}`;
    if (this.hpBar) this.hpBar.style.width = `${(hp / this.gameState.maxHp) * 100}%`;

    // 2. 飽足感
    const hunger = Math.max(0, Math.ceil(this.gameState.hunger));
    if (this.hungerVal) this.hungerVal.textContent = `${hunger}%`;
    if (this.hungerBar) this.hungerBar.style.width = `${hunger}%`;

    // 3. 氧氣閉氣條 (僅在水下或未滿時顯示)
    if (this.gameState.isUnderwater || this.gameState.oxygen < 60) {
      if (this.oxygenRow) this.oxygenRow.classList.remove('hidden');
      if (this.oxygenVal) this.oxygenVal.textContent = `${this.gameState.oxygen.toFixed(1)}s`;
      if (this.oxygenBar) {
        const o2Percent = (this.gameState.oxygen / this.gameState.maxOxygen) * 100;
        this.oxygenBar.style.width = `${o2Percent}%`;
      }
    } else {
      if (this.oxygenRow) this.oxygenRow.classList.add('hidden');
    }

    // 4. 水下全螢幕濾鏡
    if (this.underwaterOverlay) {
      if (this.gameState.isUnderwater) {
        this.underwaterOverlay.classList.add('active');
      } else {
        this.underwaterOverlay.classList.remove('active');
      }
    }

    // 5. 武器 HUD
    const weapon = this.gameState.getCurrentWeapon();
    if (this.weaponIcon) this.weaponIcon.textContent = weapon.icon;
    if (this.weaponName) this.weaponName.textContent = weapon.name;
    if (this.ammoCount) {
      if (weapon.type === 'ranged') {
        this.ammoCount.textContent = `剩餘彈藥: ${weapon.ammo} 發`;
      } else {
        this.ammoCount.textContent = `近戰攻擊 (左鍵)`;
      }
    }

    // 6. 繪製小地圖雷達
    this.drawRadar(playerPos, playerYaw, trafficSystem, npcSystem, itemSystem);
  }

  drawRadar(playerPos, playerYaw, trafficSystem, npcSystem, itemSystem) {
    if (!this.radarCtx) return;
    const ctx = this.radarCtx;
    const w = this.radarCanvas.width;
    const h = this.radarCanvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const radarRange = 65; // 雷達顯示半徑 65m
    const scale = (w / 2) / radarRange;

    ctx.clearRect(0, 0, w, h);

    // 背景格線與同心圓
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, w * 0.25, 0, Math.PI * 2);
    ctx.arc(cx, cy, w * 0.45, 0, Math.PI * 2);
    ctx.stroke();

    // 繪製運河藍色區域 (X: -12 ~ 12)
    const canalRelMinX = (-12 - playerPos.x) * scale;
    const canalRelMaxX = (12 - playerPos.x) * scale;
    ctx.fillStyle = 'rgba(2, 132, 199, 0.25)';
    ctx.fillRect(cx + canalRelMinX, 0, canalRelMaxX - canalRelMinX, h);

    // 繪製車輛 (黃點)
    if (trafficSystem) {
      ctx.fillStyle = '#f59e0b';
      trafficSystem.getCarPositions().forEach(pos => {
        const dx = (pos.x - playerPos.x) * scale;
        const dz = (pos.z - playerPos.z) * scale;
        if (Math.hypot(dx, dz) < w / 2) {
          ctx.beginPath();
          ctx.arc(cx + dx, cy + dz, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }

    // 繪製危險暴徒 (紅點)
    if (npcSystem) {
      ctx.fillStyle = '#ef4444';
      npcSystem.getHostilePositions().forEach(pos => {
        const dx = (pos.x - playerPos.x) * scale;
        const dz = (pos.z - playerPos.z) * scale;
        if (Math.hypot(dx, dz) < w / 2) {
          ctx.beginPath();
          ctx.arc(cx + dx, cy + dz, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }

    // 繪製物資 (醫療: 綠色, 食物: 橙黃, 武器: 青藍)
    if (itemSystem) {
      itemSystem.getItemPositions().forEach(item => {
        const dx = (item.pos.x - playerPos.x) * scale;
        const dz = (item.pos.z - playerPos.z) * scale;
        if (Math.hypot(dx, dz) < w / 2) {
          if (item.isMed) {
            ctx.fillStyle = '#10b981'; // 醫療綠
          } else if (item.isFood) {
            ctx.fillStyle = '#f59e0b'; // 食物橙
          } else {
            ctx.fillStyle = '#38bdf8'; // 武器青
          }
          ctx.beginPath();
          ctx.arc(cx + dx, cy + dz, 3.2, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }

    // 繪製中央玩家 (箭頭方向)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-playerYaw); // 配合視角旋轉
    ctx.fillStyle = '#00f2fe';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4, 5);
    ctx.lineTo(0, 3);
    ctx.lineTo(-4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

window.UIManager = UIManager;
