// Auto-generated from YAML source
(function(global) {
    'use strict';
    const DATA = [
  {
    "Id": 1,
    "Option": "VAR_MAXHPAMOUNT",
    "Script": "bonus bMaxHP,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 2,
    "Option": "VAR_MAXSPAMOUNT",
    "Script": "bonus bMaxSP,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 3,
    "Option": "VAR_STRAMOUNT",
    "Script": "bonus bStr,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 4,
    "Option": "VAR_AGIAMOUNT",
    "Script": "bonus bAgi,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 5,
    "Option": "VAR_VITAMOUNT",
    "Script": "bonus bVit,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 6,
    "Option": "VAR_INTAMOUNT",
    "Script": "bonus bInt,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 7,
    "Option": "VAR_DEXAMOUNT",
    "Script": "bonus bDex,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 8,
    "Option": "VAR_LUKAMOUNT",
    "Script": "bonus bLuk,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 9,
    "Option": "VAR_MAXHPPERCENT",
    "Script": "bonus bMaxHPrate,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 10,
    "Option": "VAR_MAXSPPERCENT",
    "Script": "bonus bMaxSPrate,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 11,
    "Option": "VAR_HPACCELERATION",
    "Script": "bonus bHPrecovRate,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 12,
    "Option": "VAR_SPACCELERATION",
    "Script": "bonus bSPrecovRate,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 13,
    "Option": "VAR_ATKPERCENT",
    "Script": "bonus bAtkRate,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 14,
    "Option": "VAR_MAGICATKPERCENT",
    "Script": "bonus bMatkRate,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 15,
    "Option": "VAR_PLUSASPD",
    "Script": "bonus bAspd,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 16,
    "Option": "VAR_PLUSASPDPERCENT",
    "Script": "bonus bAspdRate,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 17,
    "Option": "VAR_ATTPOWER",
    "Script": "bonus bAtk,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 18,
    "Option": "VAR_HITSUCCESSVALUE",
    "Script": "bonus bHit,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 19,
    "Option": "VAR_ATTMPOWER",
    "Script": "bonus bMatk,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 20,
    "Option": "VAR_ITEMDEFPOWER",
    "Script": "bonus bDef,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 21,
    "Option": "VAR_MDEFPOWER",
    "Script": "bonus bMdef,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 22,
    "Option": "VAR_AVOIDSUCCESSVALUE",
    "Script": "bonus bFlee,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 23,
    "Option": "VAR_PLUSAVOIDSUCCESSVALUE",
    "Script": "bonus bFlee2,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 24,
    "Option": "VAR_CRITICALSUCCESSVALUE",
    "Script": "bonus bCritical,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 25,
    "Option": "ATTR_TOLERACE_NOTHING",
    "Script": "bonus2 bSubEle,Ele_Neutral,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 26,
    "Option": "ATTR_TOLERACE_WATER",
    "Script": "bonus2 bSubEle,Ele_Water,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 27,
    "Option": "ATTR_TOLERACE_GROUND",
    "Script": "bonus2 bSubEle,Ele_Earth,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 28,
    "Option": "ATTR_TOLERACE_FIRE",
    "Script": "bonus2 bSubEle,Ele_Fire,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 29,
    "Option": "ATTR_TOLERACE_WIND",
    "Script": "bonus2 bSubEle,Ele_Wind,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 30,
    "Option": "ATTR_TOLERACE_POISON",
    "Script": "bonus2 bSubEle,Ele_Poison,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 31,
    "Option": "ATTR_TOLERACE_SAINT",
    "Script": "bonus2 bSubEle,Ele_Holy,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 32,
    "Option": "ATTR_TOLERACE_DARKNESS",
    "Script": "bonus2 bSubEle,Ele_Dark,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 33,
    "Option": "ATTR_TOLERACE_TELEKINESIS",
    "Script": "bonus2 bSubEle,Ele_Ghost,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 34,
    "Option": "ATTR_TOLERACE_UNDEAD",
    "Script": "bonus2 bSubEle,Ele_Undead,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 35,
    "Option": "ATTR_TOLERACE_ALLBUTNOTHING",
    "Script": "for(.@i = Ele_Water; .@i < Ele_Undead; ++.@i)\n  bonus2 bSubEle,.@i,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 36,
    "Option": "DAMAGE_PROPERTY_NOTHING_USER",
    "Script": "bonus2 bSubDefEle,Ele_Neutral,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 37,
    "Option": "DAMAGE_PROPERTY_NOTHING_TARGET",
    "Script": "bonus2 bAddEle,Ele_Neutral,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 38,
    "Option": "DAMAGE_PROPERTY_WATER_USER",
    "Script": "bonus2 bSubDefEle,Ele_Water,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 39,
    "Option": "DAMAGE_PROPERTY_WATER_TARGET",
    "Script": "bonus2 bAddEle,Ele_Water,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 40,
    "Option": "DAMAGE_PROPERTY_GROUND_USER",
    "Script": "bonus2 bSubDefEle,Ele_Earth,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 41,
    "Option": "DAMAGE_PROPERTY_GROUND_TARGET",
    "Script": "bonus2 bAddEle,Ele_Earth,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 42,
    "Option": "DAMAGE_PROPERTY_FIRE_USER",
    "Script": "bonus2 bSubDefEle,Ele_Fire,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 43,
    "Option": "DAMAGE_PROPERTY_FIRE_TARGET",
    "Script": "bonus2 bAddEle,Ele_Fire,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 44,
    "Option": "DAMAGE_PROPERTY_WIND_USER",
    "Script": "bonus2 bSubDefEle,Ele_Wind,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 45,
    "Option": "DAMAGE_PROPERTY_WIND_TARGET",
    "Script": "bonus2 bAddEle,Ele_Wind,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 46,
    "Option": "DAMAGE_PROPERTY_POISON_USER",
    "Script": "bonus2 bSubDefEle,Ele_Poison,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 47,
    "Option": "DAMAGE_PROPERTY_POISON_TARGET",
    "Script": "bonus2 bAddEle,Ele_Poison,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 48,
    "Option": "DAMAGE_PROPERTY_SAINT_USER",
    "Script": "bonus2 bSubDefEle,Ele_Holy,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 49,
    "Option": "DAMAGE_PROPERTY_SAINT_TARGET",
    "Script": "bonus2 bAddEle,Ele_Holy,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 50,
    "Option": "DAMAGE_PROPERTY_DARKNESS_USER",
    "Script": "bonus2 bSubDefEle,Ele_Dark,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 51,
    "Option": "DAMAGE_PROPERTY_DARKNESS_TARGET",
    "Script": "bonus2 bAddEle,Ele_Dark,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 52,
    "Option": "DAMAGE_PROPERTY_TELEKINESIS_USER",
    "Script": "bonus2 bSubDefEle,Ele_Ghost,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 53,
    "Option": "DAMAGE_PROPERTY_TELEKINESIS_TARGET",
    "Script": "bonus2 bAddEle,Ele_Ghost,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 54,
    "Option": "DAMAGE_PROPERTY_UNDEAD_USER",
    "Script": "bonus2 bSubDefEle,Ele_Undead,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 55,
    "Option": "DAMAGE_PROPERTY_UNDEAD_TARGET",
    "Script": "bonus2 bAddEle,Ele_Undead,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 56,
    "Option": "MDAMAGE_PROPERTY_NOTHING_USER",
    "Script": "bonus2 bMagicSubDefEle,Ele_Neutral,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 57,
    "Option": "MDAMAGE_PROPERTY_NOTHING_TARGET",
    "Script": "bonus2 bMagicAddEle,Ele_Neutral,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 58,
    "Option": "MDAMAGE_PROPERTY_WATER_USER",
    "Script": "bonus2 bMagicSubDefEle,Ele_Water,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 59,
    "Option": "MDAMAGE_PROPERTY_WATER_TARGET",
    "Script": "bonus2 bMagicAddEle,Ele_Water,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 60,
    "Option": "MDAMAGE_PROPERTY_GROUND_USER",
    "Script": "bonus2 bMagicSubDefEle,Ele_Earth,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 61,
    "Option": "MDAMAGE_PROPERTY_GROUND_TARGET",
    "Script": "bonus2 bMagicAddEle,Ele_Earth,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 62,
    "Option": "MDAMAGE_PROPERTY_FIRE_USER",
    "Script": "bonus2 bMagicSubDefEle,Ele_Fire,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 63,
    "Option": "MDAMAGE_PROPERTY_FIRE_TARGET",
    "Script": "bonus2 bMagicAddEle,Ele_Fire,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 64,
    "Option": "MDAMAGE_PROPERTY_WIND_USER",
    "Script": "bonus2 bMagicSubDefEle,Ele_Wind,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 65,
    "Option": "MDAMAGE_PROPERTY_WIND_TARGET",
    "Script": "bonus2 bMagicAddEle,Ele_Wind,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 66,
    "Option": "MDAMAGE_PROPERTY_POISON_USER",
    "Script": "bonus2 bMagicSubDefEle,Ele_Poison,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 67,
    "Option": "MDAMAGE_PROPERTY_POISON_TARGET",
    "Script": "bonus2 bMagicAddEle,Ele_Poison,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 68,
    "Option": "MDAMAGE_PROPERTY_SAINT_USER",
    "Script": "bonus2 bMagicSubDefEle,Ele_Holy,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 69,
    "Option": "MDAMAGE_PROPERTY_SAINT_TARGET",
    "Script": "bonus2 bMagicAddEle,Ele_Holy,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 70,
    "Option": "MDAMAGE_PROPERTY_DARKNESS_USER",
    "Script": "bonus2 bMagicSubDefEle,Ele_Dark,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 71,
    "Option": "MDAMAGE_PROPERTY_DARKNESS_TARGET",
    "Script": "bonus2 bMagicAddEle,Ele_Dark,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 72,
    "Option": "MDAMAGE_PROPERTY_TELEKINESIS_USER",
    "Script": "bonus2 bMagicSubDefEle,Ele_Ghost,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 73,
    "Option": "MDAMAGE_PROPERTY_TELEKINESIS_TARGET",
    "Script": "bonus2 bMagicAddEle,Ele_Ghost,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 74,
    "Option": "MDAMAGE_PROPERTY_UNDEAD_USER",
    "Script": "bonus2 bMagicSubDefEle,Ele_Undead,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 75,
    "Option": "MDAMAGE_PROPERTY_UNDEAD_TARGET",
    "Script": "bonus2 bMagicAddEle,Ele_Undead,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 76,
    "Option": "BODY_ATTR_NOTHING",
    "Script": "bonus bDefEle,Ele_Neutral;\n"
  },
  {
    "Id": 77,
    "Option": "BODY_ATTR_WATER",
    "Script": "bonus bDefEle,Ele_Water;\n"
  },
  {
    "Id": 78,
    "Option": "BODY_ATTR_GROUND",
    "Script": "bonus bDefEle,Ele_Earth;\n"
  },
  {
    "Id": 79,
    "Option": "BODY_ATTR_FIRE",
    "Script": "bonus bDefEle,Ele_Fire;\n"
  },
  {
    "Id": 80,
    "Option": "BODY_ATTR_WIND",
    "Script": "bonus bDefEle,Ele_Wind;\n"
  },
  {
    "Id": 81,
    "Option": "BODY_ATTR_POISON",
    "Script": "bonus bDefEle,Ele_Poison;\n"
  },
  {
    "Id": 82,
    "Option": "BODY_ATTR_SAINT",
    "Script": "bonus bDefEle,Ele_Holy;\n"
  },
  {
    "Id": 83,
    "Option": "BODY_ATTR_DARKNESS",
    "Script": "bonus bDefEle,Ele_Dark;\n"
  },
  {
    "Id": 84,
    "Option": "BODY_ATTR_TELEKINESIS",
    "Script": "bonus bDefEle,Ele_Ghost;\n"
  },
  {
    "Id": 85,
    "Option": "BODY_ATTR_UNDEAD",
    "Script": "bonus bDefEle,Ele_Undead;\n"
  },
  {
    "Id": 87,
    "Option": "RACE_TOLERACE_NOTHING",
    "Script": "bonus2 bSubRace,RC_Formless,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 88,
    "Option": "RACE_TOLERACE_UNDEAD",
    "Script": "bonus2 bSubRace,RC_Undead,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 89,
    "Option": "RACE_TOLERACE_ANIMAL",
    "Script": "bonus2 bSubRace,RC_Brute,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 90,
    "Option": "RACE_TOLERACE_PLANT",
    "Script": "bonus2 bSubRace,RC_Plant,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 91,
    "Option": "RACE_TOLERACE_INSECT",
    "Script": "bonus2 bSubRace,RC_Insect,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 92,
    "Option": "RACE_TOLERACE_FISHS",
    "Script": "bonus2 bSubRace,RC_Fish,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 93,
    "Option": "RACE_TOLERACE_DEVIL",
    "Script": "bonus2 bSubRace,RC_Demon,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 94,
    "Option": "RACE_TOLERACE_HUMAN",
    "Script": "bonus2 bSubRace,RC_DemiHuman,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 95,
    "Option": "RACE_TOLERACE_ANGEL",
    "Script": "bonus2 bSubRace,RC_Angel,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 96,
    "Option": "RACE_TOLERACE_DRAGON",
    "Script": "bonus2 bSubRace,RC_Dragon,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 97,
    "Option": "RACE_DAMAGE_NOTHING",
    "Script": "bonus2 bAddRace,RC_Formless,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 98,
    "Option": "RACE_DAMAGE_UNDEAD",
    "Script": "bonus2 bAddRace,RC_Undead,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 99,
    "Option": "RACE_DAMAGE_ANIMAL",
    "Script": "bonus2 bAddRace,RC_Brute,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 100,
    "Option": "RACE_DAMAGE_PLANT",
    "Script": "bonus2 bAddRace,RC_Plant,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 101,
    "Option": "RACE_DAMAGE_INSECT",
    "Script": "bonus2 bAddRace,RC_Insect,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 102,
    "Option": "RACE_DAMAGE_FISHS",
    "Script": "bonus2 bAddRace,RC_Fish,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 103,
    "Option": "RACE_DAMAGE_DEVIL",
    "Script": "bonus2 bAddRace,RC_Demon,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 104,
    "Option": "RACE_DAMAGE_HUMAN",
    "Script": "bonus2 bAddRace,RC_DemiHuman,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 105,
    "Option": "RACE_DAMAGE_ANGEL",
    "Script": "bonus2 bAddRace,RC_Angel,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 106,
    "Option": "RACE_DAMAGE_DRAGON",
    "Script": "bonus2 bAddRace,RC_Dragon,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 107,
    "Option": "RACE_MDAMAGE_NOTHING",
    "Script": "bonus2 bMagicAddRace,RC_Formless,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 108,
    "Option": "RACE_MDAMAGE_UNDEAD",
    "Script": "bonus2 bMagicAddRace,RC_Undead,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 109,
    "Option": "RACE_MDAMAGE_ANIMAL",
    "Script": "bonus2 bMagicAddRace,RC_Brute,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 110,
    "Option": "RACE_MDAMAGE_PLANT",
    "Script": "bonus2 bMagicAddRace,RC_Plant,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 111,
    "Option": "RACE_MDAMAGE_INSECT",
    "Script": "bonus2 bMagicAddRace,RC_Insect,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 112,
    "Option": "RACE_MDAMAGE_FISHS",
    "Script": "bonus2 bMagicAddRace,RC_Fish,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 113,
    "Option": "RACE_MDAMAGE_DEVIL",
    "Script": "bonus2 bMagicAddRace,RC_Demon,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 114,
    "Option": "RACE_MDAMAGE_HUMAN",
    "Script": "bonus2 bMagicAddRace,RC_DemiHuman,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 115,
    "Option": "RACE_MDAMAGE_ANGEL",
    "Script": "bonus2 bMagicAddRace,RC_Angel,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 116,
    "Option": "RACE_MDAMAGE_DRAGON",
    "Script": "bonus2 bMagicAddRace,RC_Dragon,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 117,
    "Option": "RACE_CRI_PERCENT_NOTHING",
    "Script": "bonus2 bCriticalAddRace,RC_Formless,getrandomoptinfo(ROA_VALUE)/10;\n"
  },
  {
    "Id": 118,
    "Option": "RACE_CRI_PERCENT_UNDEAD",
    "Script": "bonus2 bCriticalAddRace,RC_Undead,getrandomoptinfo(ROA_VALUE)/10;\n"
  },
  {
    "Id": 119,
    "Option": "RACE_CRI_PERCENT_ANIMAL",
    "Script": "bonus2 bCriticalAddRace,RC_Brute,getrandomoptinfo(ROA_VALUE)/10;\n"
  },
  {
    "Id": 120,
    "Option": "RACE_CRI_PERCENT_PLANT",
    "Script": "bonus2 bCriticalAddRace,RC_Plant,getrandomoptinfo(ROA_VALUE)/10;\n"
  },
  {
    "Id": 121,
    "Option": "RACE_CRI_PERCENT_INSECT",
    "Script": "bonus2 bCriticalAddRace,RC_Insect,getrandomoptinfo(ROA_VALUE)/10;\n"
  },
  {
    "Id": 122,
    "Option": "RACE_CRI_PERCENT_FISHS",
    "Script": "bonus2 bCriticalAddRace,RC_Fish,getrandomoptinfo(ROA_VALUE)/10;\n"
  },
  {
    "Id": 123,
    "Option": "RACE_CRI_PERCENT_DEVIL",
    "Script": "bonus2 bCriticalAddRace,RC_Demon,getrandomoptinfo(ROA_VALUE)/10;\n"
  },
  {
    "Id": 124,
    "Option": "RACE_CRI_PERCENT_HUMAN",
    "Script": "bonus2 bCriticalAddRace,RC_DemiHuman,getrandomoptinfo(ROA_VALUE)/10;\n"
  },
  {
    "Id": 125,
    "Option": "RACE_CRI_PERCENT_ANGEL",
    "Script": "bonus2 bCriticalAddRace,RC_Angel,getrandomoptinfo(ROA_VALUE)/10;\n"
  },
  {
    "Id": 126,
    "Option": "RACE_CRI_PERCENT_DRAGON",
    "Script": "bonus2 bCriticalAddRace,RC_Dragon,getrandomoptinfo(ROA_VALUE)/10;\n"
  },
  {
    "Id": 127,
    "Option": "RACE_IGNORE_DEF_PERCENT_NOTHING",
    "Script": "bonus2 bIgnoreDefRaceRate,RC_Formless,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 128,
    "Option": "RACE_IGNORE_DEF_PERCENT_UNDEAD",
    "Script": "bonus2 bIgnoreDefRaceRate,RC_Undead,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 129,
    "Option": "RACE_IGNORE_DEF_PERCENT_ANIMAL",
    "Script": "bonus2 bIgnoreDefRaceRate,RC_Brute,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 130,
    "Option": "RACE_IGNORE_DEF_PERCENT_PLANT",
    "Script": "bonus2 bIgnoreDefRaceRate,RC_Plant,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 131,
    "Option": "RACE_IGNORE_DEF_PERCENT_INSECT",
    "Script": "bonus2 bIgnoreDefRaceRate,RC_Insect,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 132,
    "Option": "RACE_IGNORE_DEF_PERCENT_FISHS",
    "Script": "bonus2 bIgnoreDefRaceRate,RC_Fish,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 133,
    "Option": "RACE_IGNORE_DEF_PERCENT_DEVIL",
    "Script": "bonus2 bIgnoreDefRaceRate,RC_Demon,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 134,
    "Option": "RACE_IGNORE_DEF_PERCENT_HUMAN",
    "Script": "bonus2 bIgnoreDefRaceRate,RC_DemiHuman,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 135,
    "Option": "RACE_IGNORE_DEF_PERCENT_ANGEL",
    "Script": "bonus2 bIgnoreDefRaceRate,RC_Angel,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 136,
    "Option": "RACE_IGNORE_DEF_PERCENT_DRAGON",
    "Script": "bonus2 bIgnoreDefRaceRate,RC_Dragon,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 137,
    "Option": "RACE_IGNORE_MDEF_PERCENT_NOTHING",
    "Script": "bonus2 bIgnoreMdefRaceRate,RC_Formless,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 138,
    "Option": "RACE_IGNORE_MDEF_PERCENT_UNDEAD",
    "Script": "bonus2 bIgnoreMdefRaceRate,RC_Undead,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 139,
    "Option": "RACE_IGNORE_MDEF_PERCENT_ANIMAL",
    "Script": "bonus2 bIgnoreMdefRaceRate,RC_Brute,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 140,
    "Option": "RACE_IGNORE_MDEF_PERCENT_PLANT",
    "Script": "bonus2 bIgnoreMdefRaceRate,RC_Plant,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 141,
    "Option": "RACE_IGNORE_MDEF_PERCENT_INSECT",
    "Script": "bonus2 bIgnoreMdefRaceRate,RC_Insect,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 142,
    "Option": "RACE_IGNORE_MDEF_PERCENT_FISHS",
    "Script": "bonus2 bIgnoreMdefRaceRate,RC_Fish,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 143,
    "Option": "RACE_IGNORE_MDEF_PERCENT_DEVIL",
    "Script": "bonus2 bIgnoreMdefRaceRate,RC_Demon,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 144,
    "Option": "RACE_IGNORE_MDEF_PERCENT_HUMAN",
    "Script": "bonus2 bIgnoreMdefRaceRate,RC_DemiHuman,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 145,
    "Option": "RACE_IGNORE_MDEF_PERCENT_ANGEL",
    "Script": "bonus2 bIgnoreMdefRaceRate,RC_Angel,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 146,
    "Option": "RACE_IGNORE_MDEF_PERCENT_DRAGON",
    "Script": "bonus2 bIgnoreMdefRaceRate,RC_Dragon,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 147,
    "Option": "CLASS_DAMAGE_NORMAL_TARGET",
    "Script": "bonus2 bAddClass,Class_Normal,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 148,
    "Option": "CLASS_DAMAGE_BOSS_TARGET",
    "Script": "bonus2 bAddClass,Class_Boss,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 149,
    "Option": "CLASS_DAMAGE_NORMAL_USER",
    "Script": "bonus2 bSubClass,Class_Normal,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 150,
    "Option": "CLASS_DAMAGE_BOSS_USER",
    "Script": "bonus2 bSubClass,Class_Boss,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 151,
    "Option": "CLASS_MDAMAGE_NORMAL",
    "Script": "bonus2 bMagicAddClass,Class_Normal,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 152,
    "Option": "CLASS_MDAMAGE_BOSS",
    "Script": "bonus2 bMagicAddClass,Class_Boss,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 153,
    "Option": "CLASS_IGNORE_DEF_PERCENT_NORMAL",
    "Script": "bonus2 bIgnoreDefClassRate,Class_Normal,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 154,
    "Option": "CLASS_IGNORE_DEF_PERCENT_BOSS",
    "Script": "bonus2 bIgnoreDefClassRate,Class_Boss,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 155,
    "Option": "CLASS_IGNORE_MDEF_PERCENT_NORMAL",
    "Script": "bonus2 bIgnoreMdefClassRate,Class_Normal,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 156,
    "Option": "CLASS_IGNORE_MDEF_PERCENT_BOSS",
    "Script": "bonus2 bIgnoreMdefClassRate,Class_Boss,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 157,
    "Option": "DAMAGE_SIZE_SMALL_TARGET",
    "Script": "bonus2 bAddSize,Size_Small,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 158,
    "Option": "DAMAGE_SIZE_MIDIUM_TARGET",
    "Script": "bonus2 bAddSize,Size_Medium,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 159,
    "Option": "DAMAGE_SIZE_LARGE_TARGET",
    "Script": "bonus2 bAddSize,Size_Large,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 160,
    "Option": "DAMAGE_SIZE_SMALL_USER",
    "Script": "bonus2 bSubSize,Size_Small,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 161,
    "Option": "DAMAGE_SIZE_MIDIUM_USER",
    "Script": "bonus2 bSubSize,Size_Medium,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 162,
    "Option": "DAMAGE_SIZE_LARGE_USER",
    "Script": "bonus2 bSubSize,Size_Large,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 163,
    "Option": "DAMAGE_SIZE_PERFECT",
    "Script": "bonus bNoSizeFix,1;\n"
  },
  {
    "Id": 164,
    "Option": "DAMAGE_CRI_TARGET",
    "Script": "bonus bCritAtkRate,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 165,
    "Option": "DAMAGE_CRI_USER",
    "Script": "bonus bCritDefRate,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 166,
    "Option": "RANGE_ATTACK_DAMAGE_TARGET",
    "Script": "bonus bLongAtkRate,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 167,
    "Option": "RANGE_ATTACK_DAMAGE_USER",
    "Script": "bonus bLongAtkDef,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 168,
    "Option": "HEAL_VALUE",
    "Script": "bonus bHealPower,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 169,
    "Option": "HEAL_MODIFY_PERCENT",
    "Script": "bonus bHealPower2,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 170,
    "Option": "DEC_SPELL_CAST_TIME",
    "Script": "bonus bVariableCastrate,-(getrandomoptinfo(ROA_VALUE));\n"
  },
  {
    "Id": 171,
    "Option": "DEC_SPELL_DELAY_TIME",
    "Script": "bonus bDelayrate,-(getrandomoptinfo(ROA_VALUE));\n"
  },
  {
    "Id": 172,
    "Option": "DEC_SP_CONSUMPTION",
    "Script": "bonus bUseSPrate,-(getrandomoptinfo(ROA_VALUE));\n"
  },
  {
    "Id": 175,
    "Option": "WEAPON_ATTR_NOTHING",
    "Script": "bonus bAtkEle,Ele_Neutral;\n"
  },
  {
    "Id": 176,
    "Option": "WEAPON_ATTR_WATER",
    "Script": "bonus bAtkEle,Ele_Water;\n"
  },
  {
    "Id": 177,
    "Option": "WEAPON_ATTR_GROUND",
    "Script": "bonus bAtkEle,Ele_Earth;\n"
  },
  {
    "Id": 178,
    "Option": "WEAPON_ATTR_FIRE",
    "Script": "bonus bAtkEle,Ele_Fire;\n"
  },
  {
    "Id": 179,
    "Option": "WEAPON_ATTR_WIND",
    "Script": "bonus bAtkEle,Ele_Wind;\n"
  },
  {
    "Id": 180,
    "Option": "WEAPON_ATTR_POISON",
    "Script": "bonus bAtkEle,Ele_Poison;\n"
  },
  {
    "Id": 181,
    "Option": "WEAPON_ATTR_SAINT",
    "Script": "bonus bAtkEle,Ele_Holy;\n"
  },
  {
    "Id": 182,
    "Option": "WEAPON_ATTR_DARKNESS",
    "Script": "bonus bAtkEle,Ele_Dark;\n"
  },
  {
    "Id": 183,
    "Option": "WEAPON_ATTR_TELEKINESIS",
    "Script": "bonus bAtkEle,Ele_Ghost;\n"
  },
  {
    "Id": 184,
    "Option": "WEAPON_ATTR_UNDEAD",
    "Script": "bonus bAtkEle,Ele_Undead;\n"
  },
  {
    "Id": 185,
    "Option": "WEAPON_INDESTRUCTIBLE",
    "Script": "bonus bUnbreakableWeapon,1;\n"
  },
  {
    "Id": 186,
    "Option": "BODY_INDESTRUCTIBLE",
    "Script": "bonus bUnbreakableArmor,1;\n"
  },
  {
    "Id": 187,
    "Option": "MDAMAGE_SIZE_SMALL_TARGET",
    "Script": "bonus2 bMagicAddSize,Size_Small,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 188,
    "Option": "MDAMAGE_SIZE_MIDIUM_TARGET",
    "Script": "bonus2 bMagicAddSize,Size_Medium,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 189,
    "Option": "MDAMAGE_SIZE_LARGE_TARGET",
    "Script": "bonus2 bMagicAddSize,Size_Large,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 190,
    "Option": "MDAMAGE_SIZE_SMALL_USER",
    "Script": "bonus2 bMagicSubSize,Size_Small,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 191,
    "Option": "MDAMAGE_SIZE_MIDIUM_USER",
    "Script": "bonus2 bMagicSubSize,Size_Medium,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 192,
    "Option": "MDAMAGE_SIZE_LARGE_USER",
    "Script": "bonus2 bMagicSubSize,Size_Large,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 193,
    "Option": "ATTR_TOLERACE_ALL",
    "Script": "bonus2 bSubEle,Ele_All,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 194,
    "Option": "RACE_WEAPON_TOLERACE_NOTHING",
    "Script": "bonus3 bSubRace,RC_Formless,getrandomoptinfo(ROA_VALUE),BF_WEAPON;\n"
  },
  {
    "Id": 195,
    "Option": "RACE_WEAPON_TOLERACE_UNDEAD",
    "Script": "bonus3 bSubRace,RC_Undead,getrandomoptinfo(ROA_VALUE),BF_WEAPON;\n"
  },
  {
    "Id": 196,
    "Option": "RACE_WEAPON_TOLERACE_ANIMAL",
    "Script": "bonus3 bSubRace,RC_Brute,getrandomoptinfo(ROA_VALUE),BF_WEAPON;\n"
  },
  {
    "Id": 197,
    "Option": "RACE_WEAPON_TOLERACE_PLANT",
    "Script": "bonus3 bSubRace,RC_Plant,getrandomoptinfo(ROA_VALUE),BF_WEAPON;\n"
  },
  {
    "Id": 198,
    "Option": "RACE_WEAPON_TOLERACE_INSECT",
    "Script": "bonus3 bSubRace,RC_Insect,getrandomoptinfo(ROA_VALUE),BF_WEAPON;\n"
  },
  {
    "Id": 199,
    "Option": "RACE_WEAPON_TOLERACE_FISHS",
    "Script": "bonus3 bSubRace,RC_Fish,getrandomoptinfo(ROA_VALUE),BF_WEAPON;\n"
  },
  {
    "Id": 200,
    "Option": "RACE_WEAPON_TOLERACE_DEVIL",
    "Script": "bonus3 bSubRace,RC_Demon,getrandomoptinfo(ROA_VALUE),BF_WEAPON;\n"
  },
  {
    "Id": 201,
    "Option": "RACE_WEAPON_TOLERACE_HUMAN",
    "Script": "bonus3 bSubRace,RC_DemiHuman,getrandomoptinfo(ROA_VALUE),BF_WEAPON;\n"
  },
  {
    "Id": 202,
    "Option": "RACE_WEAPON_TOLERACE_ANGEL",
    "Script": "bonus3 bSubRace,RC_Angel,getrandomoptinfo(ROA_VALUE),BF_WEAPON;\n"
  },
  {
    "Id": 203,
    "Option": "RACE_WEAPON_TOLERACE_DRAGON",
    "Script": "bonus3 bSubRace,RC_Dragon,getrandomoptinfo(ROA_VALUE),BF_WEAPON;\n"
  },
  {
    "Id": 206,
    "Option": "RACE_TOLERACE_PLAYER_HUMAN",
    "Script": "bonus2 bSubRace,RC_Player_Human,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 207,
    "Option": "RACE_TOLERACE_PLAYER_DORAM",
    "Script": "bonus2 bSubRace,RC_Player_Doram,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 208,
    "Option": "RACE_DAMAGE_PLAYER_HUMAN",
    "Script": "bonus2 bAddRace,RC_Player_Human,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 209,
    "Option": "RACE_DAMAGE_PLAYER_DORAM",
    "Script": "bonus2 bAddRace,RC_Player_Doram,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 210,
    "Option": "RACE_MDAMAGE_PLAYER_HUMAN",
    "Script": "bonus2 bMagicAddRace,RC_Player_Human,getrandomoptinfo(ROA_VALUE); \n"
  },
  {
    "Id": 211,
    "Option": "RACE_MDAMAGE_PLAYER_DORAM",
    "Script": "bonus2 bMagicAddRace,RC_Player_Doram,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 212,
    "Option": "RACE_CRI_PERCENT_PLAYER_HUMAN",
    "Script": "bonus2 bCriticalAddRace,RC_Player_Human,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 213,
    "Option": "RACE_CRI_PERCENT_PLAYER_DORAM",
    "Script": "bonus2 bCriticalAddRace,RC_Player_Doram,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 214,
    "Option": "RACE_IGNORE_DEF_PERCENT_PLAYER_HUMAN",
    "Script": "bonus2 bIgnoreDefRaceRate,RC_Player_Human,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 215,
    "Option": "RACE_IGNORE_DEF_PERCENT_PLAYER_DORAM",
    "Script": "bonus2 bIgnoreDefRaceRate,RC_Player_Doram,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 216,
    "Option": "RACE_IGNORE_MDEF_PERCENT_PLAYER_HUMAN",
    "Script": "bonus2 bIgnoreMdefRaceRate,RC_Player_Human,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 217,
    "Option": "RACE_IGNORE_MDEF_PERCENT_PLAYER_DORAM",
    "Script": "bonus2 bIgnoreMdefRaceRate,RC_Player_Doram,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 218,
    "Option": "REFLECT_DAMAGE_PERCENT",
    "Script": "bonus bReduceDamageReturn,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 219,
    "Option": "MELEE_ATTACK_DAMAGE_TARGET",
    "Script": "bonus bShortAtkRate,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 220,
    "Option": "MELEE_ATTACK_DAMAGE_USER",
    "Script": "bonus bNearAtkDef,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 221,
    "Option": "ADDSKILLMDAMAGE_NOTHING",
    "Script": "bonus2 bMagicAtkEle,Ele_Neutral,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 222,
    "Option": "ADDSKILLMDAMAGE_WATER",
    "Script": "bonus2 bMagicAtkEle,Ele_Water,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 223,
    "Option": "ADDSKILLMDAMAGE_GROUND",
    "Script": "bonus2 bMagicAtkEle,Ele_Earth,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 224,
    "Option": "ADDSKILLMDAMAGE_FIRE",
    "Script": "bonus2 bMagicAtkEle,Ele_Fire,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 225,
    "Option": "ADDSKILLMDAMAGE_WIND",
    "Script": "bonus2 bMagicAtkEle,Ele_Wind,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 226,
    "Option": "ADDSKILLMDAMAGE_POISON",
    "Script": "bonus2 bMagicAtkEle,Ele_Poison,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 227,
    "Option": "ADDSKILLMDAMAGE_SAINT",
    "Script": "bonus2 bMagicAtkEle,Ele_Holy,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 228,
    "Option": "ADDSKILLMDAMAGE_DARKNESS",
    "Script": "bonus2 bMagicAtkEle,Ele_Dark,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 229,
    "Option": "ADDSKILLMDAMAGE_TELEKINESIS",
    "Script": "bonus2 bMagicAtkEle,Ele_Ghost,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 230,
    "Option": "ADDSKILLMDAMAGE_UNDEAD",
    "Script": "bonus2 bMagicAtkEle,Ele_Undead,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 231,
    "Option": "ADDSKILLMDAMAGE_ALL",
    "Script": "bonus2 bMagicAtkEle,Ele_All,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 232,
    "Option": "ADDEXPPERCENT_KILLRACE_NOTHING",
    "Script": "bonus2 bExpAddRace,RC_Formless,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 233,
    "Option": "ADDEXPPERCENT_KILLRACE_UNDEAD",
    "Script": "bonus2 bExpAddRace,RC_Undead,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 234,
    "Option": "ADDEXPPERCENT_KILLRACE_ANIMAL",
    "Script": "bonus2 bExpAddRace,RC_Brute,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 235,
    "Option": "ADDEXPPERCENT_KILLRACE_PLANT",
    "Script": "bonus2 bExpAddRace,RC_Plant,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 236,
    "Option": "ADDEXPPERCENT_KILLRACE_INSECT",
    "Script": "bonus2 bExpAddRace,RC_Insect,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 237,
    "Option": "ADDEXPPERCENT_KILLRACE_FISHS",
    "Script": "bonus2 bExpAddRace,RC_Fish,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 238,
    "Option": "ADDEXPPERCENT_KILLRACE_DEVIL",
    "Script": "bonus2 bExpAddRace,RC_Demon,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 239,
    "Option": "ADDEXPPERCENT_KILLRACE_HUMAN",
    "Script": "bonus2 bExpAddRace,RC_DemiHuman,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 240,
    "Option": "ADDEXPPERCENT_KILLRACE_ANGEL",
    "Script": "bonus2 bExpAddRace,RC_Angel,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 241,
    "Option": "ADDEXPPERCENT_KILLRACE_DRAGON",
    "Script": "bonus2 bExpAddRace,RC_Dragon,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 242,
    "Option": "ADDEXPPERCENT_KILLRACE_ALL",
    "Script": "bonus2 bExpAddRace,RC_All,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 243,
    "Option": "VAR_POWAMOUNT",
    "Script": "bonus bPow,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 244,
    "Option": "VAR_SPLAMOUNT",
    "Script": "bonus bSpl,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 245,
    "Option": "VAR_STAAMOUNT",
    "Script": "bonus bSta,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 246,
    "Option": "VAR_WISAMOUNT",
    "Script": "bonus bWis,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 247,
    "Option": "VAR_CONAMOUNT",
    "Script": "bonus bCon,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 248,
    "Option": "VAR_CRTAMOUNT",
    "Script": "bonus bCrt,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 249,
    "Option": "VAR_PATKAMOUNT",
    "Script": "bonus bPAtk,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 250,
    "Option": "VAR_SMATKAMOUNT",
    "Script": "bonus bSMatk,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 251,
    "Option": "VAR_RESAMOUNT",
    "Script": "bonus bRes,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 252,
    "Option": "VAR_MRESAMOUNT",
    "Script": "bonus bMRes,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 253,
    "Option": "VAR_HEAL_PLUS",
    "Script": "bonus bHPlus,getrandomoptinfo(ROA_VALUE);\n"
  },
  {
    "Id": 254,
    "Option": "VAR_CRITICAL_RATE",
    "Script": "bonus bCRate,getrandomoptinfo(ROA_VALUE);\n"
  }
];
    global.ItemRandomOptData = DATA;
    console.log('[Data] Loaded ItemRandomOptData with ' + DATA.length + ' records');
})(window);
