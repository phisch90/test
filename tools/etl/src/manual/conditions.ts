/**
 * Handkodierte SRD-Daten: die klassische Zustandsliste ("Condition Summary").
 * Die Andargor-Datenbank enthält keine Conditions — dieser Datensatz ist
 * manuell gegen den SRD-Text gepflegt.
 *
 * Konventionen:
 * - `data.summary` = deutsche Kurzfassung für Chips im Bogen/Tracker.
 * - `description` = englischer SRD-Regeltext (Markdown).
 * - Effects NUR für saubere, unbedingte numerische Mali (bonusType "untyped");
 *   alles Situative/Nichtnumerische (Verlust des GE-Bonus, halbe Bewegung,
 *   Handlungsverbote, Fehlschlagschancen) bleibt reiner Text.
 * - `updatedAt: ""` und `rev: 1` halten die Packs deterministisch.
 */
import type { BonusType, ConditionEntity, Effect, Entity, StatPath } from "@codex35/core";

/** Effect-Kurzform. Zustandsmali sind unbenannte Abzüge → "untyped". */
function fx(
  target: StatPath,
  value: number,
  opts: { type?: BonusType; condition?: string } = {},
): Effect {
  return {
    target,
    value,
    bonusType: opts.type ?? "untyped",
    activation: "passive",
    ...(opts.condition !== undefined ? { condition: opts.condition } : {}),
  };
}

function condition(def: {
  slug: string;
  name: string;
  summary: string;
  description: string;
  effects?: Effect[];
}): ConditionEntity {
  return {
    id: `srd:condition:${def.slug}`,
    kind: "condition",
    name: def.name,
    source: "srd",
    schemaVersion: 1,
    rev: 1,
    updatedAt: "",
    tags: [],
    description: def.description,
    effects: def.effects ?? [],
    data: { summary: def.summary },
  };
}

// ---------------------------------------------------------------------------
// SRD Condition Summary (alphabetisch nach id)
// ---------------------------------------------------------------------------

export const CONDITIONS: Entity[] = [
  condition({
    slug: "blinded",
    name: "Blinded",
    summary: "−2 RK, verliert GE-Bonus, halbe Bewegung, sehbasierte Checks scheitern",
    description:
      "The character cannot see. He takes a –2 penalty to Armor Class, loses his Dexterity bonus to AC (if any), moves at half speed, and takes a –4 penalty on Search checks and on most Strength- and Dexterity-based skill checks. All checks and activities that rely on vision (such as reading and Spot checks) automatically fail. All opponents are considered to have total concealment (50% miss chance) to the blinded character.",
    effects: [fx("ac", -2)],
  }),
  condition({
    slug: "cowering",
    name: "Cowering",
    summary: "keine Aktionen, −2 RK, verliert GE-Bonus",
    description:
      "The character is frozen in fear and can take no actions. A cowering character takes a –2 penalty to Armor Class and loses her Dexterity bonus (if any).",
    effects: [fx("ac", -2)],
  }),
  condition({
    slug: "dazed",
    name: "Dazed",
    summary: "keine Aktionen, verteidigt sich aber normal",
    description:
      "The creature is unable to act normally. A dazed creature can take no actions, but has no penalty to AC. A dazed condition typically lasts 1 round.",
  }),
  condition({
    slug: "dazzled",
    name: "Dazzled",
    summary: "−1 auf Angriffe, Suchen und Entdecken",
    description:
      "The creature is unable to see well because of overstimulation of the eyes. A dazzled creature takes a –1 penalty on attack rolls, Search checks, and Spot checks.",
    effects: [
      fx("attack.all", -1),
      fx("skill:srd:skill:search", -1),
      fx("skill:srd:skill:spot", -1),
    ],
  }),
  condition({
    slug: "deafened",
    name: "Deafened",
    summary: "−4 Initiative, Lauschen scheitert, 20% Fehlschlag bei Zaubern mit V",
    description:
      "A deafened character cannot hear. She takes a –4 penalty on initiative checks, automatically fails Listen checks, and has a 20% chance of spell failure when casting spells with verbal components.",
    effects: [fx("init", -4)],
  }),
  condition({
    slug: "disabled",
    name: "Disabled",
    summary: "0 TP: nur Standard- ODER Bewegungsaktion, anstrengende Aktion kostet 1 TP",
    description:
      "A character with 0 hit points, or one who has negative hit points but has become stable and conscious, is disabled. A disabled character may take a single move action or standard action each round (but not both, nor can she take full-round actions). She moves at half speed. Taking move actions doesn't risk further injury, but performing any standard action (or any other strenuous action) deals 1 point of damage after the completion of the act. Unless the action increased the disabled character's hit points, she is now in negative hit points and dying.",
  }),
  condition({
    slug: "dying",
    name: "Dying",
    summary: "−1 bis −9 TP: bewusstlos, verliert 1 TP pro Runde (10% Chance zu stabilisieren)",
    description:
      "A dying character is unconscious and near death. She has –1 to –9 current hit points. A dying character can take no actions and is unconscious. At the end of each round (starting with the round in which the character dropped below 0 hit points), the character rolls d% to see whether she becomes stable. She has a 10% chance of becoming stable. If she does not, she loses 1 hit point. If a dying character reaches –10 hit points, she is dead.",
  }),
  condition({
    slug: "entangled",
    name: "Entangled",
    summary: "−2 Angriffe, −4 GE, halbe Bewegung, kein Rennen/Ansturm",
    description:
      "The character is ensnared. Being entangled impedes movement, but does not entirely prevent it unless the bonds are anchored to an immobile object or tethered by an opposing force. An entangled creature moves at half speed, cannot run or charge, and takes a –2 penalty on all attack rolls and a –4 penalty to Dexterity. An entangled character who attempts to cast a spell must make a Concentration check (DC 15 + the spell's level) or lose the spell.",
    effects: [fx("attack.all", -2), fx("ability.dex", -4)],
  }),
  condition({
    slug: "exhausted",
    name: "Exhausted",
    summary: "−6 ST und GE, halbe Bewegung",
    description:
      "An exhausted character moves at half speed and takes a –6 penalty to Strength and Dexterity. After 1 hour of complete rest, an exhausted character becomes fatigued. A fatigued character becomes exhausted by doing something else that would normally cause fatigue.",
    effects: [fx("ability.str", -6), fx("ability.dex", -6)],
  }),
  condition({
    slug: "fatigued",
    name: "Fatigued",
    summary: "−2 ST und GE, kein Rennen oder Ansturm",
    description:
      "A fatigued character can neither run nor charge and takes a –2 penalty to Strength and Dexterity. Doing anything that would normally cause fatigue causes the fatigued character to become exhausted. After 8 hours of complete rest, fatigued characters are no longer fatigued.",
    effects: [fx("ability.str", -2), fx("ability.dex", -2)],
  }),
  condition({
    slug: "flat-footed",
    name: "Flat-Footed",
    summary: "verliert GE-Bonus auf RK, keine Gelegenheitsangriffe",
    description:
      "A character who has not yet acted during a combat is flat-footed, not yet reacting normally to the situation. A flat-footed character loses his Dexterity bonus to AC (if any) and cannot make attacks of opportunity.",
  }),
  condition({
    slug: "frightened",
    name: "Frightened",
    summary: "−2 auf Angriffe, Rettungswürfe, Checks; muss fliehen",
    description:
      "A frightened creature flees from the source of its fear as best it can. If unable to flee, it may fight. A frightened creature takes a –2 penalty on all attack rolls, saving throws, skill checks, and ability checks. A frightened creature can use special abilities, including spells, to flee; indeed, the creature must use such means if they are the only way to escape. Frightened is like shaken, except that the creature must flee if possible.",
    effects: [fx("attack.all", -2), fx("save.all", -2), fx("skill.all", -2)],
  }),
  condition({
    slug: "grappling",
    name: "Grappling",
    summary: "ringt: eingeschränkte Aktionen, bedroht keine Felder, kein GE-Bonus gegen Dritte",
    description:
      "Engaged in wrestling or some other form of hand-to-hand struggle with one or more attackers. A grappling character can undertake only a limited number of actions. He does not threaten any squares, and loses his Dexterity bonus to AC (if any) against opponents he isn't grappling.",
  }),
  condition({
    slug: "helpless",
    name: "Helpless",
    summary: "GE effektiv 0; Nahkampf +4 gegen das Ziel; Coup de Grâce möglich",
    description:
      "A helpless character is paralyzed, held, bound, sleeping, unconscious, or otherwise completely at an opponent's mercy. A helpless target is treated as having a Dexterity of 0 (–5 modifier). Melee attacks against a helpless target get a +4 bonus (equivalent to attacking a prone target). Ranged attacks get no special bonus against helpless targets. Rogues can sneak attack helpless targets. As a full-round action, an enemy can use a melee weapon to deliver a coup de grace to a helpless foe.",
  }),
  condition({
    slug: "incorporeal",
    name: "Incorporeal",
    summary: "körperlos: nur Magie und andere Körperlose wirken, 50% Schadensignoranz",
    description:
      "Having no physical body. Incorporeal creatures are immune to all nonmagical attack forms. They can be harmed only by other incorporeal creatures, +1 or better magic weapons, spells, spell-like effects, or supernatural effects. Even when hit by spells, magic weapons, or supernatural effects, an incorporeal creature has a 50% chance to ignore any damage from a corporeal source (except for a force effect or damage dealt by a ghost touch weapon).",
  }),
  condition({
    slug: "invisible",
    name: "Invisible",
    summary: "+2 Angriff gegen Sehende, Ziel verliert GE-Bonus auf RK",
    description:
      "Visually undetectable. An invisible creature gains a +2 bonus on attack rolls against sighted opponents, and ignores its opponents' Dexterity bonuses to AC (if any).",
  }),
  condition({
    slug: "nauseated",
    name: "Nauseated",
    summary: "nur eine Bewegungsaktion pro Runde, keine Angriffe oder Zauber",
    description:
      "Experiencing stomach distress. Nauseated creatures are unable to attack, cast spells, concentrate on spells, or do anything else requiring attention. The only action such a character can take is a single move action per turn.",
  }),
  condition({
    slug: "panicked",
    name: "Panicked",
    summary: "−2 auf Angriffe, Rettungswürfe, Checks; lässt alles fallen und flieht",
    description:
      "A panicked creature must drop anything it holds and flee at top speed from the source of its fear, as well as any other dangers it encounters, along a random path. It can't take any other actions. In addition, the creature takes a –2 penalty on all saving throws, skill checks, and ability checks. If cornered, a panicked creature cowers and does not attack, typically using the total defense action in combat. A panicked creature can use special abilities, including spells, to flee; indeed, the creature must use such means if they are the only way to escape.",
    effects: [fx("attack.all", -2), fx("save.all", -2), fx("skill.all", -2)],
  }),
  condition({
    slug: "paralyzed",
    name: "Paralyzed",
    summary: "handlungsunfähig, ST und GE effektiv 0, hilflos",
    description:
      "A paralyzed character is frozen in place and unable to move or act. A paralyzed character has effective Dexterity and Strength scores of 0 and is helpless, but can take purely mental actions. A winged creature flying in the air at the time that it becomes paralyzed cannot flap its wings and falls. A paralyzed swimmer can't swim and may drown.",
  }),
  condition({
    slug: "petrified",
    name: "Petrified",
    summary: "versteinert und bewusstlos",
    description:
      "A petrified character has been turned to stone and is considered unconscious. If a petrified character cracks or breaks, but the broken pieces are joined with the body as he returns to flesh, he is unharmed. If the character's petrified body is incomplete when it returns to flesh, the body is likewise incomplete and there is some amount of permanent hit point loss and/or debilitation.",
  }),
  condition({
    slug: "pinned",
    name: "Pinned",
    summary: "im Ringkampf festgehalten und bewegungsunfähig (aber nicht hilflos)",
    description: "Held immobile (but not helpless) in a grapple.",
  }),
  condition({
    slug: "prone",
    name: "Prone",
    summary: "−4 Nahkampfangriff; RK −4 gegen Nahkampf, +4 gegen Fernkampf",
    description:
      "The character is on the ground. An attacker who is prone has a –4 penalty on melee attack rolls and cannot use a ranged weapon (except for a crossbow). A defender who is prone gains a +4 bonus to Armor Class against ranged attacks, but takes a –4 penalty to AC against melee attacks. Standing up is a move-equivalent action that provokes an attack of opportunity.",
    effects: [
      fx("attack.melee", -4),
      fx("ac", 4, { condition: "gegen Fernkampf" }),
      fx("ac", -4, { condition: "gegen Nahkampf" }),
    ],
  }),
  condition({
    slug: "shaken",
    name: "Shaken",
    summary: "−2 auf Angriffe, Rettungswürfe, Checks",
    description:
      "A shaken character takes a –2 penalty on attack rolls, saving throws, skill checks, and ability checks. Shaken is a less severe state of fear than frightened or panicked.",
    effects: [fx("attack.all", -2), fx("save.all", -2), fx("skill.all", -2)],
  }),
  condition({
    slug: "sickened",
    name: "Sickened",
    summary: "−2 auf Angriffe, Schaden, Rettungswürfe, Checks",
    description:
      "The character takes a –2 penalty on all attack rolls, weapon damage rolls, saving throws, skill checks, and ability checks.",
    effects: [
      fx("attack.all", -2),
      fx("damage.all", -2),
      fx("save.all", -2),
      fx("skill.all", -2),
    ],
  }),
  condition({
    slug: "stable",
    name: "Stable",
    summary: "bewusstlos, verliert aber keine TP mehr",
    description:
      "A character who was dying but who has stopped losing hit points and still has negative hit points is stable. The character is no longer dying, but is still unconscious. If the character has become stable because of aid from another character (such as a Heal check or magical healing), then the character no longer loses hit points. He has a 10% chance each hour of becoming conscious and disabled (even though his hit points are still negative). If the character became stable on his own and hasn't had help, he is still at risk of losing hit points.",
  }),
  condition({
    slug: "staggered",
    name: "Staggered",
    summary: "nur Standard- ODER Bewegungsaktion pro Runde",
    description:
      "A character whose nonlethal damage exactly equals his current hit points is staggered. A staggered character may take a single move action or standard action each round (but not both, nor can he take full-round actions). A character whose current hit points exceed his nonlethal damage is no longer staggered; a character whose nonlethal damage exceeds his hit points becomes unconscious.",
  }),
  condition({
    slug: "stunned",
    name: "Stunned",
    summary: "keine Aktionen, lässt alles fallen, −2 RK, verliert GE-Bonus",
    description:
      "A stunned creature drops everything held, can't take actions, takes a –2 penalty to AC, and loses his Dexterity bonus to AC (if any).",
    effects: [fx("ac", -2)],
  }),
  condition({
    slug: "turned",
    name: "Turned",
    summary: "flieht 10 Runden vor dem Vertreiber; kauert, falls Flucht unmöglich",
    description:
      "Affected by a turn undead attempt. Turned undead flee for 10 rounds (1 minute) by the best and fastest means available to them. If they cannot flee, they cower.",
  }),
  condition({
    slug: "unconscious",
    name: "Unconscious",
    summary: "bewusstlos und hilflos",
    description:
      "Knocked out and helpless. Unconsciousness can result from having current hit points between –1 and –9, or from nonlethal damage in excess of current hit points.",
  }),
];
