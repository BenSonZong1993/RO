// masteryDamage.js
// ============================================================================
// 常量定义 (完全对应 rAthena 源码数值)
// ============================================================================

// 武器类型 (Weapon Types)
const W_1HSWORD = 1;
const W_2HSWORD = 2;
const W_1HSPEAR = 3;
const W_2HSPEAR = 4;
const W_1HAXE = 5;
const W_2HAXE = 6;
const W_MACE = 7;
const W_2HMACE = 8;
const W_FIST = 9;
const W_KNUCKLE = 10;
const W_MUSICAL = 11;
const W_WHIP = 12;
const W_BOOK = 13;
const W_KATAR = 14;
const W_DAGGER = 15;
const W_BOW = 16;

// 种族 (Races)
const RC_BRUTE = 1;
const RC_PLANT = 2;
const RC_INSECT = 3;
const RC_FISH = 4;
const RC_DEMON = 5;
const RC_PLAYER_DORAM = 6;
const RC_UNDEAD = 7;
const RC_ANGEL = 8;

// 属性 (Elements)
const ELE_FIRE = 1;
const ELE_EARTH = 2;
const ELE_WIND = 3;
const ELE_WATER = 4;
const ELE_UNDEAD = 11;

// 装备位置 (Equipment Index)
const EQI_HAND_R = 0;
const EQI_HAND_L = 1;

// 精气属性类型 (Spirit Charm Types)
const CHARM_TYPE_FIRE = 0;
const CHARM_TYPE_WATER = 1;
const CHARM_TYPE_LAND = 2;
const CHARM_TYPE_WIND = 3;

// 最大精气数量
const MAX_SPIRITCHARM = 5;

// ============================================================================
// 辅助工具函数
// ============================================================================

function getSkill(sd, skillName) {
    if (!sd || !sd.skills) return 0;
    return sd.skills[skillName] || 0;
}

function randInt(max) {
    if (max <= 0) return 0;
    return Math.floor(Math.random() * max);
}

function isUndead(race, defEle) {
    return race === RC_UNDEAD || defEle === ELE_UNDEAD;
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

// ============================================================================
// 辅助函数迁移 (battle_add_weapon_damage, battle_calc_sizefix)
// ============================================================================

function battleAddWeaponDamage(sd, damage, lr_type) {
    if (!sd) return damage;

    if (lr_type === EQI_HAND_L) {
        if (sd.left_weapon && sd.left_weapon.overrefine) {
            damage += randInt(sd.left_weapon.overrefine) + 1;
        }
        if (sd.indexed_bonus && sd.indexed_bonus.weapon_damage_rate) {
            const rate = sd.indexed_bonus.weapon_damage_rate[sd.weaponType2] || 0;
            if (rate > 0) {
                damage += Math.floor(damage * rate / 100);
            }
        }
    } else if (lr_type === EQI_HAND_R) {
        if (sd.right_weapon && sd.right_weapon.overrefine) {
            damage += randInt(sd.right_weapon.overrefine) + 1;
        }
        if (sd.indexed_bonus && sd.indexed_bonus.weapon_damage_rate) {
            const rate = sd.indexed_bonus.weapon_damage_rate[sd.weaponType1] || 0;
            if (rate > 0) {
                damage += Math.floor(damage * rate / 100);
            }
        }
    }
    return damage;
}

function battleCalcSizefix(damage, sd, t_size, weapon_type, flag) {
    if (sd && sd.special_state && sd.special_state.no_sizefix) {
        return damage;
    }
    if (flag) {
        return damage;
    }

    let atkmods = null;
    if (weapon_type === EQI_HAND_L) {
        if (sd.left_weapon && sd.left_weapon.atkmods) {
            atkmods = sd.left_weapon.atkmods;
        }
    } else {
        if (sd.right_weapon && sd.right_weapon.atkmods) {
            atkmods = sd.right_weapon.atkmods;
        }
    }

    if (atkmods && atkmods[t_size] !== undefined && atkmods[t_size] !== 0) {
        damage = Math.floor(damage * atkmods[t_size] / 100);
    }
    return damage;
}

function battleCalcBaseWeaponAttack(src, tstatus, wa, sd, critical) {
    const status = sd;
    const type = (wa === sd.lhw) ? EQI_HAND_L : EQI_HAND_R;

    let atkmin = (type === EQI_HAND_L) ? (status.watk2 || 0) : (status.watk || 0);
    let atkmax = atkmin;
    let damage = atkmin;

    const equipIndex = sd.equip_index && sd.equip_index[type];
    if (equipIndex !== undefined && equipIndex >= 0 &&
        sd.inventory_data && sd.inventory_data[equipIndex]) {

        let baseStat = status.str || 0;
        const weaponType = sd.weaponType1;
        if (weaponType === W_BOW || weaponType === W_MUSICAL || weaponType === W_WHIP) {
            baseStat = status.dex || 0;
        }

        const variance = 5.0 * wa.atk * wa.wlv / 100.0;
        const baseStatBonus = wa.atk * baseStat / 200.0;

        atkmin = Math.max(0, Math.floor(atkmin - variance + baseStatBonus));
        atkmax = Math.min(65535, Math.floor(atkmax + variance + baseStatBonus));

        // 【修改点1】最大化力量检查
        const isMaximizePower = (sd.sc && sd.sc.hasSCE(SC_CONSTANTS.MaximizePower)) ? true : false;
        if (isMaximizePower || critical === true) {
            damage = atkmax;
        } else {
            damage = Math.floor(Math.random() * (atkmax - atkmin + 1)) + atkmin;
        }
    }

    // 【修改点2】武器完美检查
    const weaponPerfection = (sd.sc && sd.sc.hasSCE(SC_CONSTANTS.Weaponperfection)) ? true : false;

    damage = battleAddWeaponDamage(sd, damage, type);
    damage = battleCalcSizefix(damage, sd, tstatus.size, type, weaponPerfection);

    return clamp(damage, -2147483648, 2147483647);
}

// ============================================================================
// 核心函数: 被动熟练度 (Mastery) 伤害计算
// ============================================================================

function calculateMasteryDamage(sd, target, baseDamage = 0) {
    let damage = 0;
    if (!sd) return 0;

    const targetRace = target.race || 0;
    const targetDefEle = target.defElement || 0;
    const targetSize = target.size || 1;

    const skill = (name) => getSkill(sd, name);

    // 2.1 AL_DEMONBANE
    const demonbaneLv = skill('AL_DEMONBANE');
    if (demonbaneLv > 0 && target.isMob === true &&
        (isUndead(targetRace, targetDefEle) || targetRace === RC_DEMON)) {
        const baseLevel = sd.baseLevel || 1;
        damage += Math.floor(demonbaneLv * (baseLevel / 20.0 + 3.0));
    }

    // 2.2 RA_RANGERMAIN
    const rangerMainLv = skill('RA_RANGERMAIN');
    if (rangerMainLv > 0 &&
        (targetRace === RC_BRUTE || targetRace === RC_PLAYER_DORAM ||
         targetRace === RC_PLANT || targetRace === RC_FISH)) {
        damage += (rangerMainLv * 5);
    }

    // 2.3 NC_RESEARCHFE
    const researchFELv = skill('NC_RESEARCHFE');
    if (researchFELv > 0 && (targetDefEle === ELE_FIRE || targetDefEle === ELE_EARTH)) {
        damage += (researchFELv * 10);
    }

    // 2.4 NC_MADOLICENCE
    const madolienceLv = skill('NC_MADOLICENCE');
    if (madolienceLv > 0) {
        damage += (15 * madolienceLv);
    }

    // 2.5 HT_BEASTBANE
    const beastbaneLv = skill('HT_BEASTBANE');
    if (beastbaneLv > 0 &&
        (targetRace === RC_INSECT || targetRace === RC_BRUTE || targetRace === RC_PLAYER_DORAM)) {
        damage += (beastbaneLv * 4);
        // 【修改点3】灵魂状态检查
        const spirit = sd.sc ? sd.sc.getSCE(SC_CONSTANTS.Spirit) : null;
        if (spirit && spirit.val2 === 1) {
            damage += (sd.str || 0);
        }
    }

    // 2.6 BS_WEAPONRESEARCH
    const weaponResearchLv = skill('BS_WEAPONRESEARCH');
    if (weaponResearchLv > 0) {
        damage += (weaponResearchLv * 2);
    }

    // 2.7 NV_BREAKTHROUGH
    const breakthroughLv = skill('NV_BREAKTHROUGH');
    if (breakthroughLv > 0) {
        damage += 15 * breakthroughLv + (breakthroughLv > 4 ? 25 : 0);
    }

    // ====== 3. 精气 (Spirit Charm) 属性克制百分比加成 ======
    if (sd.spiritCharm >= MAX_SPIRITCHARM) {
        let charmBonus = false;
        const charmType = sd.spiritCharmType;
        if ((charmType === CHARM_TYPE_FIRE && targetDefEle === ELE_EARTH) ||
            (charmType === CHARM_TYPE_WATER && targetDefEle === ELE_FIRE) ||
            (charmType === CHARM_TYPE_LAND && targetDefEle === ELE_WIND) ||
            (charmType === CHARM_TYPE_WIND && targetDefEle === ELE_WATER)) {
            charmBonus = true;
        }
        if (charmBonus) {
            damage += Math.floor(damage * 30 / 100);
        }
    }

    // ====== 4. 武器熟练度分支 ======
    let weapon = sd.weaponType1 || 0;

    switch (weapon) {
        case W_1HSWORD:
            const axemasteryLv = skill('AM_AXEMASTERY');
            if (axemasteryLv > 0) {
                damage += (axemasteryLv * 3);
            }

        case W_DAGGER:
            const swordLv = skill('SM_SWORD');
            if (swordLv > 0) {
                damage += (swordLv * 4);
            }
            const trainingSwordLv = skill('GN_TRAINING_SWORD');
            if (trainingSwordLv > 0) {
                damage += (trainingSwordLv * 10);
            }
            break;

        case W_2HSWORD:
            const twoHandLv = skill('SM_TWOHAND');
            if (twoHandLv > 0) {
                damage += (twoHandLv * 4);
            }
            break;

        case W_1HSPEAR:
        case W_2HSPEAR:
            const spearLv = skill('KN_SPEARMASTERY');
            if (spearLv > 0) {
                const isRiding = sd.isRiding === true;
                const isRidingDragon = sd.isRidingDragon === true;
                if (!isRiding && !isRidingDragon) {
                    damage += (spearLv * 4);
                } else {
                    damage += (spearLv * 5);
                }
                const dragonTrainingLv = skill('RK_DRAGONTRAINING');
                if (dragonTrainingLv > 0) {
                    damage += (spearLv * 10);
                }
            }
            break;

        case W_1HAXE:
        case W_2HAXE:
            const axeLv = skill('AM_AXEMASTERY');
            if (axeLv > 0) {
                damage += (axeLv * 3);
            }
            const trainingAxeLv = skill('NC_TRAININGAXE');
            if (trainingAxeLv > 0) {
                damage += (trainingAxeLv * 5);
            }
            break;

        case W_MACE:
        case W_2HMACE:
            const maceLv = skill('PR_MACEMASTERY');
            if (maceLv > 0) {
                damage += (maceLv * 3);
            }
            const trainingAxeLv2 = skill('NC_TRAININGAXE');
            if (trainingAxeLv2 > 0) {
                damage += (trainingAxeLv2 * 4);
            }
            break;

        case W_FIST:
            const runLv = skill('TK_RUN');
            if (runLv > 0) {
                damage += (runLv * 10);
            }

        case W_KNUCKLE:
            const ironHandLv = skill('MO_IRONHAND');
            if (ironHandLv > 0) {
                damage += (ironHandLv * 3);
            }
            break;

        case W_MUSICAL:
            const musicalLv = skill('BA_MUSICALLESSON');
            if (musicalLv > 0) {
                damage += (musicalLv * 3);
            }
            break;

        case W_WHIP:
            const danceLv = skill('DC_DANCINGLESSON');
            if (danceLv > 0) {
                damage += (danceLv * 3);
            }
            break;

        case W_BOOK:
            const bookLv = skill('SA_ADVANCEDBOOK');
            if (bookLv > 0) {
                damage += (bookLv * 3);
            }
            break;

        case W_KATAR:
            const katarLv = skill('AS_KATAR');
            if (katarLv > 0) {
                damage += (katarLv * 3);
            }
            break;

        default:
            break;
    }

    return Math.floor(damage);
}

// ============================================================================
// 浏览器环境暴露
// ============================================================================
if (typeof window !== 'undefined') {
    window.calculateMasteryDamage = calculateMasteryDamage;
    window.battleAddWeaponDamage = battleAddWeaponDamage;
    window.battleCalcSizefix = battleCalcSizefix;
    window.battleCalcBaseWeaponAttack = battleCalcBaseWeaponAttack;
    window.W_1HSWORD = W_1HSWORD;
    window.W_DAGGER = W_DAGGER;
    window.W_2HSWORD = W_2HSWORD;
    window.W_1HSPEAR = W_1HSPEAR;
    window.W_2HSPEAR = W_2HSPEAR;
    window.W_1HAXE = W_1HAXE;
    window.W_2HAXE = W_2HAXE;
    window.W_MACE = W_MACE;
    window.W_2HMACE = W_2HMACE;
    window.W_FIST = W_FIST;
    window.W_KNUCKLE = W_KNUCKLE;
    window.W_MUSICAL = W_MUSICAL;
    window.W_WHIP = W_WHIP;
    window.W_BOOK = W_BOOK;
    window.W_KATAR = W_KATAR;
    window.W_BOW = W_BOW;
    window.RC_BRUTE = RC_BRUTE;
    window.RC_PLANT = RC_PLANT;
    window.RC_INSECT = RC_INSECT;
    window.RC_FISH = RC_FISH;
    window.RC_DEMON = RC_DEMON;
    window.RC_PLAYER_DORAM = RC_PLAYER_DORAM;
    window.RC_UNDEAD = RC_UNDEAD;
    window.ELE_FIRE = ELE_FIRE;
    window.ELE_EARTH = ELE_EARTH;
    window.ELE_WIND = ELE_WIND;
    window.ELE_WATER = ELE_WATER;
    window.ELE_UNDEAD = ELE_UNDEAD;
    console.log('[masteryDamage] ✅ 已完整迁移到新状态系统');
}