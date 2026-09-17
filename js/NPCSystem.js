/**
 * NPCSystem.js
 * 行人與敵對暴徒系統：大幅擴充路人人口 (45+ 位)，支援室內店員/顧客與街頭漫步，擊殺暴徒觸發吸血回血與掉落醫療品
 */
class NPCSystem {
  constructor(scene, gameState, audioManager, itemSystem) {
    this.scene = scene;
    this.gameState = gameState;
    this.audio = audioManager;
    this.itemSystem = itemSystem;

    this.npcs = [];
    this.maxNPCs = 46; // 大幅增加都市路人數量

    this.initNPCs();
  }

  initNPCs() {
    // 1. 室內特殊 NPC (超商收銀員、拉麵師傅、診所護士、安全屋特工)
    const indoorNPCs = [
      { pos: new THREE.Vector3(-37.5, 0, -38), isHostile: false, shirt: 0x38bdf8 }, // 超商收銀員
      { pos: new THREE.Vector3(-34, 0, 31), isHostile: false, shirt: 0xf43f5e },    // 拉麵師傅
      { pos: new THREE.Vector3(37, 0, 32), isHostile: false, shirt: 0x10b981 },     // 診所護士
      { pos: new THREE.Vector3(34, 0, -32), isHostile: false, shirt: 0xa855f7 }     // 安全屋商人
    ];

    indoorNPCs.forEach(inNpc => {
      this.spawnNPC(inNpc.isHostile, inNpc.pos, inNpc.shirt);
    });

    // 2. 街頭廣大行人與巡邏暴徒 (約 70% 正常路人、30% 危險暴徒)
    for (let i = indoorNPCs.length; i < this.maxNPCs; i++) {
      const isHostile = (i % 3 === 0);
      this.spawnNPC(isHostile);
    }
  }

  spawnNPC(isHostile = false, spawnPos = null, customShirt = null) {
    const group = new THREE.Group();

    let x, z;
    if (spawnPos) {
      x = spawnPos.x;
      z = spawnPos.z;
    } else {
      // 分佈在人行道、斑馬線與河畔步道
      const side = Math.random() > 0.5 ? 1 : -1;
      x = side * (16 + Math.random() * 140);
      z = -210 + Math.random() * 420;
    }

    const skinTones = [0xfbcfe8, 0xfcd34d, 0xfdba74, 0xe2e8f0];
    const skinMat = new THREE.MeshLambertMaterial({ color: skinTones[Math.floor(Math.random() * skinTones.length)] });

    const civilianColors = [0x0284c7, 0x10b981, 0x8b5cf6, 0xec4899, 0xf59e0b, 0x06b6d4, 0x64748b, 0xfafafa];
    const shirtColor = customShirt || (isHostile ? 0xdc2626 : civilianColors[Math.floor(Math.random() * civilianColors.length)]);
    const shirtMat = new THREE.MeshLambertMaterial({ color: shirtColor });
    const pantsMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });

    // 身體
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.88, 0.38), shirtMat);
    torso.position.y = 1.14;
    torso.castShadow = true;
    group.add(torso);

    // 頭部
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.42, 0.38), skinMat);
    head.position.y = 1.82;
    head.castShadow = true;
    group.add(head);

    // 頭髮/帽子
    const hairColors = [0x171717, 0x78350f, 0xd97706, 0x52525b];
    const hair = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.15, 0.4),
      new THREE.MeshLambertMaterial({ color: hairColors[Math.floor(Math.random() * hairColors.length)] })
    );
    hair.position.y = 2.05;
    group.add(hair);

    // 雙腿
    const legGeo = new THREE.BoxGeometry(0.22, 0.7, 0.26);
    const legL = new THREE.Mesh(legGeo, pantsMat);
    legL.position.set(-0.17, 0.35, 0);
    group.add(legL);

    const legR = new THREE.Mesh(legGeo, pantsMat);
    legR.position.set(0.17, 0.35, 0);
    group.add(legR);

    // 雙手
    const armGeo = new THREE.BoxGeometry(0.16, 0.72, 0.18);
    const armL = new THREE.Mesh(armGeo, shirtMat);
    armL.position.set(-0.4, 1.1, 0);
    group.add(armL);

    const armR = new THREE.Mesh(armGeo, shirtMat);
    armR.position.set(0.4, 1.1, 0);
    group.add(armR);

    // 敵對暴徒配備武器與血條
    if (isHostile) {
      const weaponMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.02, 0.8),
        new THREE.MeshLambertMaterial({ color: 0x78350f })
      );
      weaponMesh.position.set(0.45, 0.9, 0.3);
      weaponMesh.rotation.x = Math.PI / 3;
      group.add(weaponMesh);

      // 頭頂血條
      const hpBg = new THREE.Mesh(
        new THREE.PlaneGeometry(0.8, 0.12),
        new THREE.MeshBasicMaterial({ color: 0x000000 })
      );
      hpBg.position.set(0, 2.3, 0);
      group.add(hpBg);

      const hpFill = new THREE.Mesh(
        new THREE.PlaneGeometry(0.76, 0.09),
        new THREE.MeshBasicMaterial({ color: 0xef4444 })
      );
      hpFill.position.set(0, 2.3, 0.01);
      group.add(hpFill);
      group.userData.hpFill = hpFill;
    }

    group.position.set(x, 0, z);
    this.scene.add(group);

    const npcData = {
      mesh: group,
      isHostile: isHostile,
      hp: isHostile ? 100 : 40,
      maxHp: isHostile ? 100 : 40,
      state: 'patrol',
      patrolTarget: new THREE.Vector3(x + (Math.random() - 0.5) * 35, 0, z + (Math.random() - 0.5) * 35),
      walkSpeed: isHostile ? 5.2 : 2.6,
      attackRange: 2.3,
      attackCooldown: 0,
      hitStun: 0,
      isDead: false,
      legL: legL,
      legR: legR,
      armL: armL,
      armR: armR,
      animTime: Math.random() * 10
    };

    group.userData.npcData = npcData;
    this.npcs.push(npcData);
  }

  update(delta, playerPos, camera) {
    for (let i = this.npcs.length - 1; i >= 0; i--) {
      const npc = this.npcs[i];
      if (npc.isDead) continue;

      npc.animTime += delta * 6;

      if (npc.hitStun > 0) {
        npc.hitStun -= delta;
        continue;
      }

      const pos = npc.mesh.position;
      if (!npc.isDead) {
        pos.y = 0;
      }
      const distToPlayer = pos.distanceTo(playerPos);

      if (npc.isHostile && camera) {
        const hpBar = npc.mesh.userData.hpFill;
        if (hpBar) {
          hpBar.parent.lookAt(camera.position);
        }
      }

      if (npc.isHostile) {
        if (distToPlayer < 24) {
          npc.state = 'chase';
          npc.mesh.lookAt(playerPos.x, pos.y, playerPos.z);

          if (distToPlayer > npc.attackRange) {
            const dir = new THREE.Vector3().subVectors(playerPos, pos).normalize();
            pos.x += dir.x * npc.walkSpeed * delta;
            pos.z += dir.z * npc.walkSpeed * delta;

            npc.legL.rotation.x = Math.sin(npc.animTime) * 0.7;
            npc.legR.rotation.x = -Math.sin(npc.animTime) * 0.7;
            npc.armL.rotation.x = -Math.sin(npc.animTime) * 0.7;
            npc.armR.rotation.x = Math.sin(npc.animTime) * 0.7;
          } else {
            npc.state = 'attack';
            if (npc.attackCooldown > 0) {
              npc.attackCooldown -= delta;
            } else {
              npc.attackCooldown = 1.2;
              npc.armR.rotation.x = -Math.PI / 2;
              setTimeout(() => {
                if (!npc.isDead && pos.distanceTo(playerPos) < npc.attackRange + 0.8) {
                  this.gameState.takeDamage(16, '遭遇街道上的危險暴徒亂棍圍毆致死');
                }
              }, 180);
            }
          }
        } else {
          this.handlePatrol(npc, delta);
        }
      } else {
        this.handlePatrol(npc, delta);
      }
    }
  }

  handlePatrol(npc, delta) {
    const pos = npc.mesh.position;
    const target = npc.patrolTarget;

    const dist = pos.distanceTo(target);
    if (dist < 2.0) {
      target.set(
        pos.x + (Math.random() - 0.5) * 35,
        0,
        pos.z + (Math.random() - 0.5) * 35
      );
      target.x = Math.max(-175, Math.min(175, target.x));
      target.z = Math.max(-235, Math.min(235, target.z));
    } else {
      npc.mesh.lookAt(target.x, pos.y, target.z);
      const dir = new THREE.Vector3().subVectors(target, pos).normalize();
      pos.x += dir.x * npc.walkSpeed * delta;
      pos.z += dir.z * npc.walkSpeed * delta;

      npc.legL.rotation.x = Math.sin(npc.animTime * 0.6) * 0.35;
      npc.legR.rotation.x = -Math.sin(npc.animTime * 0.6) * 0.35;
      npc.armL.rotation.x = -Math.sin(npc.animTime * 0.6) * 0.35;
      npc.armR.rotation.x = Math.sin(npc.animTime * 0.6) * 0.35;
    }
  }

  checkHit(raycaster, range, damage) {
    let nearestHit = null;
    let nearestDist = range;

    this.npcs.forEach(npc => {
      if (npc.isDead) return;

      const intersects = raycaster.intersectObjects(npc.mesh.children, true);
      if (intersects.length > 0 && intersects[0].distance <= nearestDist) {
        nearestDist = intersects[0].distance;
        nearestHit = { npc: npc, point: intersects[0].point };
      }
    });

    if (nearestHit) {
      const npc = nearestHit.npc;
      npc.hp -= damage;
      npc.hitStun = 0.22;

      if (npc.isHostile && npc.mesh.userData.hpFill) {
        const hpPercent = Math.max(0, npc.hp / npc.maxHp);
        npc.mesh.userData.hpFill.scale.x = hpPercent;
      }

      // 水平方向擊退（只在 XZ 平面上推開，避免因玩家由上而下攻擊導致 Y 軸向下陷入地面）
      const knockDir = new THREE.Vector3(
        npc.mesh.position.x - raycaster.ray.origin.x,
        0,
        npc.mesh.position.z - raycaster.ray.origin.z
      );

      if (knockDir.lengthSq() > 0.0001) {
        knockDir.normalize();
      } else {
        knockDir.set(raycaster.ray.direction.x, 0, raycaster.ray.direction.z);
        knockDir.y = 0;
        if (knockDir.lengthSq() > 0.0001) {
          knockDir.normalize();
        } else {
          knockDir.set(0, 0, 1);
        }
      }

      // 被攻擊後後退一步（水平位移 1.1 單位），並強制鎖定地面高度 y = 0
      npc.mesh.position.x += knockDir.x * 1.1;
      npc.mesh.position.z += knockDir.z * 1.1;
      npc.mesh.position.y = 0;

      // 邊界防護
      npc.mesh.position.x = Math.max(-175, Math.min(175, npc.mesh.position.x));
      npc.mesh.position.z = Math.max(-235, Math.min(235, npc.mesh.position.z));

      if (npc.hp <= 0) {
        this.killNPC(npc);
      }
      return true;
    }

    return false;
  }

  killNPC(npc) {
    npc.isDead = true;
    npc.state = 'dead';
    npc.mesh.rotation.x = -Math.PI / 2;
    npc.mesh.position.y = 0.2;

    if (npc.isHostile) {
      // 觸發擊殺吸血回血
      this.gameState.onEnemyKilled();

      // 擊敗暴徒後掉落醫療補給品或食物
      if (this.itemSystem) {
        const dropPos = npc.mesh.position.clone();
        dropPos.y = 0.7;
        const rand = Math.random();
        if (rand < 0.45) {
          this.itemSystem.spawnMedicalItem(dropPos, 'bandage');
        } else if (rand < 0.75) {
          this.itemSystem.spawnFoodItem(dropPos);
        } else {
          this.itemSystem.spawnMedicalItem(dropPos, 'medkit');
        }
      }
    } else {
      // 誤擊路人掉落普通零食
      if (this.itemSystem && Math.random() > 0.5) {
        const dropPos = npc.mesh.position.clone();
        dropPos.y = 0.7;
        this.itemSystem.spawnFoodItem(dropPos);
      }
    }

    // 4 秒後在城市中重新刷新 NPC
    setTimeout(() => {
      this.scene.remove(npc.mesh);
      const idx = this.npcs.indexOf(npc);
      if (idx !== -1) this.npcs.splice(idx, 1);
      this.spawnNPC(npc.isHostile);
    }, 4000);
  }

  getHostilePositions() {
    return this.npcs.filter(n => n.isHostile && !n.isDead).map(n => n.mesh.position);
  }
}

window.NPCSystem = NPCSystem;
