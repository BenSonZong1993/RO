(function(global) {
    'use strict';

    // ---------- 数据定义 ----------
    
const ASPD_DATA = [
  {
    "Jobs": {
      "Novice": true,
      "Super_Novice": true,
      "Novice_High": true,
      "Baby": true,
      "Super_Baby": true,
      "Super_Novice_E": true,
      "Super_Baby_E": true,
      "Hyper_Novice": true
    },
    "BaseASPD": {
      "Fist": 40,
      "Dagger": 55,
      "1hSword": 57,
      "1hAxe": 50,
      "Mace": 50,
      "2hMace": 55,
      "Staff": 65,
      "2hStaff": 65,
      "Shield": 10
    }
  },
  {
    "Jobs": {
      "Swordman": true,
      "Swordman_High": true,
      "Baby_Swordman": true
    },
    "BaseASPD": {
      "Fist": 40,
      "Dagger": 47,
      "1hSword": 47,
      "2hSword": 54,
      "1hSpear": 57,
      "2hSpear": 65,
      "1hAxe": 55,
      "2hAxe": 60,
      "Mace": 50,
      "2hMace": 55,
      "Shield": 5
    }
  },
  {
    "Jobs": {
      "Mage": true,
      "Mage_High": true,
      "Baby_Mage": true
    },
    "BaseASPD": {
      "Fist": 50,
      "Dagger": 50,
      "Staff": 55,
      "2hStaff": 55,
      "Shield": 10
    }
  },
  {
    "Jobs": {
      "Archer": true,
      "Archer_High": true,
      "Baby_Archer": true
    },
    "BaseASPD": {
      "Fist": 40,
      "Dagger": 55,
      "Bow": 50,
      "Shield": 9
    }
  },
  {
    "Jobs": {
      "Acolyte": true,
      "Acolyte_High": true,
      "Baby_Acolyte": true
    },
    "BaseASPD": {
      "Fist": 40,
      "Mace": 45,
      "2hMace": 50,
      "Staff": 60,
      "2hStaff": 60,
      "Shield": 7
    }
  },
  {
    "Jobs": {
      "Merchant": true,
      "Merchant_High": true,
      "Baby_Merchant": true
    },
    "BaseASPD": {
      "Fist": 40,
      "Dagger": 52,
      "1hSword": 52,
      "1hAxe": 48,
      "2hAxe": 55,
      "Mace": 50,
      "2hMace": 55,
      "Shield": 5
    }
  },
  {
    "Jobs": {
      "Thief": true,
      "Thief_High": true,
      "Baby_Thief": true
    },
    "BaseASPD": {
      "Fist": 40,
      "Dagger": 48,
      "1hSword": 50,
      "1hAxe": 60,
      "Bow": 53,
      "Shield": 6
    }
  },
  {
    "Jobs": {
      "Knight": true,
      "Knight2": true,
      "Lord_Knight": true,
      "Lord_Knight2": true,
      "Baby_Knight": true,
      "Baby_Knight2": true
    },
    "BaseASPD": {
      "Fist": 40,
      "Dagger": 49,
      "1hSword": 45,
      "2hSword": 52,
      "1hSpear": 55,
      "2hSpear": 60,
      "1hAxe": 50,
      "2hAxe": 55,
      "Mace": 45,
      "2hMace": 50,
      "Shield": 5
    }
  },
  {
    "Jobs": {
      "Priest": true,
      "High_Priest": true,
      "Baby_Priest": true
    },
    "BaseASPD": {
      "Fist": 40,
      "Mace": 43,
      "2hMace": 48,
      "Staff": 60,
      "Knuckle": 60,
      "Book": 44,
      "2hStaff": 60,
      "Shield": 5
    }
  },
  {
    "Jobs": {
      "Wizard": true,
      "High_Wizard": true,
      "Baby_Wizard": true
    },
    "BaseASPD": {
      "Fist": 50,
      "Dagger": 54,
      "Staff": 53,
      "2hStaff": 53,
      "Shield": 8
    }
  },
  {
    "Jobs": {
      "Blacksmith": true,
      "Whitesmith": true,
      "Baby_Blacksmith": true
    },
    "BaseASPD": {
      "Fist": 40,
      "Dagger": 50,
      "1hSword": 50,
      "1hAxe": 46,
      "2hAxe": 53,
      "Mace": 48,
      "2hMace": 53,
      "Shield": 5
    }
  },
  {
    "Jobs": {
      "Hunter": true,
      "Sniper": true,
      "Baby_Hunter": true
    },
    "BaseASPD": {
      "Fist": 40,
      "Dagger": 53,
      "Bow": 48,
      "Shield": 9
    }
  },
  {
    "Jobs": {
      "Assassin": true,
      "Assassin_Cross": true,
      "Baby_Assassin": true
    },
    "BaseASPD": {
      "Fist": 40,
      "Dagger": 42,
      "1hSword": 50,
      "1hAxe": 51,
      "Katar": 42,
      "Huuma": 110,
      "Shield": 6
    }
  },
  {
    "Jobs": {
      "Crusader": true,
      "Crusader2": true,
      "Paladin": true,
      "Paladin2": true,
      "Baby_Crusader": true,
      "Baby_Crusader2": true
    },
    "BaseASPD": {
      "Fist": 40,
      "Dagger": 48,
      "1hSword": 43,
      "2hSword": 55,
      "1hSpear": 53,
      "2hSpear": 52,
      "1hAxe": 50,
      "2hAxe": 55,
      "Mace": 45,
      "2hMace": 50,
      "Shield": 5
    }
  },
  {
    "Jobs": {
      "Monk": true,
      "Champion": true,
      "Baby_Monk": true
    },
    "BaseASPD": {
      "Fist": 40,
      "Mace": 43,
      "2hMace": 48,
      "Staff": 60,
      "Knuckle": 40,
      "2hStaff": 58,
      "Shield": 5
    }
  },
  {
    "Jobs": {
      "Sage": true,
      "Professor": true,
      "Baby_Sage": true
    },
    "BaseASPD": {
      "Fist": 45,
      "Dagger": 53,
      "1hSword": 60,
      "Staff": 55,
      "Book": 43,
      "2hStaff": 55,
      "Shield": 5
    }
  },
  {
    "Jobs": {
      "Rogue": true,
      "Stalker": true,
      "Baby_Rogue": true
    },
    "BaseASPD": {
      "Fist": 40,
      "Dagger": 45,
      "1hSword": 50,
      "Bow": 50,
      "Shield": 5
    }
  },
  {
    "Jobs": {
      "Alchemist": true,
      "Creator": true,
      "Baby_Alchemist": true
    },
    "BaseASPD": {
      "Fist": 40,
      "Dagger": 50,
      "1hSword": 45,
      "1hAxe": 45,
      "2hAxe": 52,
      "Mace": 45,
      "2hMace": 50,
      "Shield": 4
    }
  },
  {
    "Jobs": {
      "Bard": true,
      "Clown": true,
      "Baby_Bard": true
    },
    "BaseASPD": {
      "Fist": 40,
      "Dagger": 53,
      "Bow": 48,
      "Musical": 45,
      "Shield": 7
    }
  },
  {
    "Jobs": {
      "Dancer": true,
      "Gypsy": true,
      "Baby_Dancer": true
    },
    "BaseASPD": {
      "Fist": 40,
      "Dagger": 53,
      "Bow": 48,
      "Whip": 45,
      "Shield": 7
    }
  },
  {
    "Jobs": {
      "Gunslinger": true,
      "Baby_Gunslinger": true
    },
    "BaseASPD": {
      "Fist": 50,
      "Revolver": 45,
      "Rifle": 55,
      "Gatling": 50,
      "Shotgun": 90,
      "Grenade": 100,
      "Shield": 6
    }
  },
  {
    "Jobs": {
      "Ninja": true,
      "Baby_Ninja": true
    },
    "BaseASPD": {
      "Fist": 40,
      "Dagger": 43,
      "Huuma": 55,
      "Shield": 6
    }
  },
  {
    "Jobs": {
      "Taekwon": true,
      "Baby_Taekwon": true
    },
    "BaseASPD": {
      "Fist": 40,
      "Shield": 6
    }
  },
  {
    "Jobs": {
      "Star_Gladiator": true,
      "Star_Gladiator2": true,
      "Baby_Star_Gladiator": true,
      "Baby_Star_Gladiator2": true
    },
    "BaseASPD": {
      "Fist": 40,
      "Book": 50,
      "Shield": 6
    }
  },
  {
    "Jobs": {
      "Soul_Linker": true,
      "Baby_Soul_Linker": true
    },
    "BaseASPD": {
      "Fist": 50,
      "Dagger": 50,
      "Staff": 53,
      "2hStaff": 55,
      "Shield": 8
    }
  },
  {
    "Jobs": {
      "Rune_Knight": true,
      "Rune_Knight2": true,
      "Rune_Knight_T": true,
      "Rune_Knight_T2": true,
      "Baby_Rune_Knight": true,
      "Baby_Rune_Knight2": true,
      "Dragon_Knight": true,
      "Dragon_Knight2": true
    },
    "BaseASPD": {
      "Fist": 40,
      "Dagger": 50,
      "1hSword": 52,
      "2hSword": 55,
      "1hSpear": 60,
      "2hSpear": 58,
      "1hAxe": 48,
      "2hAxe": 52,
      "Mace": 45,
      "2hMace": 52,
      "Shield": 5
    }
  },
  {
    "Jobs": {
      "Warlock": true,
      "Warlock_T": true,
      "Baby_Warlock": true,
      "Arch_Mage": true
    },
    "BaseASPD": {
      "Fist": 45,
      "Dagger": 52,
      "1hSword": 60,
      "Staff": 50,
      "2hStaff": 56,
      "Shield": 5
    }
  },
  {
    "Jobs": {
      "Ranger": true,
      "Ranger2": true,
      "Ranger_T": true,
      "Ranger_T2": true,
      "Baby_Ranger": true,
      "Baby_Ranger2": true,
      "Windhawk": true,
      "Windhawk2": true
    },
    "BaseASPD": {
      "Fist": 40,
      "Dagger": 50,
      "Bow": 49,
      "Shield": 8
    }
  },
  {
    "Jobs": {
      "Arch_Bishop": true,
      "Arch_Bishop_T": true,
      "Baby_Arch_Bishop": true,
      "Cardinal": true
    },
    "BaseASPD": {
      "Fist": 45,
      "Mace": 45,
      "2hMace": 45,
      "Staff": 60,
      "Knuckle": 50,
      "Book": 44,
      "2hStaff": 55,
      "Shield": 5
    }
  },
  {
    "Jobs": {
      "Mechanic": true,
      "Mechanic2": true,
      "Mechanic_T": true,
      "Mechanic_T2": true,
      "Baby_Mechanic": true,
      "Baby_Mechanic2": true,
      "Meister": true,
      "Meister2": true
    },
    "BaseASPD": {
      "Fist": 40,
      "Dagger": 60,
      "1hSword": 65,
      "1hAxe": 45,
      "2hAxe": 48,
      "Mace": 48,
      "2hMace": 50,
      "Shield": 6
    }
  },
  {
    "Jobs": {
      "Guillotine_Cross": true,
      "Guillotine_Cross_T": true,
      "Baby_Guillotine_Cross": true,
      "Shadow_Cross": true
    },
    "BaseASPD": {
      "Fist": 40,
      "Dagger": 42,
      "1hSword": 65,
      "1hAxe": 80,
      "Katar": 42,
      "Rifle": 95,
      "Gatling": 120,
      "Shotgun": 90,
      "Grenade": 100,
      "Huuma": 110,
      "Shield": 9
    }
  },
  {
    "Jobs": {
      "Royal_Guard": true,
      "Royal_Guard2": true,
      "Royal_Guard_T": true,
      "Royal_Guard_T2": true,
      "Baby_Royal_Guard": true,
      "Baby_Royal_Guard2": true,
      "Imperial_Guard": true,
      "Imperial_Guard2": true
    },
    "BaseASPD": {
      "Fist": 40,
      "Dagger": 47,
      "1hSword": 45,
      "2hSword": 53,
      "1hSpear": 50,
      "2hSpear": 50,
      "1hAxe": 48,
      "2hAxe": 52,
      "Mace": 44,
      "2hMace": 50,
      "Shield": 5
    }
  },
  {
    "Jobs": {
      "Sorcerer": true,
      "Sorcerer_T": true,
      "Baby_Sorcerer": true,
      "Elemental_Master": true
    },
    "BaseASPD": {
      "Fist": 40,
      "Dagger": 50,
      "1hSword": 50,
      "Staff": 45,
      "Book": 45,
      "2hStaff": 55,
      "Shield": 5
    }
  },
  {
    "Jobs": {
      "Minstrel": true,
      "Minstrel_T": true,
      "Baby_Minstrel": true,
      "Troubadour": true
    },
    "BaseASPD": {
      "Fist": 40,
      "Dagger": 52,
      "Bow": 49,
      "Musical": 44,
      "Shield": 7
    }
  },
  {
    "Jobs": {
      "Wanderer": true,
      "Wanderer_T": true,
      "Baby_Wanderer": true,
      "Trouvere": true
    },
    "BaseASPD": {
      "Fist": 40,
      "Dagger": 52,
      "Bow": 49,
      "Whip": 44,
      "Shield": 7
    }
  },
  {
    "Jobs": {
      "Sura": true,
      "Sura_T": true,
      "Baby_Sura": true,
      "Inquisitor": true
    },
    "BaseASPD": {
      "Fist": 38,
      "Mace": 43,
      "2hMace": 45,
      "Staff": 48,
      "Knuckle": 39,
      "2hStaff": 50,
      "Shield": 5
    }
  },
  {
    "Jobs": {
      "Genetic": true,
      "Genetic_T": true,
      "Baby_Genetic": true,
      "Biolo": true
    },
    "BaseASPD": {
      "Fist": 40,
      "Dagger": 50,
      "1hSword": 44,
      "1hAxe": 48,
      "2hAxe": 51,
      "Mace": 44,
      "2hMace": 48,
      "Shield": 4
    }
  },
  {
    "Jobs": {
      "Shadow_Chaser": true,
      "Shadow_Chaser_T": true,
      "Baby_Shadow_Chaser": true,
      "Abyss_Chaser": true
    },
    "BaseASPD": {
      "Fist": 40,
      "Dagger": 43,
      "1hSword": 47,
      "Bow": 47,
      "Shield": 4
    }
  },
  {
    "Jobs": {
      "Kagerou": true,
      "Oboro": true,
      "Baby_Kagerou": true,
      "Baby_Oboro": true,
      "Shinkiro": true,
      "Shiranui": true
    },
    "BaseASPD": {
      "Fist": 40,
      "Dagger": 45,
      "Huuma": 50,
      "Shield": 3
    }
  },
  {
    "Jobs": {
      "Rebellion": true,
      "Baby_Rebellion": true,
      "Night_Watch": true
    },
    "BaseASPD": {
      "Fist": 45,
      "Revolver": 50,
      "Rifle": 55,
      "Gatling": 48,
      "Shotgun": 75,
      "Grenade": 80,
      "Shield": 10
    }
  },
  {
    "Jobs": {
      "Summoner": true,
      "Baby_Summoner": true,
      "Spirit_Handler": true
    },
    "BaseASPD": {
      "Fist": 40,
      "Staff": 60,
      "Shield": 7
    }
  },
  {
    "Jobs": {
      "Star_Emperor": true,
      "Star_Emperor2": true,
      "Baby_Star_Emperor": true,
      "Baby_Star_Emperor2": true,
      "Sky_Emperor": true,
      "Sky_Emperor2": true
    },
    "BaseASPD": {
      "Fist": 40,
      "Book": 45,
      "Shield": 3
    }
  },
  {
    "Jobs": {
      "Soul_Reaper": true,
      "Baby_Soul_Reaper": true,
      "Soul_Ascetic": true
    },
    "BaseASPD": {
      "Fist": 45,
      "Dagger": 40,
      "Staff": 50,
      "2hStaff": 52,
      "Shield": 5
    }
  }
];


    // ---------- 暴露给全局 ----------
    // 选择其一（通常用 window 或 global，二者在浏览器中指向同一对象）
window.JOB_ASPD = ASPD_DATA;   // 正确暴露
    console.log('[Job_ASPD] ✅ 已加载，共 ' + ASPD_DATA.length + ' 个职业组');
})(window);