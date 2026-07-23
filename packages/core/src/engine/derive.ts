import { ABILITIES, type Ability, type Size, type StatPath } from "../schema/common.js";
import type { HouseRules } from "../schema/character.js";
import { displayName, type ItemEntity } from "../schema/entities.js";
import type { ActiveEffect, ResolvedCharacter, TimelineResult } from "./internal.js";
import {
  baseContribution,
  flagSet,
  stackContributions,
  stackPaths,
  toBuckets,
  toContribution,
  type Buckets,
} from "./stack.js";
import {
  GRAPPLE_SIZE_MODIFIER,
  LOAD_LIMITS,
  SIZE_MODIFIER,
  abilityIncreaseCount,
  abilityModifier,
  averageHitDie,
  baseFeatSlots,
  bonusSpells,
  carryingCapacity,
  iterativeAttacks,
  maxRanks,
  reducedSpeed,
  xpForLevel,
} from "./tables.js";
import type {
  AbilityBlock,
  AttackLine,
  Contribution,
  DerivedIssue,
  DerivedSheet,
  FeatureLine,
  SkillLine,
  SlotInfo,
  SpellcastingBlock,
  StatValue,
} from "./types.js";

const LEVEL_UP_ORDINALS = ["4.", "8.", "12.", "16.", "20."];

/** Stufe 4 — evalFormulas, Pass 1: finale Attributswerte. */
export function deriveAbilities(
  resolved: ResolvedCharacter,
  timeline: TimelineResult,
  effects: ActiveEffect[],
): Record<Ability, AbilityBlock> {
  const { character, race } = resolved;
  const increases = abilityIncreaseCount(timeline.totalLevel);

  const blocks = {} as Record<Ability, AbilityBlock>;
  for (const ability of ABILITIES) {
    const base = character.abilities.base[ability];
    const contributions: Contribution[] = [baseContribution("Basiswert", base)];

    const racialMod = race?.data.abilityMods[ability];
    if (race && racialMod) {
      contributions.push({
        source: displayName(race),
        bonusType: "untyped",
        value: racialMod,
        applied: true,
        condition: undefined,
      });
    }

    character.abilities.levelUps.slice(0, increases).forEach((pick, i) => {
      if (pick === ability) {
        contributions.push(
          baseContribution(`Stufenanstieg (${LEVEL_UP_ORDINALS[i] ?? `${(i + 1) * 4}.`} Stufe)`, 1),
        );
      }
    });

    for (const effect of effects) {
      if (effect.target === `ability.${ability}`) contributions.push(toContribution(effect));
    }

    const score = stackContributions(contributions);
    blocks[ability] = { base, score, mod: abilityModifier(score.total) };
  }
  return blocks;
}

interface EquippedArmorInfo {
  entity: ItemEntity;
  instanceId: string;
  label: string;
}

/** Stufen 4–6 — Pass 2 + Ableitung des kompletten Bogens. */
export function deriveSheetValues(
  resolved: ResolvedCharacter,
  timeline: TimelineResult,
  effects: ActiveEffect[],
  abilities: Record<Ability, AbilityBlock>,
  houseRules: HouseRules,
  issues: DerivedIssue[],
): DerivedSheet {
  const { character, race } = resolved;
  const globalEffects = effects.filter((e) => !e.itemInstanceId);
  const buckets = toBuckets(globalEffects);
  const itemScoped = new Map<string, ActiveEffect[]>();
  for (const effect of effects) {
    if (!effect.itemInstanceId) continue;
    const list = itemScoped.get(effect.itemInstanceId) ?? [];
    list.push(effect);
    itemScoped.set(effect.itemInstanceId, list);
  }

  const mod = (a: Ability) => abilities[a].mod;
  const size: Size = race?.data.size ?? "medium";
  const sizeModifier = SIZE_MODIFIER[size];
  const totalLevel = timeline.totalLevel;

  // --- Ausgerüstete Rüstung/Schilde --------------------------------------
  const equippedArmor: EquippedArmorInfo[] = [];
  const equippedWeapons: { entity: ItemEntity; instanceId: string; label: string }[] = [];
  for (const { instance, entity } of resolved.items) {
    if (!instance.equipped || !entity) continue;
    const label = instance.customName ?? displayName(entity);
    if (entity.data.armor) equippedArmor.push({ entity, instanceId: instance.id, label });
    if (entity.data.weapon) equippedWeapons.push({ entity, instanceId: instance.id, label });
  }

  // --- Traglast ------------------------------------------------------------
  let loadLb = 0;
  for (const { instance, entity } of resolved.items) {
    const weight = instance.weightLbOverride ?? entity?.data.weightLb ?? 0;
    loadLb += weight * instance.qty;
  }
  const capacity = carryingCapacity(abilities.str.score.total, size);
  const loadLevel: DerivedSheet["encumbrance"]["level"] =
    loadLb <= capacity.lightMaxLb
      ? "light"
      : loadLb <= capacity.mediumMaxLb
        ? "medium"
        : loadLb <= capacity.heavyMaxLb
          ? "heavy"
          : "overloaded";
  const encumbrance = { loadLb, ...capacity, level: loadLevel };

  // --- Max-GE und Rüstungsmalus (Rüstung vs. Last: der schlechtere Wert) ---
  let armorMaxDex: number | null = null;
  let armorAcpSum = 0;
  let armorIsMediumOrHeavy = false;
  for (const { entity } of equippedArmor) {
    const armor = entity.data.armor;
    if (!armor) continue;
    if (armor.maxDex !== null) {
      armorMaxDex = armorMaxDex === null ? armor.maxDex : Math.min(armorMaxDex, armor.maxDex);
    }
    armorAcpSum += armor.acp;
    if (armor.kind === "medium" || armor.kind === "heavy") armorIsMediumOrHeavy = true;
  }
  const loadLimit =
    loadLevel === "medium"
      ? LOAD_LIMITS.medium
      : loadLevel === "heavy" || loadLevel === "overloaded"
        ? LOAD_LIMITS.heavy
        : null;
  let maxDex: number | null = armorMaxDex;
  if (loadLimit) maxDex = maxDex === null ? loadLimit.maxDex : Math.min(maxDex, loadLimit.maxDex);
  // PHB S. 162: Rüstungsmalus aus Rüstung und Last stacken nicht — der schlechtere zählt.
  const acp = Math.min(armorAcpSum, loadLimit?.acp ?? 0);

  // --- RK -------------------------------------------------------------------
  const dexMod = mod("dex");
  const clampedDex = maxDex !== null ? Math.min(dexMod, maxDex) : dexMod;
  const acContributions: Contribution[] = [baseContribution("Basis", 10)];
  const dexContribution: Contribution = {
    source: maxDex !== null && dexMod > maxDex ? `GE-Modifikator (MaxGE ${maxDex})` : "GE-Modifikator",
    bonusType: "untyped",
    value: clampedDex,
    applied: true,
    condition: undefined,
  };
  acContributions.push(dexContribution);
  if (sizeModifier !== 0) {
    acContributions.push({
      source: "Größe",
      bonusType: "size",
      value: sizeModifier,
      applied: true,
      condition: undefined,
    });
  }
  for (const { entity, label } of equippedArmor) {
    const armor = entity.data.armor;
    if (!armor) continue;
    acContributions.push({
      source: label,
      bonusType: armor.kind === "shield" ? "shield" : "armor",
      value: armor.acBonus,
      applied: true,
      condition: undefined,
    });
  }
  for (const effect of buckets.get("ac") ?? []) acContributions.push(toContribution(effect));
  // stackContributions kopiert die Beiträge — der GE-Beitrag wird über seinen
  // Index wiedergefunden (Reihenfolge bleibt erhalten).
  const dexIndex = acContributions.indexOf(dexContribution);
  const acTotal = stackContributions(acContributions);
  const stackedDex = acTotal.contributions[dexIndex];

  // Touch: ohne Rüstung, Schild, natürliche Rüstung (und deren Verzauberung).
  const NOT_TOUCH = new Set(["armor", "shield", "natural", "enhancement"]);
  const touch = acTotal.contributions.reduce(
    (sum, c) => sum + (c.applied && !NOT_TOUCH.has(c.bonusType) ? c.value : 0),
    0,
  );
  // Auf dem falschen Fuß: ohne GE-Bonus (Malus bleibt!) und ohne Dodge.
  const flatFooted = acTotal.contributions.reduce((sum, c) => {
    if (!c.applied) return sum;
    if (c === stackedDex && c.value > 0) return sum;
    if (c.bonusType === "dodge") return sum;
    return sum + c.value;
  }, 0);

  // --- Initiative, Rettungswürfe, Ringkampf --------------------------------
  const init = stackPaths(buckets, ["init"], [baseContribution("GE-Modifikator", dexMod)]);
  const saves = {
    fort: stackPaths(buckets, ["save.fort", "save.all"], [
      baseContribution("Basis", timeline.saves.fort),
      baseContribution("KO-Modifikator", mod("con")),
    ]),
    ref: stackPaths(buckets, ["save.ref", "save.all"], [
      baseContribution("Basis", timeline.saves.ref),
      baseContribution("GE-Modifikator", dexMod),
    ]),
    will: stackPaths(buckets, ["save.will", "save.all"], [
      baseContribution("Basis", timeline.saves.will),
      baseContribution("WE-Modifikator", mod("wis")),
    ]),
  };
  const grapple = stackPaths(buckets, ["grapple"], [
    baseContribution("BAB", timeline.bab),
    baseContribution("ST-Modifikator", mod("str")),
    baseContribution("Größe (Ringkampf)", GRAPPLE_SIZE_MODIFIER[size]),
  ]);

  // --- Bewegung -------------------------------------------------------------
  const baseSpeed = race?.data.speedFt ?? 30;
  const speedValue = stackPaths(buckets, ["speed.land"], [
    baseContribution(race ? displayName(race) : "Basis", baseSpeed),
  ]);
  const speedReducedBy = armorIsMediumOrHeavy || loadLevel === "medium" || loadLevel === "heavy";
  let speedFt: StatValue = speedValue;
  if (speedReducedBy && speedValue.total > 0) {
    const reduced = reducedSpeed(speedValue.total);
    if (reduced < speedValue.total) {
      speedFt = {
        total: reduced,
        contributions: [
          ...speedValue.contributions,
          {
            source: armorIsMediumOrHeavy ? "Mittlere/schwere Rüstung" : "Mittlere/schwere Last",
            bonusType: "untyped",
            value: reduced - speedValue.total,
            applied: true,
            condition: undefined,
          },
        ],
      };
    }
  }
  if (loadLevel === "overloaded") {
    issues.push({
      severity: "warning",
      code: "overloaded",
      message: `Überladen: ${loadLb} lb übersteigt die schwere Last (${capacity.heavyMaxLb} lb).`,
    });
  }

  // --- Trefferpunkte ---------------------------------------------------------
  const conMod = mod("con");
  let hpMax = 0;
  timeline.hpRolls.forEach(({ die, roll }, index) => {
    if (die <= 0) return;
    let rolled: number;
    if (index === 0 && houseRules.maxHpFirstLevel) rolled = die;
    else if (roll === "max") rolled = die;
    else if (roll === "avg") rolled = averageHitDie(die);
    else rolled = roll;
    // RAW: pro TW mindestens 1 TP, egal wie negativ der KO-Modifikator ist.
    hpMax += Math.max(1, rolled + conMod);
  });
  const hpBucket = stackPaths(buckets, ["hp.max"]);
  hpMax += hpBucket.total;
  if (character.hp.overrideMax !== undefined) hpMax = character.hp.overrideMax;
  const hp = {
    max: hpMax,
    current: hpMax - character.hp.damage,
    nonlethal: character.hp.nonlethal,
    temp: character.hp.temp,
  };

  // --- Angriffe ---------------------------------------------------------------
  const weaponFinesse = flagSet(buckets, "flag:weaponFinesse");
  const attacks: AttackLine[] = [];

  const buildAttackLine = (
    key: string,
    label: string,
    mode: "melee" | "ranged",
    weapon: { entity: ItemEntity; instanceId: string } | null,
  ): AttackLine => {
    const weaponData = weapon?.entity.data.weapon;
    const isLight = weaponData?.handedness === "light";
    const useDex = mode === "ranged" || (weaponFinesse && isLight);
    const abilityLabel = useDex ? "GE-Modifikator" : "ST-Modifikator";
    const abilityValue = useDex ? dexMod : mod("str");

    const base: Contribution[] = [
      baseContribution("BAB", timeline.bab),
      { source: abilityLabel, bonusType: "untyped", value: abilityValue, applied: true, condition: undefined },
    ];
    if (sizeModifier !== 0) {
      base.push({ source: "Größe", bonusType: "size", value: sizeModifier, applied: true, condition: undefined });
    }
    const paths: StatPath[] =
      mode === "melee" ? ["attack.melee", "attack.all"] : ["attack.ranged", "attack.all"];
    const contributions = [...base];
    for (const path of paths) {
      for (const effect of buckets.get(path) ?? []) contributions.push(toContribution(effect));
    }
    if (weapon) {
      for (const effect of itemScoped.get(weapon.instanceId) ?? []) {
        if (effect.target === "attack.self") contributions.push(toContribution(effect));
      }
    }
    const attack = stackContributions(contributions);
    const bonuses = iterativeAttacks(timeline.bab).map((b) => b + (attack.total - timeline.bab));

    // Schaden.
    let damageText = "—";
    const damageContributions: Contribution[] = [];
    const notes: string[] = [];
    if (weaponData) {
      const strFactor = mode === "ranged" ? 0 : weaponData.handedness === "two" ? 1.5 : 1;
      const strDamage = Math.floor(mod("str") * strFactor);
      if (strFactor > 0 && strDamage !== 0) {
        damageContributions.push({
          source: strFactor === 1.5 ? "ST-Modifikator (×1,5 zweihändig)" : "ST-Modifikator",
          bonusType: "untyped",
          value: strDamage,
          applied: true,
          condition: undefined,
        });
      }
      if (mode === "ranged") notes.push("Kein ST-Bonus auf Fernkampfschaden (außer Wurfwaffen/Kompositbögen).");
      const damagePaths: StatPath[] =
        mode === "melee" ? ["damage.melee", "damage.all"] : ["damage.ranged", "damage.all"];
      for (const path of damagePaths) {
        for (const effect of buckets.get(path) ?? []) damageContributions.push(toContribution(effect));
      }
      if (weapon) {
        for (const effect of itemScoped.get(weapon.instanceId) ?? []) {
          if (effect.target === "damage.self") damageContributions.push(toContribution(effect));
        }
      }
    }
    const damageBonus = stackContributions(damageContributions);
    if (weaponData) {
      const bonus = damageBonus.total;
      damageText = bonus === 0 ? weaponData.damage : `${weaponData.damage}${bonus > 0 ? "+" : ""}${bonus}`;
    }

    return {
      key,
      label,
      bonuses,
      attack,
      damageText,
      damageBonus,
      critical: weaponData ? `${weaponData.critRange}/${weaponData.critMult}` : "—",
      notes,
    };
  };

  attacks.push(buildAttackLine("melee", "Nahkampf", "melee", null));
  attacks.push(buildAttackLine("ranged", "Fernkampf", "ranged", null));
  for (const weapon of equippedWeapons) {
    const isRanged = weapon.entity.data.weapon?.handedness === "ranged";
    attacks.push(
      buildAttackLine(`weapon:${weapon.instanceId}`, weapon.label, isRanged ? "ranged" : "melee", weapon),
    );
  }

  // --- Fertigkeiten -----------------------------------------------------------
  const classSkillIds = new Set<string>();
  for (const cls of resolved.classes.values()) {
    for (const id of cls.data.classSkillIds) classSkillIds.add(id);
  }
  const skills: SkillLine[] = resolved.skills.map(({ id, entity }) => {
    const data = entity.data;
    const ranks = character.skillRanks[id] ?? 0;
    const isClassSkill = classSkillIds.has(id);
    const abilityMod = data.keyAbility ? mod(data.keyAbility) : 0;

    const contributions: Contribution[] = [];
    if (ranks > 0) contributions.push(baseContribution("Ränge", ranks));
    if (data.keyAbility) {
      contributions.push(
        baseContribution(`${data.keyAbility.toUpperCase()}-Modifikator`, abilityMod),
      );
    }
    // Synergien: +2 aus jedem anderen Skill mit ≥5 Rängen, der auf diesen zeigt.
    for (const { id: otherId, entity: other } of resolved.skills) {
      if (otherId === id) continue;
      for (const synergy of other.data.synergies) {
        if (synergy.toSkillId !== id) continue;
        if ((character.skillRanks[otherId] ?? 0) >= 5) {
          contributions.push({
            source: `Synergie: ${displayName(other)}`,
            bonusType: "untyped",
            value: synergy.bonus,
            applied: true,
            condition: synergy.condition,
          });
        }
      }
    }
    if (data.acpApplies && acp < 0) {
      contributions.push({
        source: data.acpDouble ? "Rüstungsmalus (×2)" : "Rüstungsmalus",
        bonusType: "untyped",
        value: data.acpDouble ? acp * 2 : acp,
        applied: true,
        condition: undefined,
      });
    }
    for (const effect of buckets.get(`skill:${id}`) ?? []) contributions.push(toContribution(effect));
    for (const effect of buckets.get("skill.all") ?? []) contributions.push(toContribution(effect));

    const total = stackContributions(contributions);
    return {
      skillId: id,
      name: displayName(entity),
      usable: !(data.trainedOnly && ranks === 0),
      total,
      ranks,
      keyAbility: data.keyAbility,
      isClassSkill,
      maxRanks: maxRanks(totalLevel, isClassSkill),
    };
  });

  // --- Fertigkeitspunkte (vereinfachend mit finalem IN-Modifikator) -----------
  const intMod = mod("int");
  const extraPointsPerLevel = stackPaths(buckets, ["skills.pointsPerLevel"]).total;
  let skillPointsAvailable = 0;
  character.levels.forEach((level, index) => {
    const cls = resolved.classes.get(level.classId);
    if (!cls) return;
    const perLevel = Math.max(1, cls.data.skillPointsPerLevel + intMod + extraPointsPerLevel);
    skillPointsAvailable += index === 0 ? perLevel * 4 : perLevel;
  });
  let skillPointsSpent = 0;
  for (const [skillId, ranks] of Object.entries(character.skillRanks)) {
    if (ranks <= 0) continue;
    skillPointsSpent += classSkillIds.has(skillId) ? ranks : ranks * 2;
  }

  // --- Talent-Slots -------------------------------------------------------------
  const featSlots = {
    available: baseFeatSlots(totalLevel) + stackPaths(buckets, ["feats.slots"]).total,
    used: character.feats.length,
  };

  // --- Zauber ---------------------------------------------------------------------
  const spellcasting: SpellcastingBlock[] = [];
  for (const [classId, cls] of resolved.classes) {
    const casting = cls.data.spellcasting;
    if (!casting) continue;
    const classLevel = resolved.classLevelCounts.get(classId) ?? 0;
    const row = timeline.currentRow.get(classId);
    if (!row?.spellsPerDay) continue;

    const abilityMod = mod(casting.ability);
    const casterLevel = stackPaths(buckets, ["cl", `cl:${classId}`], [
      baseContribution(`${cls.name}-Stufe`, classLevel),
    ]);
    const dcBase = 10 + abilityMod + stackPaths(buckets, ["dc.spells"]).total;

    const usedSlots = character.spellState[classId]?.usedSlots ?? [];
    const slots: SlotInfo[] = row.spellsPerDay.map((base, level) => {
      const bonus = base === null || level === 0 || !casting.bonusSlots ? 0 : bonusSpells(abilityMod, level);
      return {
        level,
        base,
        bonus,
        total: base === null ? null : base + bonus,
        used: usedSlots[level] ?? 0,
      };
    });

    spellcasting.push({
      classId,
      className: displayName(cls),
      model: casting.model,
      ability: casting.ability,
      abilityMod,
      casterLevel,
      dcBase,
      slots,
      spellsKnown: row.spellsKnown,
      spellListId: casting.spellListId,
    });
  }

  // --- Features (für Bogen-Anzeige inkl. Toggles) -----------------------------------
  const toggled = new Set(character.toggledEffectKeys);
  const features: FeatureLine[] = timeline.features.map((f) => {
    const toggleKeys = f.effects
      .map((_, i) => `${f.featureKey}.${i}`)
      .filter((_, i) => f.effects[i]?.activation === "toggle");
    return {
      key: f.featureKey,
      classId: f.classId,
      className: f.className,
      level: f.level,
      name: f.name,
      description: f.description,
      toggleable: toggleKeys.length > 0,
      active: toggleKeys.some((k) => toggled.has(k)),
    };
  });

  const classLevels = [...resolved.classes.entries()].map(([classId, cls]) => ({
    classId,
    className: displayName(cls),
    level: resolved.classLevelCounts.get(classId) ?? 0,
  }));

  return {
    abilities,
    size,
    sizeModifier,
    totalLevel,
    ecl: totalLevel + (race?.data.la ?? 0),
    classLevels,
    hp,
    ac: { total: acTotal, touch, flatFooted },
    init,
    speedFt,
    bab: timeline.bab,
    saves,
    grapple,
    attacks,
    skills,
    skillPoints: { available: skillPointsAvailable, spent: skillPointsSpent },
    featSlots,
    spellcasting,
    encumbrance,
    xp: {
      current: character.xp,
      nextLevelAt: totalLevel >= 20 ? null : xpForLevel(totalLevel + 1),
    },
    features,
    issues,
  };
}
