// Balance for prototypen af The Maw.
//
// Alle tal, der styrer spillet, står her, så de kan justeres uden at røre koden.
// Ret et tal, gem filen og genindlæs siden. Tider er i sekunder, afstande i felter (tiles),
// og en egenskab starter på 10. Navne og tekster, spilleren ser, er på engelsk.

export const BALANCE = {
  // --- Karakteren ---------------------------------------------------------------------------
  character: {
    startAttribute: 10, // alle egenskaber starter her, før baggrunden lægger til
    startGold: 60,
    startPotions: 2,
    startRations: 3,
    maxConsumables: 9, // højst så mange potions og rations hver
    baseHp: 40,
    hpPerConstitution: 6, // liv pr. Constitution over 10
    hpPerMark: 4, // liv pr. Mark (niveau) over 1
    hpRegen: 0.3, // liv pr. sekund, når man ikke sulter
    baseStamina: 60,
    staminaPerStamina: 5, // stamina pr. Stamina over 10
    staminaRegen: 14, // pr. sekund
    staminaRegenPerStamina: 0.7,
    baseFocus: 20, // Focus bruges af Echo Bolt
    focusPerIntelligence: 4,
    focusRegen: 2.5,
    focusRegenPerIntelligence: 0.15,
    moveSpeed: 4.2, // felter pr. sekund
    critChance: 0.05,
    critPerDexterity: 0.005, // +0,5 % kritisk chance pr. Dexterity over 10
    critMultiplier: 1.6,
    baseCapacity: 12, // pladser i inventory
    capacityPerTwoStrength: 1, // +1 plads pr. 2 Strength over 10
  },

  // Baggrunde: hvad karakteren starter med (historiens fire baggrunde).
  backgrounds: [
    {
      id: 'miner',
      name: 'Miner',
      text: 'Dug Echo crystals in the shafts of Cinderhollow. Strong and hard to kill.',
      attributes: { strength: 3, constitution: 2 },
      skills: { heavy: 10, blades: 3, bows: 1, echo: 1 },
      weapon: 'pickaxe',
    },
    {
      id: 'poacher',
      name: 'Poacher',
      text: "Hunted the Crown's deer by night. Quick hands, sharp eyes.",
      attributes: { dexterity: 4, stamina: 1 },
      skills: { bows: 10, blades: 4, heavy: 1, echo: 1 },
      weapon: 'short_bow',
    },
    {
      id: 'acolyte',
      name: 'Temple Acolyte',
      text: 'Studied the Echo in the temple archives. Weak arm, bright mind.',
      attributes: { intelligence: 4, stamina: 1 },
      skills: { echo: 10, blades: 4, bows: 2, heavy: 0 },
      weapon: 'dagger',
    },
    {
      id: 'runner',
      name: 'Street Runner',
      text: 'Ran messages and errands through every alley in Aurum. Never tires.',
      attributes: { stamina: 3, dexterity: 2 },
      skills: { blades: 10, bows: 3, heavy: 2, echo: 1 },
      weapon: 'rusty_sword',
    },
  ],

  // --- Marks (niveauer) ---------------------------------------------------------------------
  marks: {
    echoBase: 20, // Echo til næste Mark = echoBase × niveau ^ echoExponent
    echoExponent: 1.5,
    attributePoints: 3, // point til egenskaber pr. Mark
    skillPoints: 2, // point til skills pr. Mark
  },

  // --- Skills ---------------------------------------------------------------------------------
  skills: {
    max: 100,
    levelsPerPoint: 2, // ét skill-point hæver en skill så mange niveauer
    xpBase: 4, // XP fra niveau n til n+1 = xpBase + xpPerLevel × n
    xpPerLevel: 0.8,
    xpPerHit: 1, // XP for et slag, der rammer
    xpPerKill: 3, // ekstra XP for at dræbe
    maxHitsPerSwing: 3, // højst så mange ramte fjender giver XP pr. slag
    // Udfordring: XP ganges med fjendens niveau / dit Mark-niveau, holdt mellem min og max,
    // så det giver mindre at slå svage fjender (mod grind).
    challengeMin: 0.25,
    challengeMax: 1.5,
    learningPerIntelligence: 0.02, // +2 % skill-XP pr. Intelligence over 10
    attributeBonus: 1.5, // skill-bonus pr. egenskabspoint over 10, ganget med vægten herunder
    damagePerSkill: 0.015, // +1,5 % skade pr. effektivt skill-niveau
    speedPerSkill: 0.004, // −0,4 % ventetid mellem angreb pr. effektivt skill-niveau
    maxSpeedBonus: 0.35,
    // Hvor meget hver egenskab giver hver skill (summen er 1).
    weights: {
      blades: { dexterity: 0.7, strength: 0.3 },
      heavy: { strength: 0.8, constitution: 0.2 },
      bows: { dexterity: 0.7, strength: 0.3 },
      echo: { intelligence: 0.8, stamina: 0.2 },
    },
  },

  // --- Sult -----------------------------------------------------------------------------------
  hunger: {
    max: 100,
    drainPerSecond: 0.25, // fuld mave holder ca. 6–7 minutter
    drainReductionPerStamina: 0.02, // −2 % sult pr. Stamina over 10
    rationRestores: 45,
    starvingStaminaRegen: 0.4, // stamina-regeneration ganges med dette, når man sulter
  },

  // --- Kamp -----------------------------------------------------------------------------------
  combat: {
    armourFactor: 50, // skadesreduktion = armour / (armour + armourFactor)
    dodgeDistance: 3,
    dodgeTime: 0.18, // man kan ikke rammes, mens man undviger
    dodgeCost: 20,
    dodgeCooldown: 0.6,
    potionHeal: 0.4, // andel af max liv
    potionCooldown: 1,
    arrowSpeed: 13,
    echoBolt: { min: 6, max: 10, focusCost: 8, cooldown: 0.55, range: 8, speed: 11 },
    unarmed: { min: 1, max: 3, reach: 1, cooldown: 0.4, stamina: 3, arc: 80 },
  },

  // --- Monstre (Reach 1: The Old Mines) -----------------------------------------------------
  monsters: {
    levelPerDepth: 1, // monsterniveau = dybde × levelPerDepth + (dit Mark − 1) × followPlayerLevel
    followPlayerLevel: 0.5,
    hpPerLevel: 0.35, // +35 % liv pr. niveau over 1
    damagePerLevel: 0.25,
    perRoom: [1, 3], // monstre pr. rum (før størrelse og dybde)
    extraPerDepth: 1,
    types: {
      gnawer: { name: 'Gnawer', hp: 10, min: 2, max: 4, speed: 3.3, radius: 0.3, reach: 0.9, cooldown: 0.9, windup: 0.25, aggro: 7, echo: 3, weight: 55 },
      spitter: { name: 'Crystal Spitter', hp: 16, min: 3, max: 6, speed: 1.9, radius: 0.35, range: 6, cooldown: 1.7, windup: 0.35, aggro: 8, echo: 6, projectileSpeed: 7, ranged: true, weight: 25 },
      brute: { name: 'Tunnel Brute', hp: 38, min: 6, max: 10, speed: 1.7, radius: 0.5, reach: 1.1, cooldown: 1.5, windup: 0.5, aggro: 6, echo: 9, armour: 6, itemChance: 0.3, weight: 20 },
      foreman: { name: 'The Foreman', hp: 300, min: 10, max: 18, speed: 1.5, radius: 0.9, reach: 2.4, cooldown: 2.4, windup: 0.85, aggro: 9, echo: 120, armour: 10, summonEvery: 14, summonMax: 6, warden: true },
    },
  },

  // --- Loot -----------------------------------------------------------------------------------
  loot: {
    goldChance: 0.4,
    goldPerLevel: [2, 6], // guld = niveau × et tal mellem de to
    itemChance: 0.12,
    consumableChance: 0.15,
    rarity: { magic: 0.28, rare: 0.07, perDepth: 0.03 }, // chancer; perDepth lægges til pr. dybde
    cachesPerDepth: 2,
  },

  // --- Udstyr ---------------------------------------------------------------------------------
  items: {
    sellFactor: 0.3, // man får 30 % af prisen, når man sælger
    damagePerItemLevel: 0.08,
    armourPerItemLevel: 0.1,
    pricePerItemLevel: 0.15,
    rarityPrice: { common: 1, magic: 2.2, rare: 4 },
    bases: {
      dagger: { name: 'Dagger', slot: 'weapon', skill: 'blades', min: 3, max: 5, reach: 1.1, cooldown: 0.32, stamina: 4, arc: 80, price: 18 },
      rusty_sword: { name: 'Rusty Sword', slot: 'weapon', skill: 'blades', min: 4, max: 7, reach: 1.3, cooldown: 0.45, stamina: 6, arc: 100, price: 20 },
      short_sword: { name: 'Short Sword', slot: 'weapon', skill: 'blades', min: 6, max: 10, reach: 1.35, cooldown: 0.48, stamina: 7, arc: 100, price: 45, minLevel: 2 },
      pickaxe: { name: 'Pickaxe', slot: 'weapon', skill: 'heavy', min: 7, max: 12, reach: 1.45, cooldown: 0.8, stamina: 12, arc: 140, price: 22 },
      war_axe: { name: 'War Axe', slot: 'weapon', skill: 'heavy', min: 10, max: 16, reach: 1.5, cooldown: 0.85, stamina: 13, arc: 140, price: 55, minLevel: 2 },
      maul: { name: 'Maul', slot: 'weapon', skill: 'heavy', min: 14, max: 22, reach: 1.55, cooldown: 1.05, stamina: 16, arc: 150, price: 80, minLevel: 3 },
      short_bow: { name: 'Short Bow', slot: 'weapon', skill: 'bows', min: 4, max: 8, range: 7, cooldown: 0.6, stamina: 5, price: 25 },
      hunting_bow: { name: 'Hunting Bow', slot: 'weapon', skill: 'bows', min: 6, max: 11, range: 8, cooldown: 0.65, stamina: 6, price: 60, minLevel: 2 },
      padded_coat: { name: 'Padded Coat', slot: 'armour', armour: 4, price: 12 },
      leather_jerkin: { name: 'Leather Jerkin', slot: 'armour', armour: 7, price: 25 },
      mail_shirt: { name: 'Mail Shirt', slot: 'armour', armour: 14, price: 60, minLevel: 2 },
      scale_coat: { name: 'Scale Coat', slot: 'armour', armour: 22, price: 95, minLevel: 4 },
      iron_ring: { name: 'Iron Ring', slot: 'ring', price: 30 },
      bone_ring: { name: 'Bone Ring', slot: 'ring', price: 30 },
    },
    // Tilfældige egenskaber på udstyr. Værdi = et tal mellem min og max + perLevel × (item-niveau − 1).
    affixes: {
      strength: { label: 'Strength', prefix: 'Mighty', suffix: 'of the Ox', min: 1, max: 3, perLevel: 0.5, slots: ['weapon', 'armour', 'ring'] },
      dexterity: { label: 'Dexterity', prefix: 'Nimble', suffix: 'of the Fox', min: 1, max: 3, perLevel: 0.5, slots: ['weapon', 'armour', 'ring'] },
      stamina: { label: 'Stamina', prefix: 'Tireless', suffix: 'of the Mule', min: 1, max: 3, perLevel: 0.5, slots: ['weapon', 'armour', 'ring'] },
      constitution: { label: 'Constitution', prefix: 'Sturdy', suffix: 'of the Bear', min: 1, max: 3, perLevel: 0.5, slots: ['armour', 'ring'] },
      intelligence: { label: 'Intelligence', prefix: 'Clever', suffix: 'of the Owl', min: 1, max: 3, perLevel: 0.5, slots: ['weapon', 'armour', 'ring'] },
      damagePct: { label: '% Damage', prefix: 'Cruel', suffix: 'of Slaughter', min: 5, max: 15, perLevel: 2, slots: ['weapon', 'ring'] },
      maxHp: { label: 'Life', prefix: 'Vital', suffix: 'of Life', min: 5, max: 12, perLevel: 2, slots: ['armour', 'ring'] },
      armour: { label: 'Armour', prefix: 'Reinforced', suffix: 'of Iron', min: 2, max: 6, perLevel: 1, slots: ['armour', 'ring'] },
      skill: { label: 'to weapon skill', prefix: 'Masterwork', suffix: 'of the Adept', min: 1, max: 3, perLevel: 0.4, slots: ['weapon'] },
      echoGain: { label: '% Echo gained', prefix: 'Hungry', suffix: 'of the Maw', min: 5, max: 12, perLevel: 1, slots: ['armour', 'ring'] },
    },
  },

  // --- Tithe (én gennemspilning) ------------------------------------------------------------
  tithe: {
    depths: 3, // den sidste dybde har Warden
    graceSeconds: 20, // så længe rivalerne ikke må angribe dig i starten
    rivalSpeed: 3.4,
    rivalHpBase: 40,
    rivalHpPerLevel: 8,
    rivalSkillPerLevel: 4, // rivalernes effektive skill = 5 + niveau × dette
    rivalArmour: 6,
    rivalSecondsPerDepth: 110, // så længe en rival er om en dybde, når du ikke er der
    abstractWardenFight: 20, // sekunder, en rival kæmper mod Warden, når du ikke er der
    rivalWinChanceBase: 0.15, // chancen for, at en rival vinder over Warden uden dig
    rivalWinChancePerLevel: 0.04,
    rivalWinChanceMax: 0.7,
    wardenWoundedFactor: 0.75, // Wardens liv ganges med dette, når en rival taber til den
    // Rivalerne fra historien. aggression = chancen for, at de angriber dig på syne.
    rivals: [
      { id: 'cassian', name: 'Cassian Morrow', weapon: 'heavy', levelOffset: 1, aggression: 0.9, color: '#d9534f' },
      { id: 'vessa', name: 'Vessa Thorne', weapon: 'bows', levelOffset: 0, aggression: 0.35, color: '#5cb85c' },
      { id: 'ash', name: 'Ash Kell', weapon: 'blades', levelOffset: 0, aggression: 0.6, color: '#e3a04b' },
      { id: 'rook', name: 'Rook Kell', weapon: 'blades', levelOffset: 0, aggression: 0.6, color: '#c98b3a' },
      { id: 'mira', name: 'Mira Silvertongue', weapon: 'echo', levelOffset: 0, aggression: 0.2, color: '#b48ce0' },
    ],
  },

  // --- Mirrormaster ---------------------------------------------------------------------------
  mirrormaster: {
    sealTimes: [240, 480], // dybde 1 og 2 forsegles efter så mange sekunder fra Tithens start
    minTimeOnEntry: 90, // kommer du til en dybde senere, får du mindst så lang tid
    sealWarning: 30,
    sealDamagePerSecond: 0.03, // andel af max liv pr. sekund på en forseglet dybde
    boredAfter: 40, // sekunder uden at gøre skade, før publikum keder sig
    boredGnawers: 4,
    streakKills: 3, // så mange drab inden for streakWindow giver en sponsorgave
    streakWindow: 8,
    sponsorCooldown: 30,
  },

  // --- Renown (publikums gunst) --------------------------------------------------------------
  renown: {
    perMonsterLevel: 2,
    rival: 60,
    warden: 150,
    streak: 15,
    depth: 20, // når du når en ny dybde
  },

  // --- The Rim (byen) -------------------------------------------------------------------------
  rim: {
    forgeItems: 7,
    forgeRareChance: 0.1,
    potionPrice: 25,
    rationPrice: 10,
    purse: { perDepth: 40, warden: 150, perRenown: 0.3, champion: 300, fallFactor: 0.5 },
    giftPerRenown: 100, // én sponsorgave pr. så meget Renown
    maxGifts: 4,
    giftGold: 40, // guldgave, ganges med (1 + 0,2 × Mark)
    houses: ['House Morrow', 'House Vane', 'House Ashgrave', 'House Lisle'],
    // Hvad det koster at falde (besluttet 2026-11-18): du mister det udstyr og guld, du fandt i den Tithe,
    // men aldrig det, du gik ned med. 'none' (du mister intet) kan bruges til at mærke forskellen.
    fallPenalty: 'lose-found',
  },

  // --- Skærmen --------------------------------------------------------------------------------
  view: {
    visionRadius: 7,
  },
};
