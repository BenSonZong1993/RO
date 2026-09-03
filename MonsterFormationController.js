// js/battle/MonsterFormationController.js
// ============================================================
//  怪物战斗行为调度层（唯一阵型/移动决策中枢）
//  职责：生成初始位置、计算移动增量（含分离力、扇形阻挡检测）
//  说明：所有怪物始终朝玩家移动，同时施加分离力，形成散开冲锋效果
//        当怪物接近玩家时，检测前方扇形区域是否有其他怪物阻挡，
//        若有则施加侧向力绕开，无状态、无目标点，避免震荡。
// ============================================================
(function(global) {
    'use strict';

    // ============================================================
    //  📋 怪物阵型控制器配置项表（策划可在此修改数值）
    //  说明：以下字段为默认值，若外部传入 formationConfig 则优先使用外部值
    // ============================================================
    var MONSTER_FORMATION_CONFIG_TABLE = {
        // ---- 生成位置参数 ----
        fanAngleDeg: 120,               // 扇形生成角度（度），以玩家为中心
        spawnBiasAngleDeg: -90,         // 扇形中心偏向角度（度），-90 表示上方
        speedVariance: 0.25,            // 速度浮动比例（±25%）
        minRadiusPx: 150,               // 生成最小半径（像素）
        maxRadiusPx: 300,               // 生成最大半径（像素）
        clusterSpreadPx: 70,            // 簇内散布半径（像素）
        spawnLateralSpreadFactor: 1,    // 生成时横向散布倍率（1=圆形，>1 横向拉伸成椭圆，保持原样请设1）

        // ---- 移动参数 ----
        speedBasePxPerSec: 70,          // 基础移动速度（像素/秒）
        separationForcePx: 40,          // 基础分离力半径（像素）
        spreadRadius: 512,              // 动态分离膨胀参考距离（像素）
        dynamicSeparationExtra: 64,     // 接近玩家时分离力额外膨胀量（像素）
        pushStrengthMultiplier: 0.7,    // 分离推力系数（乘以移动速度）—— 略微增强但避免过度弹开
        playerFactorMultiplier: 0.6,    // 距离因子对推力增强系数
        nearFactorMultiplier: 0.6,      // 近距离额外推力增强系数
        nearDistance: 150,              // 近距离判定阈值（像素）
        deadlockJitterMultiplier: 0.5,  // 死锁消除侧向力系数
        maxMoveMultiplier: 1.1,         // 单帧最大位移倍率（防止瞬移）

        // ---- 横向分布调节（默认1保持原有行为） ----
        lateralSpreadStrength: 1.2,     // 移动时横向保持力强度（1=无额外横向力，>1增强横向分散）
        lateralSpreadForceMultiplier: 0.7, // 横向力基础系数（乘以移动速度，仅当 lateralSpreadStrength >1 时生效）

        // ---- 停止距离（防止怪物挤入过近） ----
        stopDistancePx: 12,             // 距玩家小于此距离时，停止主动靠近

        // ---- 扇形阻挡检测（无状态侧向绕行） ----
        fanDetectionEnabled: true,      // 是否启用扇形阻挡检测
        fanDetectionMinDistPx: 80,      // 距玩家小于此距离时开始检测（像素）
        fanDetectionMaxDistPx: 200,     // 距玩家大于此距离时不检测（像素）
        fanDetectionAngleDeg: 45,       // 扇形半角（度），中线为怪物→玩家方向
        fanDetectionRangePx: 48,        // 扇形半径（像素），建议等于怪物直径
        fanSideStepStrength: 0.8,       // 侧向绕行力系数（乘以移动速度）
    };

    // ---- 生成初始位置（扇形环带 + 簇心散布） ----
    function generateSpawnPositions(playerWorldX, playerWorldY, count, formationConfig) {
        var fanAngleDeg = (formationConfig && formationConfig.fanAngleDeg) || MONSTER_FORMATION_CONFIG_TABLE.fanAngleDeg;
        var biasDeg = (formationConfig && formationConfig.spawnBiasAngleDeg) || MONSTER_FORMATION_CONFIG_TABLE.spawnBiasAngleDeg;
        var speedVariance = (formationConfig && formationConfig.speedVariance !== undefined)
            ? formationConfig.speedVariance : MONSTER_FORMATION_CONFIG_TABLE.speedVariance;
        var minRadius = (formationConfig && formationConfig.minRadiusPx) || MONSTER_FORMATION_CONFIG_TABLE.minRadiusPx;
        var maxRadius = (formationConfig && formationConfig.maxRadiusPx) || MONSTER_FORMATION_CONFIG_TABLE.maxRadiusPx;
        var clusterSpread = (formationConfig && formationConfig.clusterSpreadPx) || MONSTER_FORMATION_CONFIG_TABLE.clusterSpreadPx;
        var lateralFactor = (formationConfig && formationConfig.spawnLateralSpreadFactor) || MONSTER_FORMATION_CONFIG_TABLE.spawnLateralSpreadFactor;

        var type = formationConfig && formationConfig.generationType ? formationConfig.generationType : 'circle';
        var biasRad = biasDeg * Math.PI / 180;
        var halfFan = (fanAngleDeg / 2) * Math.PI / 180;

        var centerAngle = biasRad + (Math.random() - 0.5) * 2 * halfFan;
        var centerRadius = minRadius + Math.random() * (maxRadius - minRadius);
        var centerX = playerWorldX + Math.cos(centerAngle) * centerRadius;
        var centerY = playerWorldY + Math.sin(centerAngle) * centerRadius;

        var positions = [];
        for (var i = 0; i < count; i++) {
            var angle = Math.random() * 2 * Math.PI;
            var radius = Math.random() * clusterSpread;
            var offsetX = Math.cos(angle) * radius;
            var offsetY = Math.sin(angle) * radius;
            if (lateralFactor > 1) {
                offsetX *= lateralFactor;
            }
            var x = centerX + offsetX;
            var y = centerY + offsetY;
            var speedMod = 1 + (Math.random() - 0.5) * 2 * speedVariance;
            positions.push({ x: x, y: y, speedModifier: speedMod });
        }
        return positions;
    }

    // ---- 计算移动增量（基础移动 + 分离力 + 扇形阻挡检测） ----
    function calculateMovement(monster, playerWorldX, playerWorldY, sameWaveMonsters, formationConfig, deltaSeconds) {
        var speedBase = (formationConfig && formationConfig.speedBasePxPerSec) || MONSTER_FORMATION_CONFIG_TABLE.speedBasePxPerSec;
        var baseSep = (formationConfig && formationConfig.separationForcePx) || MONSTER_FORMATION_CONFIG_TABLE.separationForcePx;
        var enableSep = (formationConfig && formationConfig.enableSeparation !== undefined)
            ? formationConfig.enableSeparation !== false : true;
        var spreadRadius = (formationConfig && formationConfig.spreadRadius) || MONSTER_FORMATION_CONFIG_TABLE.spreadRadius;
        var dynamicSepExtra = (formationConfig && formationConfig.dynamicSeparationExtra) || MONSTER_FORMATION_CONFIG_TABLE.dynamicSeparationExtra;
        var pushStrengthMult = (formationConfig && formationConfig.pushStrengthMultiplier) || MONSTER_FORMATION_CONFIG_TABLE.pushStrengthMultiplier;
        var playerFactorMult = (formationConfig && formationConfig.playerFactorMultiplier) || MONSTER_FORMATION_CONFIG_TABLE.playerFactorMultiplier;
        var nearFactorMult = (formationConfig && formationConfig.nearFactorMultiplier) || MONSTER_FORMATION_CONFIG_TABLE.nearFactorMultiplier;
        var nearDist = (formationConfig && formationConfig.nearDistance) || MONSTER_FORMATION_CONFIG_TABLE.nearDistance;
        var deadlockJitterMult = (formationConfig && formationConfig.deadlockJitterMultiplier) || MONSTER_FORMATION_CONFIG_TABLE.deadlockJitterMultiplier;
        var maxMoveMult = (formationConfig && formationConfig.maxMoveMultiplier) || MONSTER_FORMATION_CONFIG_TABLE.maxMoveMultiplier;
        var lateralStrength = (formationConfig && formationConfig.lateralSpreadStrength) || MONSTER_FORMATION_CONFIG_TABLE.lateralSpreadStrength;
        var lateralForceMult = (formationConfig && formationConfig.lateralSpreadForceMultiplier) || MONSTER_FORMATION_CONFIG_TABLE.lateralSpreadForceMultiplier;
        var stopDistance = (formationConfig && formationConfig.stopDistancePx) || MONSTER_FORMATION_CONFIG_TABLE.stopDistancePx;
        var fanEnabled = (formationConfig && formationConfig.fanDetectionEnabled !== undefined)
            ? formationConfig.fanDetectionEnabled : MONSTER_FORMATION_CONFIG_TABLE.fanDetectionEnabled;
        var fanMinDist = (formationConfig && formationConfig.fanDetectionMinDistPx) || MONSTER_FORMATION_CONFIG_TABLE.fanDetectionMinDistPx;
        var fanMaxDist = (formationConfig && formationConfig.fanDetectionMaxDistPx) || MONSTER_FORMATION_CONFIG_TABLE.fanDetectionMaxDistPx;
        var fanAngleDeg = (formationConfig && formationConfig.fanDetectionAngleDeg) || MONSTER_FORMATION_CONFIG_TABLE.fanDetectionAngleDeg;
        var fanRange = (formationConfig && formationConfig.fanDetectionRangePx) || MONSTER_FORMATION_CONFIG_TABLE.fanDetectionRangePx;
        var fanSideStepStrength = (formationConfig && formationConfig.fanSideStepStrength) || MONSTER_FORMATION_CONFIG_TABLE.fanSideStepStrength;

        var speedMod = monster._speedModifier || 1.0;
        var speed = speedBase * speedMod;
        var moveSpeed = speed * deltaSeconds;

        var dx = playerWorldX - monster.x;
        var dy = playerWorldY - monster.y;
        var distToPlayer = Math.sqrt(dx * dx + dy * dy);

        var moveX = 0, moveY = 0;

        // 1. 基础移动：指向玩家（若距离足够近则停止）
        if (distToPlayer > 0.001 && distToPlayer > stopDistance) {
            var normX = dx / distToPlayer;
            var normY = dy / distToPlayer;
            moveX = normX * moveSpeed;
            moveY = normY * moveSpeed;
        }

        // 2. 扇形阻挡检测与侧向绕行（无状态）
        if (fanEnabled && distToPlayer > 0.001 && distToPlayer > stopDistance &&
            distToPlayer >= fanMinDist && distToPlayer <= fanMaxDist &&
            sameWaveMonsters && sameWaveMonsters.length > 1) {

            var dirX = dx / distToPlayer;
            var dirY = dy / distToPlayer;
            var blocked = false;

            // 检测前方扇形区域
            var halfAngleRad = fanAngleDeg * Math.PI / 180;
            for (var i = 0; i < sameWaveMonsters.length; i++) {
                var other = sameWaveMonsters[i];
                if (other === monster || !other.alive) continue;
                var relX = other.x - monster.x;
                var relY = other.y - monster.y;
                var distOther = Math.sqrt(relX * relX + relY * relY);
                if (distOther > fanRange) continue; // 超出检测半径

                // 计算该怪物相对方向与前进方向的夹角
                var dot = relX * dirX + relY * dirY;
                if (dot <= 0) continue; // 在后方

                var cross = relX * dirY - relY * dirX;
                var angleDiff = Math.abs(Math.atan2(cross, dot)); // 弧度
                if (angleDiff < halfAngleRad) {
                    blocked = true;
                    break;
                }
            }

            if (blocked) {
                // 决定侧移方向：根据怪物相对玩家的横向偏移保持原半区
                var sideSign;
                if (monster._relX !== undefined && monster._relX !== 0) {
                    sideSign = monster._relX > 0 ? 1 : -1;
                } else {
                    sideSign = (monster.id % 2 === 0) ? 1 : -1;
                }
                // 垂直于前进方向
                var perpX = -dirY;
                var perpY = dirX;
                var sideForce = moveSpeed * fanSideStepStrength;
                moveX += perpX * sideSign * sideForce;
                moveY += perpY * sideSign * sideForce;
            }
        }

        // 3. 动态分离力
        if (enableSep && sameWaveMonsters && sameWaveMonsters.length > 1) {
            var dynamicSep = baseSep;
            var playerFactor = 0;
            if (distToPlayer < spreadRadius) {
                playerFactor = 1 - (distToPlayer / spreadRadius);
                dynamicSep = baseSep + playerFactor * dynamicSepExtra;
            }

            var nearFactor = 0;
            if (distToPlayer < nearDist) {
                nearFactor = 1 - (distToPlayer / nearDist);
            }

            for (var i2 = 0; i2 < sameWaveMonsters.length; i2++) {
                var otherM = sameWaveMonsters[i2];
                if (otherM === monster || !otherM.alive) continue;
                var dx2 = monster.x - otherM.x;
                var dy2 = monster.y - otherM.y;
                var dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

                if (dist2 < dynamicSep && dist2 > 0.01) {
                    var pushStrength = (dynamicSep - dist2) / dynamicSep;
                    var strengthMultiplier = 1 + playerFactor * playerFactorMult + nearFactor * nearFactorMult;
                    var pushAmount = pushStrength * moveSpeed * pushStrengthMult * strengthMultiplier;

                    var normX2 = dx2 / dist2;
                    var normY2 = dy2 / dist2;
                    moveX += normX2 * pushAmount;
                    moveY += normY2 * pushAmount;
                }
            }
        }

        // 4. 横向分布力（仅当 lateralSpreadStrength > 1 且未处于扇形阻挡检测触发状态时）
        //    为避免叠加侧向力导致过冲，我们仅在无阻挡时应用横向分布力
        if (lateralStrength > 1 && distToPlayer > 0.001 && !blocked) {
            var perpX = -dy / distToPlayer;
            var perpY = dx / distToPlayer;
            var lateralSign = (monster._relX !== undefined && monster._relX !== 0)
                ? (monster._relX > 0 ? 1 : -1)
                : (monster.id % 2 === 0 ? 1 : -1);
            var lateralForce = (lateralStrength - 1) * moveSpeed * lateralForceMult;
            moveX += perpX * lateralSign * lateralForce;
            moveY += perpY * lateralSign * lateralForce;
        }

        // 5. 死锁消除
        var finalDist = Math.sqrt(moveX * moveX + moveY * moveY);
        if (finalDist < 0.3 && distToPlayer < nearDist && sameWaveMonsters && sameWaveMonsters.length > 1) {
            var perpX2 = -dy / (distToPlayer || 1);
            var perpY2 = dx / (distToPlayer || 1);
            var id = monster.id || monster._formationId || 0;
            var side = (id % 2 === 0) ? 1 : -1;
            var jitter = moveSpeed * deadlockJitterMult;
            moveX += perpX2 * side * jitter;
            moveY += perpY2 * side * jitter;
        }

        // 6. 限幅
        var maxMove = moveSpeed * maxMoveMult;
        var moveDist = Math.sqrt(moveX * moveX + moveY * moveY);
        if (moveDist > maxMove) {
            moveX = moveX / moveDist * maxMove;
            moveY = moveY / moveDist * maxMove;
        }

        return { dx: moveX, dy: moveY };
    }

    // ---- 公开接口 ----
    global.MonsterFormationController = {
        generateSpawnPositions: generateSpawnPositions,
        calculateMovement: calculateMovement,
        getDefaultConfig: function() {
            return Object.assign({}, MONSTER_FORMATION_CONFIG_TABLE);
        }
    };

    console.log('[MonsterFormationController] ✅ 已加载（扇形阻挡检测模式，无状态侧向绕行）');
})(window);