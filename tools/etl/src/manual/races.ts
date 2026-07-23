/**
 * Handkodierte SRD-Daten: die 7 Spielervölker aus dem PHB/SRD.
 * Die Andargor-Datenbank enthält keine Rassen — dieser Datensatz ist manuell
 * gegen den SRD-Text ("Races") gepflegt.
 *
 * Konventionen (siehe packages/core/src/schema):
 * - Attributsanpassungen stehen in `data.abilityMods`, NIE in effects.
 * - Numerische Boni hängen als Effects an ihrem SRD-Trait; rein beschreibende
 *   Traits (Darkvision, Weapon Familiarity, Immunitäten) bleiben Text.
 * - Situative Boni tragen `condition` (werden angezeigt, nie summiert).
 * - `updatedAt: ""` und `rev: 1` halten die Packs deterministisch.
 */
import type { Ability, BonusType, Effect, Entity, RaceEntity, Size, StatPath } from "@codex35/core";

type Trait = { name: string; description?: string; effects: Effect[] };

/** Effect-Kurzform. Rassenboni sind per SRD-RAW fast immer "racial". */
function fx(
  target: StatPath,
  value: number,
  opts: { type?: BonusType; condition?: string } = {},
): Effect {
  return {
    target,
    value,
    bonusType: opts.type ?? "racial",
    activation: "passive",
    ...(opts.condition !== undefined ? { condition: opts.condition } : {}),
  };
}

/** Rein beschreibender Trait (keine Mechanik, nur Anzeige). */
function textTrait(name: string, description: string): Trait {
  return { name, description, effects: [] };
}

function trait(name: string, description: string, ...effects: Effect[]): Trait {
  return { name, description, effects };
}

function race(def: {
  slug: string;
  name: string;
  description: string;
  size: Size;
  speedFt: number;
  abilityMods?: Partial<Record<Ability, number>>;
  favoredClassId?: string;
  bonusLanguages: string;
  traits: Trait[];
}): RaceEntity {
  return {
    id: `srd:race:${def.slug}`,
    kind: "race",
    name: def.name,
    source: "srd",
    schemaVersion: 1,
    rev: 1,
    updatedAt: "",
    tags: [],
    description: def.description,
    effects: [],
    data: {
      size: def.size,
      speedFt: def.speedFt,
      abilityMods: def.abilityMods ?? {},
      favoredClassId: def.favoredClassId ?? "any",
      traits: def.traits,
      la: 0,
      bonusLanguages: def.bonusLanguages,
    },
  };
}

// ---------------------------------------------------------------------------
// Die 7 PC-Rassen (alphabetisch nach id)
// ---------------------------------------------------------------------------

const DWARF = race({
  slug: "dwarf",
  name: "Dwarf",
  description:
    "Dwarves are known for their skill in warfare, their ability to withstand physical and magical punishment, their knowledge of the earth's secrets, their hard work, and their capacity for drinking ale. Most dwarves are lawful good, live in kingdoms deep under mountains, and revere Moradin, the Soul Forger.",
  size: "medium",
  speedFt: 20,
  abilityMods: { con: 2, cha: -2 },
  favoredClassId: "srd:class:fighter",
  bonusLanguages: "Giant, Gnome, Goblin, Orc, Terran, and Undercommon",
  traits: [
    textTrait(
      "Speed",
      "Dwarf base land speed is 20 feet. However, dwarves can move at this speed even when wearing medium or heavy armor or when carrying a medium or heavy load (unlike other creatures, whose speed is reduced in such situations).",
    ),
    textTrait(
      "Darkvision",
      "Darkvision out to 60 feet. Darkvision is black and white only, but it is otherwise like normal sight, and dwarves can function just fine with no light at all.",
    ),
    trait(
      "Stonecunning",
      "This ability grants a dwarf a +2 racial bonus on Search checks to notice unusual stonework, such as sliding walls, stonework traps, new construction (even when built to match the old), unsafe stone surfaces, shaky stone ceilings, and the like. A dwarf who merely comes within 10 feet of unusual stonework can make a Search check as if he were actively searching. A dwarf can use the Search skill to find stonework traps as a rogue can. A dwarf can also intuit depth, sensing his approximate depth underground as naturally as a human can sense which way is up.",
      fx("skill:srd:skill:search", 2, { condition: "Steinarbeiten" }),
    ),
    textTrait(
      "Weapon Familiarity",
      "Dwarves may treat dwarven waraxes and dwarven urgroshes as martial weapons, rather than exotic weapons.",
    ),
    textTrait(
      "Stability",
      "A dwarf gains a +4 bonus on ability checks made to resist being bull rushed or tripped when standing on the ground (but not when climbing, flying, riding, or otherwise not standing firmly on the ground).",
    ),
    trait(
      "Poison Resistance",
      "+2 racial bonus on saving throws against poison.",
      fx("save.all", 2, { condition: "gegen Gift" }),
    ),
    trait(
      "Spell Resistance",
      "+2 racial bonus on saving throws against spells and spell-like effects.",
      fx("save.all", 2, { condition: "gegen Zauber und zauberähnliche Effekte" }),
    ),
    trait(
      "Attack Bonus vs. Orcs and Goblinoids",
      "+1 racial bonus on attack rolls against orcs and goblinoids.",
      fx("attack.all", 1, { condition: "gegen Orks und Goblinoide" }),
    ),
    trait(
      "Dodge Bonus vs. Giants",
      "+4 dodge bonus to Armor Class against monsters of the giant type. Any time a creature loses its Dexterity bonus (if any) to Armor Class, such as when it's caught flat-footed, it loses its dodge bonus, too.",
      fx("ac", 4, { type: "dodge", condition: "gegen Riesen" }),
    ),
    trait(
      "Stone and Metal Appraisal",
      "+2 racial bonus on Appraise checks that are related to stone or metal items.",
      fx("skill:srd:skill:appraise", 2, { condition: "Stein/Metall" }),
    ),
    trait(
      "Stone and Metal Craftsmanship",
      "+2 racial bonus on Craft checks that are related to stone or metal.",
      fx("skill:srd:skill:craft", 2, { condition: "Stein/Metall" }),
    ),
  ],
});

const ELF = race({
  slug: "elf",
  name: "Elf",
  description:
    "Elves mingle freely in human lands, always welcome yet never at home there. They are well known for their poetry, dance, song, lore, and magical arts, and they favor things of natural and simple beauty. Most elves are chaotic good, live in woodland clans, and revere Corellon Larethian, Protector and Preserver of Life.",
  size: "medium",
  speedFt: 30,
  abilityMods: { dex: 2, con: -2 },
  favoredClassId: "srd:class:wizard",
  bonusLanguages: "Draconic, Gnoll, Gnome, Goblin, Orc, and Sylvan",
  traits: [
    textTrait(
      "Immunity to Sleep",
      "Immunity to magic sleep effects.",
    ),
    trait(
      "Enchantment Resistance",
      "+2 racial saving throw bonus against enchantment spells or effects.",
      fx("save.all", 2, { condition: "gegen Verzauberungen" }),
    ),
    textTrait(
      "Low-Light Vision",
      "An elf can see twice as far as a human in starlight, moonlight, torchlight, and similar conditions of poor illumination. She retains the ability to distinguish color and detail under these conditions.",
    ),
    textTrait(
      "Weapon Proficiency",
      "Elves receive the Martial Weapon Proficiency feats for the longsword, rapier, longbow (including composite longbow), and shortbow (including composite shortbow) as bonus feats.",
    ),
    trait(
      "Keen Senses",
      "+2 racial bonus on Listen, Search, and Spot checks.",
      fx("skill:srd:skill:listen", 2),
      fx("skill:srd:skill:search", 2),
      fx("skill:srd:skill:spot", 2),
    ),
    textTrait(
      "Secret Door Detection",
      "An elf who merely passes within 5 feet of a secret or concealed door is entitled to a Search check to notice it as if she were actively looking for it.",
    ),
  ],
});

const GNOME = race({
  slug: "gnome",
  name: "Gnome",
  description:
    "Gnomes are welcome everywhere as technicians, alchemists, and inventors, and they are known for their great love of jokes and pranks. Most gnomes are neutral good, live in burrows beneath rolling, wooded hills, and revere Garl Glittergold, the Watchful Protector.",
  size: "small",
  speedFt: 20,
  abilityMods: { con: 2, str: -2 },
  favoredClassId: "srd:class:bard",
  bonusLanguages: "Draconic, Dwarven, Elven, Giant, Goblin, and Orc",
  traits: [
    textTrait(
      "Low-Light Vision",
      "A gnome can see twice as far as a human in starlight, moonlight, torchlight, and similar conditions of poor illumination. He retains the ability to distinguish color and detail under these conditions.",
    ),
    textTrait(
      "Weapon Familiarity",
      "Gnomes may treat gnome hooked hammers as martial weapons rather than exotic weapons.",
    ),
    trait(
      "Illusion Resistance",
      "+2 racial bonus on saving throws against illusions.",
      fx("save.all", 2, { condition: "gegen Illusionen" }),
    ),
    trait(
      "Attack Bonus vs. Kobolds and Goblinoids",
      "+1 racial bonus on attack rolls against kobolds and goblinoids.",
      fx("attack.all", 1, { condition: "gegen Kobolde und Goblinoide" }),
    ),
    trait(
      "Dodge Bonus vs. Giants",
      "+4 dodge bonus to Armor Class against monsters of the giant type. Any time a creature loses its Dexterity bonus (if any) to Armor Class, such as when it's caught flat-footed, it loses its dodge bonus, too.",
      fx("ac", 4, { type: "dodge", condition: "gegen Riesen" }),
    ),
    trait(
      "Keen Ears",
      "+2 racial bonus on Listen checks.",
      fx("skill:srd:skill:listen", 2),
    ),
    trait(
      "Alchemy Bonus",
      "+2 racial bonus on Craft (alchemy) checks.",
      fx("skill:srd:skill:craft", 2, { condition: "Alchemie" }),
    ),
    textTrait(
      "Illusion Affinity",
      "Add +1 to the Difficulty Class for all saving throws against illusion spells cast by gnomes. This adjustment stacks with those from similar effects.",
    ),
    textTrait(
      "Spell-Like Abilities",
      "1/day — speak with animals (burrowing mammal only, duration 1 minute). A gnome with a Charisma score of at least 10 also has the following spell-like abilities: 1/day — dancing lights, ghost sound, prestidigitation. Caster level 1st; save DC 10 + gnome's Cha modifier + spell level.",
    ),
  ],
});

const HALF_ELF = race({
  slug: "half-elf",
  name: "Half-Elf",
  description:
    "Half-elves have the curiosity and ambition of their human parent and the refined senses and love of nature of their elven parent, although they are not truly accepted by either society. Most half-elves do well among both humans and elves, and many serve as diplomats or go-betweens.",
  size: "medium",
  speedFt: 30,
  abilityMods: {},
  favoredClassId: "any",
  bonusLanguages: "Any (other than secret languages, such as Druidic)",
  traits: [
    textTrait(
      "Immunity to Sleep",
      "Immunity to sleep spells and similar magical effects.",
    ),
    trait(
      "Enchantment Resistance",
      "+2 racial bonus on saving throws against enchantment spells or effects.",
      fx("save.all", 2, { condition: "gegen Verzauberungen" }),
    ),
    textTrait(
      "Low-Light Vision",
      "A half-elf can see twice as far as a human in starlight, moonlight, torchlight, and similar conditions of poor illumination. She retains the ability to distinguish color and detail under these conditions.",
    ),
    trait(
      "Keen Senses",
      "+1 racial bonus on Listen, Search, and Spot checks.",
      fx("skill:srd:skill:listen", 1),
      fx("skill:srd:skill:search", 1),
      fx("skill:srd:skill:spot", 1),
    ),
    trait(
      "Diplomatic",
      "+2 racial bonus on Diplomacy and Gather Information checks.",
      fx("skill:srd:skill:diplomacy", 2),
      fx("skill:srd:skill:gather-information", 2),
    ),
    textTrait(
      "Elven Blood",
      "For all effects related to race, a half-elf is considered an elf.",
    ),
  ],
});

const HALF_ORC = race({
  slug: "half-orc",
  name: "Half-Orc",
  description:
    "Half-orcs are the offspring of humans and orcs, combining human versatility with orcish might. In the wild frontiers, tribes of human and orc barbarians live in uneasy balance, and half-orcs make their way through strength and endurance where they are welcome in neither society. A half-orc's starting Intelligence score is always at least 3.",
  size: "medium",
  speedFt: 30,
  abilityMods: { str: 2, int: -2, cha: -2 },
  favoredClassId: "srd:class:barbarian",
  bonusLanguages: "Draconic, Giant, Gnoll, Goblin, and Abyssal",
  traits: [
    textTrait(
      "Darkvision",
      "Darkvision out to 60 feet. Darkvision is black and white only, but it is otherwise like normal sight, and half-orcs can function just fine with no light at all.",
    ),
    textTrait(
      "Orc Blood",
      "For all effects related to race, a half-orc is considered an orc.",
    ),
  ],
});

const HALFLING = race({
  slug: "halfling",
  name: "Halfling",
  description:
    "Halflings are clever, capable opportunists. Ever curious, they wander the lands as tinkers, traders, and entertainers, relying on wit, luck, and nimbleness to see them through. Most halflings are neutral, travel in close-knit clans, and revere Yondalla, the Blessed One.",
  size: "small",
  speedFt: 20,
  abilityMods: { dex: 2, str: -2 },
  favoredClassId: "srd:class:rogue",
  bonusLanguages: "Dwarven, Elven, Gnome, Goblin, and Orc",
  traits: [
    trait(
      "Nimble",
      "+2 racial bonus on Climb, Jump, and Move Silently checks.",
      fx("skill:srd:skill:climb", 2),
      fx("skill:srd:skill:jump", 2),
      fx("skill:srd:skill:move-silently", 2),
    ),
    trait(
      "Halfling Luck",
      "+1 racial bonus on all saving throws.",
      fx("save.all", 1),
    ),
    trait(
      "Fearless",
      "+2 morale bonus on saving throws against fear. This bonus stacks with the halfling's +1 bonus on saving throws in general.",
      fx("save.all", 2, { type: "morale", condition: "gegen Furcht" }),
    ),
    trait(
      "Thrown Weapon Skill",
      "+1 racial bonus on attack rolls with thrown weapons and slings.",
      fx("attack.all", 1, { condition: "mit geworfenen Waffen und Schleudern" }),
    ),
    trait(
      "Keen Ears",
      "+2 racial bonus on Listen checks.",
      fx("skill:srd:skill:listen", 2),
    ),
  ],
});

const HUMAN = race({
  slug: "human",
  name: "Human",
  description:
    "Humans are the most adaptable, flexible, and ambitious people among the common races. They are diverse in their tastes, morals, customs, and habits, and their short lives drive them to achieve as much as they can in the years they are given.",
  size: "medium",
  speedFt: 30,
  abilityMods: {},
  favoredClassId: "any",
  bonusLanguages: "Any (other than secret languages, such as Druidic)",
  traits: [
    trait(
      "Bonus Feat",
      "1 extra feat at 1st level, because humans are quick to master specialized tasks and varied in their talents.",
      fx("feats.slots", 1, { type: "untyped" }),
    ),
    trait(
      "Skilled",
      "4 extra skill points at 1st level and 1 extra skill point at each additional level, since humans are versatile and capable.",
      fx("skills.pointsPerLevel", 1, { type: "untyped" }),
    ),
  ],
});

/** Alphabetisch nach id — write-manual.ts sortiert zusätzlich defensiv. */
export const RACES: Entity[] = [DWARF, ELF, GNOME, HALF_ELF, HALF_ORC, HALFLING, HUMAN];
