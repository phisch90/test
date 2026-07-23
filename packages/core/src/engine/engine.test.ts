import { describe, expect, it } from "vitest";
import {
  characterSchema,
  type Character,
  houseRulesSchema,
} from "../schema/character.js";
import {
  entitySchema,
  resolveCompendium,
  type Entity,
  type ClassLevelRow,
} from "../schema/entities.js";
import { deriveSheet } from "./index.js";

// ---------------------------------------------------------------------------
// Mini-Kompendium (handgebaut) — testet die Engine unabhängig vom SRD-ETL.
// ---------------------------------------------------------------------------

type Progression = "good" | "average" | "poor";
const babAt = (p: Progression, n: number) =>
  p === "good" ? n : p === "average" ? Math.floor((n * 3) / 4) : Math.floor(n / 2);
const saveAt = (p: "good" | "poor", n: number) =>
  p === "good" ? 2 + Math.floor(n / 2) : Math.floor(n / 3);

function rows(
  count: number,
  p: { bab: Progression; fort: "good" | "poor"; ref: "good" | "poor"; will: "good" | "poor" },
  extra: (level: number) => Partial<ClassLevelRow> = () => ({}),
): ClassLevelRow[] {
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    return {
      bab: babAt(p.bab, n),
      fort: saveAt(p.fort, n),
      ref: saveAt(p.ref, n),
      will: saveAt(p.will, n),
      features: [],
      template: { bab: p.bab, fort: p.fort, ref: p.ref, will: p.will },
      ...extra(n),
    } as ClassLevelRow;
  });
}

const E = (raw: unknown): Entity => entitySchema.parse(raw);

const fighter = E({
  id: "test:class:fighter",
  kind: "class",
  name: "Fighter",
  source: "srd",
  data: {
    hitDie: 10,
    skillPointsPerLevel: 2,
    classSkillIds: ["test:skill:climb", "test:skill:jump"],
    levels: rows(20, { bab: "good", fort: "good", ref: "poor", will: "poor" }),
  },
});

const rogue = E({
  id: "test:class:rogue",
  kind: "class",
  name: "Rogue",
  source: "srd",
  data: {
    hitDie: 6,
    skillPointsPerLevel: 8,
    classSkillIds: ["test:skill:tumble", "test:skill:jump", "test:skill:hide"],
    levels: rows(20, { bab: "average", fort: "poor", ref: "good", will: "poor" }),
  },
});

// PHB-Zauberer-Slots Stufe 1–5 (Grad 0–3).
const WIZARD_SLOTS: (number | null)[][] = [
  [3, 1],
  [4, 2],
  [4, 2, 1],
  [4, 3, 2],
  [4, 3, 2, 1],
];
const wizard = E({
  id: "test:class:wizard",
  kind: "class",
  name: "Wizard",
  source: "srd",
  data: {
    hitDie: 4,
    skillPointsPerLevel: 2,
    classSkillIds: [],
    levels: rows(20, { bab: "poor", fort: "poor", ref: "poor", will: "good" }, (n) => ({
      spellsPerDay: WIZARD_SLOTS[Math.min(n, 5) - 1],
    })),
    spellcasting: {
      model: "prepared",
      ability: "int",
      spellListId: "test:spelllist:wizard",
      bonusSlots: true,
      armorFailure: true,
    },
  },
});

const human = E({
  id: "test:race:human",
  kind: "race",
  name: "Human",
  source: "srd",
  data: {
    size: "medium",
    speedFt: 30,
    abilityMods: {},
    traits: [
      { name: "Bonus Feat", effects: [{ target: "feats.slots", bonusType: "untyped", value: 1 }] },
      {
        name: "Skilled",
        effects: [{ target: "skills.pointsPerLevel", bonusType: "untyped", value: 1 }],
      },
    ],
  },
});

const dwarf = E({
  id: "test:race:dwarf",
  kind: "race",
  name: "Dwarf",
  source: "srd",
  data: {
    size: "medium",
    speedFt: 20,
    abilityMods: { con: 2, cha: -2 },
    traits: [],
  },
});

const halfling = E({
  id: "test:race:halfling",
  kind: "race",
  name: "Halfling",
  source: "srd",
  data: {
    size: "small",
    speedFt: 20,
    abilityMods: { dex: 2, str: -2 },
    traits: [
      { name: "Lucky", effects: [{ target: "save.all", bonusType: "untyped", value: 1 }] },
    ],
  },
});

const skillClimb = E({
  id: "test:skill:climb",
  kind: "skill",
  name: "Climb",
  source: "srd",
  data: { keyAbility: "str", acpApplies: true },
});
const skillSwim = E({
  id: "test:skill:swim",
  kind: "skill",
  name: "Swim",
  source: "srd",
  data: { keyAbility: "str", acpApplies: true, acpDouble: true },
});
const skillJump = E({
  id: "test:skill:jump",
  kind: "skill",
  name: "Jump",
  source: "srd",
  data: { keyAbility: "str", acpApplies: true, synergies: [{ toSkillId: "test:skill:tumble", bonus: 2 }] },
});
const skillTumble = E({
  id: "test:skill:tumble",
  kind: "skill",
  name: "Tumble",
  source: "srd",
  data: {
    keyAbility: "dex",
    trainedOnly: true,
    acpApplies: true,
    synergies: [{ toSkillId: "test:skill:jump", bonus: 2 }],
  },
});
const skillHide = E({
  id: "test:skill:hide",
  kind: "skill",
  name: "Hide",
  source: "srd",
  data: { keyAbility: "dex", acpApplies: true },
});

const featDodge = E({
  id: "test:feat:dodge",
  kind: "feat",
  name: "Dodge",
  source: "srd",
  data: { prerequisites: [{ type: "minAbility", ability: "dex", value: 13 }] },
  effects: [{ target: "ac", bonusType: "dodge", value: 1, condition: "gegen einen gewählten Gegner" }],
});
const featToughness = E({
  id: "test:feat:toughness",
  kind: "feat",
  name: "Toughness",
  source: "srd",
  data: { stackable: true },
  effects: [{ target: "hp.max", bonusType: "untyped", value: 3 }],
});
const featFinesse = E({
  id: "test:feat:weapon-finesse",
  kind: "feat",
  name: "Weapon Finesse",
  source: "srd",
  data: { prerequisites: [{ type: "minBab", value: 1 }] },
  effects: [{ target: "flag:weaponFinesse", bonusType: "untyped", value: 1 }],
});

const longsword = E({
  id: "test:item:longsword",
  kind: "item",
  name: "Longsword",
  source: "srd",
  data: {
    costGp: 15,
    weightLb: 4,
    category: "weapon",
    weapon: { damage: "1d8", critRange: "19-20", critMult: "x2", category: "martial", handedness: "one" },
  },
});
const greatsword = E({
  id: "test:item:greatsword",
  kind: "item",
  name: "Greatsword",
  source: "srd",
  data: {
    costGp: 50,
    weightLb: 8,
    category: "weapon",
    weapon: { damage: "2d6", critRange: "19-20", critMult: "x2", category: "martial", handedness: "two" },
  },
});
const dagger = E({
  id: "test:item:dagger",
  kind: "item",
  name: "Dagger",
  source: "srd",
  data: {
    weightLb: 1,
    category: "weapon",
    weapon: { damage: "1d4", critRange: "19-20", critMult: "x2", category: "simple", handedness: "light" },
  },
});
const chainShirt = E({
  id: "test:item:chain-shirt",
  kind: "item",
  name: "Chain Shirt",
  source: "srd",
  data: {
    weightLb: 25,
    category: "armor",
    armor: { kind: "light", acBonus: 4, maxDex: 4, acp: -2, asf: 20 },
  },
});
const fullPlate = E({
  id: "test:item:full-plate",
  kind: "item",
  name: "Full Plate",
  source: "srd",
  data: {
    weightLb: 50,
    category: "armor",
    armor: { kind: "heavy", acBonus: 8, maxDex: 1, acp: -6, asf: 35 },
  },
});
const heavyShield = E({
  id: "test:item:heavy-shield",
  kind: "item",
  name: "Heavy Steel Shield",
  source: "srd",
  data: {
    weightLb: 15,
    category: "shield",
    armor: { kind: "shield", acBonus: 2, maxDex: null, acp: -2, asf: 15 },
  },
});
const ringPlus1 = E({
  id: "test:item:ring-protection-1",
  kind: "item",
  name: "Ring of Protection +1",
  source: "srd",
  data: { category: "ring", weightLb: 0 },
  effects: [{ target: "ac", bonusType: "deflection", value: 1, activation: "equipped" }],
});
const ringPlus3 = E({
  id: "test:item:ring-protection-3",
  kind: "item",
  name: "Ring of Protection +3",
  source: "srd",
  data: { category: "ring", weightLb: 0 },
  effects: [{ target: "ac", bonusType: "deflection", value: 3, activation: "equipped" }],
});

const conditionShaken = E({
  id: "test:condition:shaken",
  kind: "condition",
  name: "Shaken",
  source: "srd",
  data: { summary: "-2 auf Angriffe, Saves, Checks" },
  effects: [
    { target: "attack.all", bonusType: "untyped", value: -2 },
    { target: "save.all", bonusType: "untyped", value: -2 },
  ],
});

const ALL_ENTITIES: Entity[] = [
  fighter, rogue, wizard,
  human, dwarf, halfling,
  skillClimb, skillSwim, skillJump, skillTumble, skillHide,
  featDodge, featToughness, featFinesse,
  longsword, greatsword, dagger, chainShirt, fullPlate, heavyShield, ringPlus1, ringPlus3,
  conditionShaken,
];
const COMPENDIUM = resolveCompendium(ALL_ENTITIES);

const C = (raw: unknown): Character => characterSchema.parse(raw);
const HOUSE = houseRulesSchema.parse({});

function fighterDwarf4(overrides: Record<string, unknown> = {}): Character {
  return C({
    id: "char-1",
    name: "Tordek",
    raceId: "test:race:dwarf",
    abilities: { base: { str: 16, dex: 13, con: 14, int: 10, wis: 12, cha: 8 } },
    levels: [
      { classId: "test:class:fighter", hpRoll: "max" },
      { classId: "test:class:fighter", hpRoll: 5 },
      { classId: "test:class:fighter", hpRoll: 6 },
      { classId: "test:class:fighter", hpRoll: 7 },
    ],
    ...overrides,
  });
}

describe("deriveSheet — Kernwerte (Golden: Zwergen-Kämpfer Stufe 4)", () => {
  const sheet = deriveSheet(fighterDwarf4(), COMPENDIUM, HOUSE);

  it("Attribute inkl. Volks-Modifikatoren", () => {
    expect(sheet.abilities.con.score.total).toBe(16);
    expect(sheet.abilities.con.mod).toBe(3);
    expect(sheet.abilities.cha.score.total).toBe(6);
    expect(sheet.abilities.cha.mod).toBe(-2);
  });

  it("TP: max auf Stufe 1 (Hausregel an) + Würfe + KO-Mod je Stufe", () => {
    // 10+3, 5+3, 6+3, 7+3 = 40
    expect(sheet.hp.max).toBe(40);
  });

  it("BAB und Saves aus der Klassentabelle", () => {
    expect(sheet.bab).toBe(4);
    expect(sheet.saves.fort.total).toBe(4 + 3); // Basis good(4)=4 + KO 3
    expect(sheet.saves.ref.total).toBe(1 + 1);
    expect(sheet.saves.will.total).toBe(1 + 1);
  });

  it("nur ein Angriff unter BAB +6", () => {
    const melee = sheet.attacks.find((a) => a.key === "melee")!;
    expect(melee.bonuses).toEqual([4 + 3]); // BAB 4 + ST 3
  });

  it("Zwerg: Bewegung 20, keine Rüstung → unverändert", () => {
    expect(sheet.speedFt.total).toBe(20);
  });

  it("XP-Schwelle für Stufe 5 (PHB: 10.000)", () => {
    expect(sheet.xp.nextLevelAt).toBe(10000);
  });
});

describe("deriveSheet — RK, Rüstung, MaxGE", () => {
  it("Kettenhemd + Schild + GE: RK/Berührung/auf dem falschen Fuß", () => {
    const c = fighterDwarf4({
      inventory: [
        { id: "i1", itemId: "test:item:chain-shirt", equipped: true },
        { id: "i2", itemId: "test:item:heavy-shield", equipped: true },
      ],
    });
    const sheet = deriveSheet(c, COMPENDIUM, HOUSE);
    // 10 + 4 Rüstung + 2 Schild + 1 GE = 17
    expect(sheet.ac.total.total).toBe(17);
    expect(sheet.ac.touch).toBe(11);
    expect(sheet.ac.flatFooted).toBe(16);
  });

  it("Vollplatte klemmt den GE-Bonus auf MaxGE 1", () => {
    const c = fighterDwarf4({
      abilities: { base: { str: 16, dex: 18, con: 14, int: 10, wis: 12, cha: 8 } },
      inventory: [{ id: "i1", itemId: "test:item:full-plate", equipped: true }],
    });
    const sheet = deriveSheet(c, COMPENDIUM, HOUSE);
    // 10 + 8 + min(4, MaxGE 1) = 19
    expect(sheet.ac.total.total).toBe(19);
  });

  it("Deflection stackt nicht: +1-Ring wird vom +3-Ring überdeckt", () => {
    const c = fighterDwarf4({
      inventory: [
        { id: "r1", itemId: "test:item:ring-protection-1", equipped: true },
        { id: "r3", itemId: "test:item:ring-protection-3", equipped: true },
      ],
    });
    const sheet = deriveSheet(c, COMPENDIUM, HOUSE);
    expect(sheet.ac.total.total).toBe(10 + 1 + 3); // GE 1 + nur der +3-Ring
    const suppressed = sheet.ac.total.contributions.find(
      (x) => x.source === "Ring of Protection +1",
    )!;
    expect(suppressed.applied).toBe(false);
    // Deflection wirkt auch auf Berührung.
    expect(sheet.ac.touch).toBe(10 + 1 + 3);
  });

  it("situative Boni (Dodge mit condition-Text) zählen nicht in den Total", () => {
    const c = fighterDwarf4({ feats: [{ featId: "test:feat:dodge" }] });
    const sheet = deriveSheet(c, COMPENDIUM, HOUSE);
    expect(sheet.ac.total.total).toBe(11);
    const dodge = sheet.ac.total.contributions.find((x) => x.bonusType === "dodge")!;
    expect(dodge.applied).toBe(false);
    expect(dodge.condition).toBeTruthy();
  });
});

describe("deriveSheet — Multiclass (der klassische Fan-Tool-Bug)", () => {
  const multiclass = C({
    id: "char-2",
    name: "Ftr4/Rog3",
    raceId: "test:race:human",
    abilities: { base: { str: 14, dex: 14, con: 12, int: 10, wis: 10, cha: 10 } },
    levels: [
      ...Array.from({ length: 4 }, () => ({ classId: "test:class:fighter", hpRoll: "avg" as const })),
      ...Array.from({ length: 3 }, () => ({ classId: "test:class:rogue", hpRoll: "avg" as const })),
    ],
  });

  it("RAW: BAB = Summe der Tabellenwerte (Ftr4 +4, Rog3 +2 → +6/+1)", () => {
    const sheet = deriveSheet(multiclass, COMPENDIUM, HOUSE);
    expect(sheet.bab).toBe(6);
    const melee = sheet.attacks.find((a) => a.key === "melee")!;
    // Iterative Angriffe aus dem BASIS-BAB: 6 → [6,1], +2 ST
    expect(melee.bonuses).toEqual([8, 3]);
  });

  it("RAW-Saves: Ref = poor(4) + good(3) = 1+3", () => {
    const sheet = deriveSheet(multiclass, COMPENDIUM, HOUSE);
    expect(sheet.saves.ref.total).toBe(1 + 3 + 2); // + GE 2
  });

  it("Hausregel fractional: BAB 4 + 2,25 → 6; Ref 1,33+3,5 → 4", () => {
    const sheet = deriveSheet(
      multiclass,
      COMPENDIUM,
      houseRulesSchema.parse({ fractionalBabAndSaves: true }),
    );
    expect(sheet.bab).toBe(6);
    expect(sheet.saves.ref.total).toBe(4 + 2); // floor(4.83)=4 + GE 2
  });

  it("Mensch: Bonus-Talent-Slot und Extra-Fertigkeitspunkte", () => {
    const sheet = deriveSheet(multiclass, COMPENDIUM, HOUSE);
    // Basis Stufe 7: 1 + floor(7/3) = 3, +1 Mensch = 4
    expect(sheet.featSlots.available).toBe(4);
    // Punkte: Ftr (2+0+1)×4 + 3×(2+0+1)... Stufe1 Ftr ×4 =12, Ftr×3 =9, Rog (8+1)×3=27 → 48
    expect(sheet.skillPoints.available).toBe(12 + 9 + 27);
  });
});

describe("deriveSheet — Angriffe und Waffen", () => {
  it("Zweihänder: ST ×1,5 auf Schaden", () => {
    const c = fighterDwarf4({
      inventory: [{ id: "w1", itemId: "test:item:greatsword", equipped: true }],
    });
    const sheet = deriveSheet(c, COMPENDIUM, HOUSE);
    const line = sheet.attacks.find((a) => a.key === "weapon:w1")!;
    expect(line.damageText).toBe("2d6+4"); // floor(3×1,5)=4
    expect(line.critical).toBe("19-20/x2");
  });

  it("Weapon Finesse: leichte Waffe nutzt GE statt ST", () => {
    const c = fighterDwarf4({
      abilities: { base: { str: 10, dex: 16, con: 14, int: 10, wis: 12, cha: 8 } },
      feats: [{ featId: "test:feat:weapon-finesse" }],
      inventory: [
        { id: "d1", itemId: "test:item:dagger", equipped: true },
        { id: "w1", itemId: "test:item:longsword", equipped: true },
      ],
    });
    const sheet = deriveSheet(c, COMPENDIUM, HOUSE);
    const daggerLine = sheet.attacks.find((a) => a.key === "weapon:d1")!;
    const swordLine = sheet.attacks.find((a) => a.key === "weapon:w1")!;
    expect(daggerLine.bonuses[0]).toBe(4 + 3); // GE 3
    expect(swordLine.bonuses[0]).toBe(4 + 0); // Langschwert ist nicht leicht → ST 0
  });

  it("individuelles +1 (extraEffects) wirkt nur auf die eigene Waffenzeile", () => {
    const c = fighterDwarf4({
      inventory: [
        {
          id: "w1",
          itemId: "test:item:longsword",
          customName: "Langschwert +1",
          equipped: true,
          extraEffects: [
            { target: "attack.self", bonusType: "enhancement", value: 1, activation: "equipped" },
            { target: "damage.self", bonusType: "enhancement", value: 1, activation: "equipped" },
          ],
        },
        { id: "w2", itemId: "test:item:longsword", equipped: true },
      ],
    });
    const sheet = deriveSheet(c, COMPENDIUM, HOUSE);
    const magic = sheet.attacks.find((a) => a.key === "weapon:w1")!;
    const mundane = sheet.attacks.find((a) => a.key === "weapon:w2")!;
    expect(magic.bonuses[0]).toBe(4 + 3 + 1);
    expect(magic.damageText).toBe("1d8+4");
    expect(mundane.bonuses[0]).toBe(4 + 3);
    expect(mundane.damageText).toBe("1d8+3");
  });

  it("Zustand Shaken: -2 auf alle Angriffe und Saves", () => {
    const c = fighterDwarf4({ conditionIds: ["test:condition:shaken"] });
    const sheet = deriveSheet(c, COMPENDIUM, HOUSE);
    expect(sheet.attacks.find((a) => a.key === "melee")!.bonuses[0]).toBe(7 - 2);
    expect(sheet.saves.fort.total).toBe(7 - 2);
  });
});

describe("deriveSheet — Fertigkeiten", () => {
  const rogueHalfling = C({
    id: "char-3",
    name: "Lidda",
    raceId: "test:race:halfling",
    abilities: { base: { str: 10, dex: 16, con: 10, int: 14, wis: 10, cha: 10 } },
    levels: Array.from({ length: 5 }, () => ({ classId: "test:class:rogue", hpRoll: "avg" as const })),
    skillRanks: {
      "test:skill:tumble": 5,
      "test:skill:jump": 3,
      "test:skill:hide": 8,
    },
  });

  it("Synergie: 5 Ränge Tumble geben +2 auf Jump", () => {
    const sheet = deriveSheet(rogueHalfling, COMPENDIUM, HOUSE);
    const jump = sheet.skills.find((s) => s.skillId === "test:skill:jump")!;
    // 3 Ränge + ST -1 (Halbling -2 auf 10 → 8) + 2 Synergie
    expect(jump.total.total).toBe(3 - 1 + 2);
  });

  it("trainedOnly ohne Ränge ist unbenutzbar", () => {
    const sheet = deriveSheet(fighterDwarf4(), COMPENDIUM, HOUSE);
    const tumble = sheet.skills.find((s) => s.skillId === "test:skill:tumble")!;
    expect(tumble.usable).toBe(false);
  });

  it("Rüstungsmalus: einfach auf Climb, doppelt auf Swim", () => {
    const c = fighterDwarf4({
      skillRanks: { "test:skill:climb": 4, "test:skill:swim": 4 },
      inventory: [{ id: "i1", itemId: "test:item:chain-shirt", equipped: true }],
    });
    const sheet = deriveSheet(c, COMPENDIUM, HOUSE);
    const climb = sheet.skills.find((s) => s.skillId === "test:skill:climb")!;
    const swim = sheet.skills.find((s) => s.skillId === "test:skill:swim")!;
    expect(climb.total.total).toBe(4 + 3 - 2);
    expect(swim.total.total).toBe(4 + 3 - 4);
  });

  it("Max-Ränge: Klasse Stufe+3, klassenfremd die Hälfte — Überzug warnt", () => {
    const c = fighterDwarf4({
      skillRanks: { "test:skill:hide": 4 }, // klassenfremd für Kämpfer, max (4+3)/2 = 3.5
    });
    const sheet = deriveSheet(c, COMPENDIUM, HOUSE);
    expect(sheet.issues.some((i) => i.code === "max-ranks" && i.ref === "test:skill:hide")).toBe(true);
  });
});

describe("deriveSheet — Zauber", () => {
  const wizard5 = C({
    id: "char-4",
    name: "Mialee",
    raceId: "test:race:human",
    abilities: { base: { str: 8, dex: 14, con: 12, int: 16, wis: 12, cha: 10 } },
    levels: Array.from({ length: 5 }, () => ({ classId: "test:class:wizard", hpRoll: "avg" as const })),
  });

  it("Slots Stufe 5 mit IN 16: 4 / 3+1 / 2+1 / 1+1", () => {
    const sheet = deriveSheet(wizard5, COMPENDIUM, HOUSE);
    const block = sheet.spellcasting[0]!;
    expect(block.slots.map((s) => s.total)).toEqual([4, 4, 3, 2]);
    expect(block.slots.map((s) => s.bonus)).toEqual([0, 1, 1, 1]);
    expect(block.dcBase).toBe(13);
    expect(block.casterLevel.total).toBe(5);
  });

  it("Toughness (stackable, untyped) erhöht TP um +3 je Instanz", () => {
    const base = deriveSheet(wizard5, COMPENDIUM, HOUSE);
    const withFeats = deriveSheet(
      C({
        ...wizard5,
        feats: [{ featId: "test:feat:toughness" }, { featId: "test:feat:toughness" }],
      }),
      COMPENDIUM,
      HOUSE,
    );
    expect(withFeats.hp.max).toBe(base.hp.max + 6);
  });
});

describe("deriveSheet — Robustheit & Validierung", () => {
  it("fehlende Referenzen crashen nicht, sondern erzeugen issues", () => {
    const c = fighterDwarf4({
      raceId: "missing:race",
      feats: [{ featId: "missing:feat" }],
      conditionIds: ["missing:condition"],
    });
    const sheet = deriveSheet(c, COMPENDIUM, HOUSE);
    expect(sheet.totalLevel).toBe(4);
    expect(sheet.issues.filter((i) => i.code === "missing-ref").length).toBe(3);
  });

  it("Talent-Voraussetzung verletzt → Warnung (GE 13 für Dodge)", () => {
    const c = fighterDwarf4({
      abilities: { base: { str: 16, dex: 12, con: 14, int: 10, wis: 12, cha: 8 } },
      feats: [{ featId: "test:feat:dodge" }],
    });
    const sheet = deriveSheet(c, COMPENDIUM, HOUSE);
    expect(sheet.issues.some((i) => i.code === "feat-prerequisite")).toBe(true);
  });

  it("Überladung warnt und reduziert Bewegung", () => {
    const c = fighterDwarf4({
      abilities: { base: { str: 10, dex: 13, con: 14, int: 10, wis: 12, cha: 8 } },
      inventory: [{ id: "i1", itemId: "test:item:full-plate", equipped: true, qty: 2 }],
    });
    // 2 × 50 lb = 100 lb; ST 10 → medium 66 → schwere Last, Speed 20 → 15
    const sheet = deriveSheet(c, COMPENDIUM, HOUSE);
    expect(sheet.encumbrance.level).toBe("heavy");
    expect(sheet.speedFt.total).toBe(15);
  });

  it("Homebrew-Override verdeckt den SRD-Eintrag (Shadowing)", () => {
    const houseDodge = entitySchema.parse({
      id: "hb-1",
      kind: "feat",
      name: "Dodge (Hausregel)",
      source: "homebrew",
      overrides: "test:feat:dodge",
      data: {},
      effects: [{ target: "ac", bonusType: "dodge", value: 1 }], // ohne condition → immer aktiv
    });
    const compendium = resolveCompendium([...ALL_ENTITIES, houseDodge]);
    const c = fighterDwarf4({ feats: [{ featId: "test:feat:dodge" }] });
    const sheet = deriveSheet(c, compendium, HOUSE);
    expect(sheet.ac.total.total).toBe(12); // 10 + GE 1 + Dodge 1 (jetzt unbedingt)
  });
});
