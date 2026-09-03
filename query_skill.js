// 涓存椂鏌ヨ鑴氭湰锛堝伐鍏风洰褰曪級锛氫粠 SkillData.js 鎻愬彇鎸囧畾鎶€鑳界殑鍏冩暟鎹紝涓嶆妸澶ф枃浠惰杩涘璇濅笂涓嬫枃
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'data', 'SkillData.js'), 'utf8');
const mod = new Function('global', 'window', 'self', src);
mod(global, global, global);
const data = global.SkillData;
const keys = Object.keys(data);
console.log('TOTAL', keys.length);
const pat = /FIREBOLT|COLDBOLT|STORMGUST|DOUBLE|CHAINCOMBO|TRIPLEATTACK|COMBOFINISH/i;
keys.forEach(k => {
  if (pat.test(k)) {
    const s = data[k];
    console.log(JSON.stringify({
      key: k, Name: s.Name, Type: s.Type, Hit: s.Hit, HitCount: s.HitCount,
      MaxLevel: s.MaxLevel, Crit: s.DamageFlags && s.DamageFlags.Critical,
      SplashArea: s.SplashArea, Requires: s.Requires ? Object.keys(s.Requires) : null,
    }));
  }
});

