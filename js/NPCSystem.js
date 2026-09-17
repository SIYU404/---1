/**
 * NPCSystem.js
 * 行人與敵對暴徒系統：包含路人徘徊、危險暴徒追逐攻擊、頭頂血條、受擊擊退與擊倒掉落物資
 */
class NPCSystem {
  constructor(scene, gameState, audioManager, itemSystem) {
    this.scene = scene;
    this.gameState = gameState;
    this.audio = audioManager;
    this.itemSystem = itemSystem;

    this.npcs = [];
    this.maxNPCs = 18;

    this.initNPCs();
  }

  initNPCs() {
    // 預設生成正常路人與危險暴徒
    for (let i = 0; i < this.maxNPCs; i++) {
      const isHostile = (i % 2 === 1); // 一半正常路人、一半危險暴徒
      this.spawnNPC(isHostile);
    }
  }

  spawnNPC(isHostile = false, spawnPos = null) {
    const group = new THREE.Group();

    // 隨機位置 (人行道或建築物周遭)
    let x, z;
    if (spawnPos) {
      x = spawnPos.x;
      z = spawnPos.z;
    } else {
      const side = Math.random() > 0.5 ? 1 : -1;
      x = side * (35 + Math.random() * 95);
      z = -180 + Math.random() * 360;
    }

    const skinMat = new THREE.MeshLambertMaterial({ color: 0xfbcfe8 });
    const shirtColor = isHostile ? 0xdc2626 : (Math.random() > 0.5 ? 0x0284c7 : 0x10b981);
    const shirtMat = new THREE.MeshLambertMaterial({ color: shirtColor });
    const pantsMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });

    // 身體
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.9, 0.4), shirtMat);
    torso.position.y = 1.15;
    torso.castShadow = true;
    group.add(torso);

    // 頭部
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.45, 0.4), skinMat);
    head.position.y = 1.85;
    head.castShadow = true;
    group.add(head);

    // 雙腿
    const legGeo = new THREE.BoxGeometry(0.24, 0.7, 0.28);
    const legL = new THREE.Mesh(legGeo, pantsMat);
    legL.position.set(-0.18, 0.35, 0);
    group.add(legL);

    const legR = new THREE.Mesh(legGeo, pantsMat);
    legR.position.set(0.18, 0.35, 0);
    group.add(legR);

    // 雙手
    const armGeo = new THREE.BoxGeometry(0.18, 0.75, 0.2);
    const armL = new THREE.Mesh(armGeo, shirtMat);
    armL.position.set(-0.42, 1.1, 0);
    group.add(armL);

    const armR = new THREE.Mesh(armGeo, shirtMat);
    armR.position.set(0.42, 1.1, 0);
    group.add(armR);

    // 若為危險暴徒，手上配備武器模型 (球棒或尖刀)
    if (isHostile) {
      const weaponMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.02, 0.8),
        new THREE.MeshLambertMaterial({ color: 0x78350f })
      );
      weaponMesh.position.set(0.45, 0.9, 0.3);
      weaponMesh.rotation.x = Math.PI / 3;
      group.add(weaponMesh);

      // 頭頂紅名血條底板
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
      state: 'patrol', // patrol, chase, attack, dead
      patrolTarget: new THREE.Vector3(x + (Math.random() - 0.5) * 30, 0, z + (Math.random() - 0.5) * 30),
      walkSpeed: isHostile ? 5.5 : 2.5,
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

      // 受擊硬直計時
      if (npc.hitStun > 0) {
        npc.hitStun -= delta;
        continue;
      }

      const pos = npc.mesh.position;
      const distToPlayer = pos.distanceTo(playerPos);

      // 讓頭頂血條面向相機
      if (npc.isHostile && camera) {
        const hpBar = npc.mesh.userData.hpFill;
        if (hpBar) {
          hpBar.parent.lookAt(camera.position);
        }
      }

      if (npc.isHostile) {
        // === 危險暴徒 AI 狀態機 ===
        if (distToPlayer < 26) {
          // 進入追擊模式
          npc.state = 'chase';
          npc.mesh.lookAt(playerPos.x, pos.y, playerPos.z);

          if (distToPlayer > npc.attackRange) {
            // 向玩家奔跑靠近
            const dir = new THREE.Vector3().subVectors(playerPos, pos).normalize();
            pos.x += dir.x * npc.walkSpeed * delta;
            pos.z += dir.z * npc.walkSpeed * delta;

            // 跑步肢體搖擺動畫
            npc.legL.rotation.x = Math.sin(npc.animTime) * 0.7;
            npc.legR.rotation.x = -Math.sin(npc.animTime) * 0.7;
            npc.armL.rotation.x = -Math.sin(npc.animTime) * 0.7;
            npc.armR.rotation.x = Math.sin(npc.animTime) * 0.7;
          } else {
            // 進入近戰攻擊範圍
            npc.state = 'attack';
            if (npc.attackCooldown > 0) {
              npc.attackCooldown -= delta;
            } else {
              // 發動揮擊攻擊玩家
              npc.attackCooldown = 1.2;
              npc.armR.rotation.x = -Math.PI / 2; // 揮砍動作
              setTimeout(() => {
                if (!npc.isDead && pos.distanceTo(playerPos) < npc.attackRange + 0.8) {
                  this.gameState.takeDamage(18, '遭遇街道上的危險暴徒亂拳痛毆致死');
                }
              }, 200);
            }
          }
        } else {
          // 巡邏模式
          this.handlePatrol(npc, delta);
        }
      } else {
        // === 正常路人：悠閒漫步 ===
        this.handlePatrol(npc, delta);
      }
    }
  }

  handlePatrol(npc, delta) {
    const pos = npc.mesh.position;
    const target = npc.patrolTarget;

    const dist = pos.distanceTo(target);
    if (dist < 2.0) {
      // 隨機選擇下一個巡邏路徑點
      target.set(
        pos.x + (Math.random() - 0.5) * 35,
        0,
        pos.z + (Math.random() - 0.5) * 35
      );
      // 限制在地圖範圍內
      target.x = Math.max(-170, Math.min(170, target.x));
      target.z = Math.max(-230, Math.min(230, target.z));
    } else {
      npc.mesh.lookAt(target.x, pos.y, target.z);
      const dir = new THREE.Vector3().subVectors(target, pos).normalize();
      pos.x += dir.x * npc.walkSpeed * delta;
      pos.z += dir.z * npc.walkSpeed * delta;

      // 走路擺動
      npc.legL.rotation.x = Math.sin(npc.animTime * 0.6) * 0.4;
      npc.legR.rotation.x = -Math.sin(npc.animTime * 0.6) * 0.4;
      npc.armL.rotation.x = -Math.sin(npc.animTime * 0.6) * 0.4;
      npc.armR.rotation.x = Math.sin(npc.animTime * 0.6) * 0.4;
    }
  }

  // 接收玩家武器攻擊命中判定
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
      npc.hitStun = 0.25;

      // 更新血條縮放
      if (npc.isHostile && npc.mesh.userData.hpFill) {
        const hpPercent = Math.max(0, npc.hp / npc.maxHp);
        npc.mesh.userData.hpFill.scale.x = hpPercent;
      }

      // 擊退位移
      const knockDir = new THREE.Vector3().subVectors(npc.mesh.position, raycaster.ray.origin).normalize();
      npc.mesh.position.addScaledVector(knockDir, 1.2);

      // 擊殺判定
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
    npc.mesh.rotation.x = -Math.PI / 2; // 倒地
    npc.mesh.position.y = 0.2;

    if (npc.isHostile) {
      this.gameState.kills++;

      // 掉落食物或武器
      if (this.itemSystem) {
        const dropPos = npc.mesh.position.clone();
        dropPos.y = 0.8;
        if (Math.random() > 0.4) {
          this.itemSystem.spawnFoodItem(dropPos);
        } else {
          this.itemSystem.spawnWeaponItem(dropPos);
        }
      }
    }

    // 5秒後重新生成新的 NPC 保持城市活力
    setTimeout(() => {
      this.scene.remove(npc.mesh);
      const idx = this.npcs.indexOf(npc);
      if (idx !== -1) this.npcs.splice(idx, 1);
      this.spawnNPC(npc.isHostile);
    }, 5000);
  }

  getHostilePositions() {
    return this.npcs.filter(n => n.isHostile && !n.isDead).map(n => n.mesh.position);
  }
}

window.NPCSystem = NPCSystem;
