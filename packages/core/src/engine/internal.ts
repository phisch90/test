import type { BonusType, StatPath } from "../schema/common.js";
import type { Character } from "../schema/character.js";
import type {
  ClassEntity,
  ConditionEntity,
  Effect,
  FeatEntity,
  ItemEntity,
  RaceEntity,
  SkillEntity,
} from "../schema/entities.js";
import type { DerivedIssue } from "./types.js";

export interface ResolvedCharacter {
  character: Character;
  race: RaceEntity | null;
  /** In Reihenfolge des ersten Auftretens in der Stufen-Timeline. */
  classes: Map<string, ClassEntity>;
  classLevelCounts: Map<string, number>;
  feats: { featId: string; choice: string | undefined; entity: FeatEntity | null }[];
  items: { instance: Character["inventory"][number]; entity: ItemEntity | null }[];
  conditions: { conditionId: string; entity: ConditionEntity | null }[];
  /**
   * Alle Fertigkeiten des Kompendiums (SRD + Homebrew, ohne Tombstones).
   * `id` ist die kanonische ID (bei Overrides die Ziel-ID) — unter dieser
   * referenzieren Charaktere (skillRanks) und Klassen (classSkillIds) den Skill.
   */
  skills: { id: string; entity: SkillEntity }[];
  issues: DerivedIssue[];
}

/** Ein eingesammelter, aktiver Effekt mit Provenienz. */
export interface ActiveEffect {
  target: StatPath;
  bonusType: BonusType;
  value: number;
  condition: string | undefined;
  /** Anzeige-Label („Talent: Dodge", „Kettenhemd", „manuell"). */
  source: string;
  /** Toggle-/Identitäts-Key: `${entityId}#<indexpfad>`. */
  key: string;
  /** Gesetzt bei attack.self/damage.self — gilt nur für dieses Item. */
  itemInstanceId: string | undefined;
}

export interface TimelineFeature {
  classId: string;
  className: string;
  level: number;
  name: string;
  description: string | undefined;
  effects: Effect[];
  /** `${classId}#L<levelIdx>.<featureIdx>` — Basis der Effekt-Keys. */
  featureKey: string;
}

export interface TimelineResult {
  totalLevel: number;
  bab: number;
  saves: { fort: number; ref: number; will: number };
  hpRolls: { die: number; roll: number | "max" | "avg" }[];
  features: TimelineFeature[];
  /** Aktuelle Tabellenzeile je Klasse (bei Klassenstufe n: Zeile n−1). */
  currentRow: Map<string, import("../schema/entities.js").ClassLevelRow>;
}

/** Stabiler Key für einen Effekt innerhalb eines Entities. */
export function effectKey(entityId: string, ...indexPath: (string | number)[]): string {
  return `${entityId}#${indexPath.join(".")}`;
}
