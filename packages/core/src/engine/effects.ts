import { displayName, type Effect } from "../schema/entities.js";
import type { ActiveEffect, ResolvedCharacter, TimelineResult } from "./internal.js";
import { effectKey } from "./internal.js";
import type { DerivedIssue } from "./types.js";

/**
 * Stufe 3 — collectEffects: alle Effekte einsammeln, mit Provenienz-Label und
 * stabilem Key. Toggle-Effekte zählen nur, wenn ihr Key aktiv ist. String-Werte
 * (Formeln, Phase 3) werden mit Warnung übersprungen — die Engine bleibt korrekt.
 */
export function collectEffects(
  resolved: ResolvedCharacter,
  timeline: TimelineResult,
  issues: DerivedIssue[],
): ActiveEffect[] {
  const { character } = resolved;
  const toggled = new Set(character.toggledEffectKeys);
  const active: ActiveEffect[] = [];

  const add = (
    effect: Effect,
    source: string,
    key: string,
    opts: { equipped?: boolean; itemInstanceId?: string } = {},
  ) => {
    if (effect.activation === "equipped" && !opts.equipped) return;
    if (effect.activation === "toggle" && !toggled.has(key)) return;
    if (typeof effect.value === "string") {
      issues.push({
        severity: "warning",
        code: "formula-not-supported",
        message: `${source}: Formel-Effekte („${effect.value}") kommen in Phase 3 — Effekt wird ignoriert. Nutze bis dahin einen manuellen Modifikator.`,
        ref: key,
      });
      return;
    }
    active.push({
      target: effect.target,
      bonusType: effect.bonusType,
      value: effect.value,
      condition: effect.condition,
      source,
      key,
      itemInstanceId: opts.itemInstanceId,
    });
  };

  // Volk: Envelope-Effekte + Trait-Effekte.
  if (resolved.race) {
    const raceName = displayName(resolved.race);
    resolved.race.effects.forEach((e, i) => add(e, raceName, effectKey(resolved.race!.id, "e", i)));
    resolved.race.data.traits.forEach((trait, ti) =>
      trait.effects.forEach((e, ei) =>
        add(e, `${raceName}: ${trait.name}`, effectKey(resolved.race!.id, "t", ti, ei)),
      ),
    );
  }

  // Klassenfeatures aus der Timeline.
  for (const feature of timeline.features) {
    feature.effects.forEach((e, ei) =>
      add(e, `${feature.className}: ${feature.name}`, `${feature.featureKey}.${ei}`),
    );
  }

  // Talente.
  for (const feat of resolved.feats) {
    if (!feat.entity) continue;
    const label = feat.choice
      ? `Talent: ${displayName(feat.entity)} (${feat.choice})`
      : `Talent: ${displayName(feat.entity)}`;
    feat.entity.effects.forEach((e, i) => add(e, label, effectKey(feat.entity!.id, i)));
  }

  // Gegenstände: Kompendium-Effekte + individuelle extraEffects.
  // Keys sind INSTANZ-bezogen (zwei Langschwerter → getrennte Toggles).
  for (const { instance, entity } of resolved.items) {
    const label = instance.customName ?? (entity ? displayName(entity) : "Gegenstand");
    const equipped = instance.equipped;
    entity?.effects.forEach((e, i) =>
      add(e, label, effectKey(instance.id, "e", i), {
        equipped,
        ...(e.target === "attack.self" || e.target === "damage.self"
          ? { itemInstanceId: instance.id }
          : {}),
      }),
    );
    instance.extraEffects.forEach((e, i) =>
      add(e, label, effectKey(instance.id, "x", i), {
        equipped,
        ...(e.target === "attack.self" || e.target === "damage.self"
          ? { itemInstanceId: instance.id }
          : {}),
      }),
    );
  }

  // Zustände.
  for (const { entity } of resolved.conditions) {
    if (!entity) continue;
    entity.effects.forEach((e, i) =>
      add(e, `Zustand: ${displayName(entity)}`, effectKey(entity.id, i)),
    );
  }

  // Der Notausgang: manuelle Modifikatoren.
  for (const misc of character.miscModifiers) {
    active.push({
      target: misc.target,
      bonusType: misc.bonusType,
      value: misc.value,
      condition: undefined,
      source: misc.note ? `Manuell: ${misc.note}` : "Manuell",
      key: `misc#${misc.id}`,
      itemInstanceId: undefined,
    });
  }

  return active;
}
