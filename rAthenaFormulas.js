// ============================================================
//  rAthenaFormulas.js – 纯公式（无数据依赖）
//  仅保留战斗/面板派生函数，HP/SP/ASPD 由属性管线负责
// ============================================================

(function(global) {
    'use strict';

    function floor(v) { return Math.floor(v); }
    function max(a, b) { return Math.max(a, b); }
    function cap(val, lo, hi) { return Math.max(lo, Math.min(hi, val)); }

    // ---------- 1. 素质 ATK ----------
    function calcStatusATK(char, isRenewal, weaponType) {
        if (weaponType) weaponType = weaponType.toLowerCase();
        let str = char.str || 0;
        let dex = char.dex || 0;
        let luk = char.luk || 0;
        let level = char.level || 1;
        let pow = char.pow || 0;

        const isRanged = (weaponType === 'bow' || weaponType === 'musical' || weaponType === 'whip' ||
                          weaponType === 'revolver' || weaponType === 'rifle' || weaponType === 'gatling' ||
                          weaponType === 'shotgun' || weaponType === 'grenade');

        if (isRanged) {
            let temp = str;
            str = dex;
            dex = temp;
        }

        let atk = 0;
        if (isRenewal) {
            let base = str +
                       Math.floor(str / 10) * Math.floor(str / 10) +
                       Math.floor(dex / 5) +
                       Math.floor(luk / 5) +
                       Math.floor(level / 4);
            atk = base + 5 * pow;
        } else {
            let dstr = Math.floor(str / 10);
            atk = str + dstr * dstr + Math.floor(dex / 5) + Math.floor(luk / 5);
        }
        return Math.floor(Math.max(atk, 0));
    }

    // ---------- 2. 素质 MATK ----------
    function calcStatusMATK(char, isRenewal) {
        let int_ = char.int || 0;
        let dex = char.dex || 0;
        let luk = char.luk || 0;
        let level = char.level || 1;
        let spl = char.spl || 0;

        let matk_min, matk_max;
        if (isRenewal) {
            let base = floor(int_ / 2) + floor(dex / 5) + floor(luk / 3) + floor(level / 4) + 5 * spl;
            matk_min = base;
            matk_max = base;
        } else {
            matk_min = int_ + floor(int_ / 7) * floor(int_ / 7);
            matk_max = int_ + floor(int_ / 5) * floor(int_ / 5);
        }
        let avg = floor((matk_min + matk_max) / 2);
        return max(avg, 0);
    }

    // ---------- 3. 面板 HIT ----------
    function calcPanelHIT(char) {
        let level = char.level || 1;
        let dex = char.dex || 0;
        let luk = char.luk || 0;
        let con = char.con || 0;
        let extra = (char.hitBonus || 0);
        let hit = level + dex + floor(luk / 3) + 2 * con + extra;
        return floor(max(hit, 1));
    }

    // ---------- 4. 面板 FLEE ----------
    function calcPanelFLEE(char) {
        let level = char.level || 1;
        let agi = char.agi || 0;
        let luk = char.luk || 0;
        let con = char.con || 0;
        let extra = (char.fleeBonus || 0);
        let flee = level + agi + floor(luk / 5) + 2 * con + extra;
        return floor(max(flee, 1));
    }

    // ---------- 5. 暴击率 ----------
    function calcCRI(char) {
        let luk = char.luk || 0;
        let extra = (char.criBonus || 0);
        let cri = 10 + luk * 0.3 + extra;
        return floor(max(cri, 0));
    }

    // ---------- 6. 完美回避 ----------
    function calcPerfectDodge(char) {
        let luk = char.luk || 0;
        let extra = (char.flee2Bonus || 0);
        let pd = 10 + floor(luk / 10) + extra;
        return floor(max(pd, 0));
    }

    // ---------- 7. 物理防御 ----------
    function calcStatusDEF(char) {
        let vit = char.vit || 0;
        let extra = (char.defBonus || 0);
        let def = floor(vit / 2) + extra;
        return max(def, 0);
    }

    // ---------- 8. 魔法防御 ----------
    function calcStatusMDEF(char) {
        let int_ = char.int || 0;
        let extra = (char.mdefBonus || 0);
        let mdef = floor(int_ / 2) + extra;
        return max(mdef, 0);
    }

    // ---------- 9. 命中率 ----------
    function calcHitRate(attackerHIT, defenderFLEE) {
        let rate = 80 + attackerHIT - defenderFLEE;
        return cap(rate, 5, 95);
    }

    // ---------- 导出 ----------
    global.rAthena = global.rAthena || {};
    global.rAthena.formulas = {
        calcStatusATK: calcStatusATK,
        calcStatusMATK: calcStatusMATK,
        calcPanelHIT: calcPanelHIT,
        calcPanelFLEE: calcPanelFLEE,
        calcCRI: calcCRI,
        calcPerfectDodge: calcPerfectDodge,
        calcStatusDEF: calcStatusDEF,
        calcStatusMDEF: calcStatusMDEF,
        calcHitRate: calcHitRate
    };

    console.log('[rAthenaFormulas] ✅ 已重构（纯公式，无数据依赖）');
})(window);