import type {
  Buff,
  ShieldData,
  Player,
  AttributeModifiers,
  CombatModifiers,
  CultivationModifiers,
  ResourceModifiers,
  PenetrationModifiers,
  DamageResult,
  HealingResult,
} from "@/data/types";

export function getAttributeModifiers(buffs: Buff[]): AttributeModifiers {
  const modifiers: AttributeModifiers = {
    vitality: 1,
    soul: 1,
    wisdom: 1,
    agility: 1,
    hp: 0,
    mp: 0,
    spirit: 0,
    cultivation: 0,
  };

  buffs.forEach((buff) => {
    if (buff.category !== "attribute") return;

    buff.effects.forEach((effect) => {
      if (!effect.stat) return;

      const stat = effect.stat;
      if (modifiers[stat as keyof AttributeModifiers] === undefined) return;

      if (effect.valueType === "percentage") {
        if (stat === "vitality" || stat === "soul" || stat === "wisdom" || stat === "agility") {
          modifiers[stat] *= (100 + effect.value) / 100;
        } else {
          modifiers[stat as keyof AttributeModifiers] += effect.value;
        }
      } else if (effect.valueType === "fixed") {
        modifiers[stat as keyof AttributeModifiers] += effect.value;
      } else if (effect.valueType === "multiplier") {
        modifiers[stat as keyof AttributeModifiers] *= effect.value;
      }
    });
  });

  const MIN_ATTR_MULTIPLIER = 0.1;
  modifiers.vitality = Math.max(modifiers.vitality, MIN_ATTR_MULTIPLIER);
  modifiers.soul = Math.max(modifiers.soul, MIN_ATTR_MULTIPLIER);
  modifiers.wisdom = Math.max(modifiers.wisdom, MIN_ATTR_MULTIPLIER);
  modifiers.agility = Math.max(modifiers.agility, MIN_ATTR_MULTIPLIER);

  return modifiers;
}

export function getCombatModifiers(buffs: Buff[]): CombatModifiers {
  const modifiers: CombatModifiers = {
    attackPower: 1,
    damageIncrease: 0,
    damageReduction: 0,
    critRate: 0,
    critDamage: 0,
    armor: 0,
    directDamageReduction: 0,
    dodgeRate: 0,
    hitRate: 1,
    cooldownReduction: 0,
  };

  buffs.forEach((buff) => {
    if (buff.category !== "attack" && buff.category !== "defense" && buff.category !== "action") return;

    buff.effects.forEach((effect) => {
      if (!effect.stat) return;

      const stat = effect.stat;
      const value = effect.value;

      if (buff.category === "attack") {
        if (stat === "vitality") {
          modifiers.attackPower *= (100 + value) / 100;
        } else if (stat === "soul") {
          modifiers.attackPower *= (100 + value) / 100;
        } else if (stat === "cultivation") {
          modifiers.damageIncrease += value / 100;
        }
      }

      if (buff.category === "defense") {
        if (stat === "vitality") {
          modifiers.armor += value;
        } else if (stat === "maxHp") {
          modifiers.directDamageReduction += value / 100;
        }
      }

      if (buff.category === "action") {
        if (stat === "agility") {
          modifiers.dodgeRate += value / 100;
          modifiers.hitRate *= (100 + value) / 100;
        } else if (stat === "mp") {
          modifiers.cooldownReduction += value / 100;
        }
      }
    });
  });

  modifiers.directDamageReduction = Math.min(modifiers.directDamageReduction, 0.75);
  modifiers.cooldownReduction = Math.min(modifiers.cooldownReduction, 0.6);
  modifiers.hitRate = Math.min(modifiers.hitRate, 1);

  return modifiers;
}

export function getCultivationModifiers(buffs: Buff[]): CultivationModifiers {
  const modifiers: CultivationModifiers = {
    speedBonus: 0,
    speedPenalty: 0,
    qualityBonus: 0,
    successRateBonus: 0,
  };

  buffs.forEach((buff) => {
    if (buff.category !== "cultivation") return;

    buff.effects.forEach((effect) => {
      if (!effect.stat) return;

      const stat = effect.stat;
      const value = effect.value;

      if (stat === "wisdom") {
        modifiers.speedBonus += value / 100;
      } else if (stat === "cultivation") {
        modifiers.speedBonus += value / 100;
      } else if (stat === "maxMp") {
        modifiers.qualityBonus += value / 100;
      } else if (stat === "maxSpirit") {
        modifiers.successRateBonus += value / 100;
      }
    });
  });

  return modifiers;
}

export function getResourceModifiers(buffs: Buff[]): ResourceModifiers {
  const modifiers: ResourceModifiers = {
    mpCostReduction: 0,
    hpCostReduction: 0,
    lifespanCostReduction: 0,
  };

  buffs.forEach((buff) => {
    if (buff.category !== "resource") return;

    buff.effects.forEach((effect) => {
      if (!effect.stat) return;

      const stat = effect.stat;
      const value = effect.value;

      if (stat === "mp") {
        modifiers.mpCostReduction += value / 100;
      } else if (stat === "hp") {
        modifiers.hpCostReduction += value / 100;
      } else if (stat === "cultivation") {
        modifiers.lifespanCostReduction += value / 100;
      }
    });
  });

  modifiers.mpCostReduction = Math.min(modifiers.mpCostReduction, 0.5);
  modifiers.hpCostReduction = Math.min(modifiers.hpCostReduction, 0.3);
  modifiers.lifespanCostReduction = Math.min(modifiers.lifespanCostReduction, 0.3);

  return modifiers;
}

export function getPenetrationModifiers(buffs: Buff[]): PenetrationModifiers {
  const modifiers: PenetrationModifiers = {
    armorPenetration: 0,
    resistancePenetration: 0,
    absolutePenetration: false,
  };

  buffs.forEach((buff) => {
    if (buff.category !== "penetration") return;

    buff.effects.forEach((effect) => {
      const value = effect.value;

      if (effect.stat === "vitality") {
        modifiers.armorPenetration += value / 100;
      } else if (effect.stat === "soul") {
        modifiers.resistancePenetration += value / 100;
      } else if (effect.stat === "maxMp") {
        modifiers.absolutePenetration = value > 0;
      }
    });
  });

  modifiers.armorPenetration = Math.min(modifiers.armorPenetration, 1);
  modifiers.resistancePenetration = Math.min(modifiers.resistancePenetration, 1);

  return modifiers;
}

export function calculateFinalAttribute(baseValue: number, stat: string, buffs: Buff[]): number {
  const modifiers = getAttributeModifiers(buffs);
  const multiplier = modifiers[stat as keyof AttributeModifiers] || 1;
  const fixedBonus = modifiers[stat as keyof AttributeModifiers] || 0;

  if (stat === "vitality" || stat === "soul" || stat === "wisdom" || stat === "agility") {
    return Math.floor(baseValue * multiplier);
  }

  return Math.floor(baseValue * multiplier + fixedBonus);
}

export function calculateDamage(
  baseDamage: number,
  attackerBuffs: Buff[],
  defenderBuffs: Buff[],
  attackerShields: ShieldData[],
  defenderShields: ShieldData[],
  isCrit: boolean = false,
): DamageResult {
  const attackerCombat = getCombatModifiers(attackerBuffs);
  const defenderCombat = getCombatModifiers(defenderBuffs);
  const penetration = getPenetrationModifiers(attackerBuffs);

  let finalDamage = baseDamage;

  finalDamage *= attackerCombat.attackPower;

  finalDamage *= (1 + attackerCombat.damageIncrease);

  if (isCrit) {
    finalDamage *= (1 + attackerCombat.critDamage);
  }

  let effectiveArmor = defenderCombat.armor;
  if (!penetration.absolutePenetration) {
    effectiveArmor *= (1 - penetration.armorPenetration);
  } else {
    effectiveArmor = 0;
  }

  const armorReduction = effectiveArmor / (effectiveArmor + 100);
  finalDamage *= (1 - armorReduction);

  finalDamage *= (1 - defenderCombat.directDamageReduction);

  let absorbedByShield = 0;
  let shieldRemaining = 0;

  for (const shield of defenderShields) {
    if (finalDamage <= 0) break;
    const absorbAmount = Math.min(finalDamage, shield.value);
    absorbedByShield += absorbAmount;
    finalDamage -= absorbAmount;
    shieldRemaining = shield.value - absorbAmount;
  }

  return {
    baseDamage,
    finalDamage: Math.max(1, Math.floor(finalDamage)),
    absorbedByShield: Math.floor(absorbedByShield),
    shieldRemaining,
    modifiers: {
      attackBonus: attackerCombat.attackPower,
      damageBonus: attackerCombat.damageIncrease,
      critMultiplier: isCrit ? attackerCombat.critDamage : 0,
      specialBonus: 0,
      armorReduction,
      directReduction: defenderCombat.directDamageReduction,
      penetration: penetration.armorPenetration,
    },
  };
}

export function calculateHealing(
  baseHeal: number,
  casterBuffs: Buff[],
): HealingResult {
  let finalHeal = baseHeal;
  let healingBonus = 0;

  casterBuffs.forEach((buff) => {
    if (buff.category !== "dot") return;

    buff.effects.forEach((effect) => {
      if (effect.stat === "soul" || effect.stat === "maxSpirit") {
        healingBonus += effect.value / 100;
      }
    });
  });

  finalHeal *= (1 + healingBonus);

  return {
    baseHeal,
    finalHeal: Math.floor(finalHeal),
    modifiers: { healingBonus },
  };
}

export function calculateDoTDamage(
  sourceAttackPower: number,
  damageCoefficient: number,
  casterBuffs: Buff[],
): number {
  const modifiers = getCombatModifiers(casterBuffs);
  let damage = sourceAttackPower * damageCoefficient;

  damage *= (1 + modifiers.damageIncrease);

  return Math.floor(damage);
}

export function calculateHoTHealing(
  sourceSoul: number,
  healCoefficient: number,
  casterBuffs: Buff[],
): number {
  const modifiers = getCombatModifiers(casterBuffs);
  let heal = sourceSoul * healCoefficient;

  heal *= (1 + modifiers.damageIncrease);

  return Math.floor(heal);
}

export function calculateCultivationSpeed(
  baseSpeed: number,
  player: Player,
): number {
  const modifiers = getCultivationModifiers(player.buffs);
  const wisdomBonus = player.stats.wisdom / 100;

  let speed = baseSpeed;
  speed *= (1 + modifiers.speedBonus + wisdomBonus);
  speed *= (1 - modifiers.speedPenalty);

  return Math.max(0, speed);
}

export function calculateResourceCost(
  baseCost: number,
  statType: "mp" | "hp" | "lifespan",
  buffs: Buff[],
): number {
  const modifiers = getResourceModifiers(buffs);

  let cost = baseCost;

  if (statType === "mp") {
    cost *= (1 - modifiers.mpCostReduction);
  } else if (statType === "hp") {
    cost *= (1 - modifiers.hpCostReduction);
  } else if (statType === "lifespan") {
    cost *= (1 - modifiers.lifespanCostReduction);
  }

  return Math.max(0, Math.floor(cost));
}

export function calculateCooldown(
  baseCooldown: number,
  buffs: Buff[],
): number {
  const modifiers = getCombatModifiers(buffs);
  const reduction = Math.min(modifiers.cooldownReduction, 0.6);

  return Math.max(1, Math.floor(baseCooldown * (1 - reduction)));
}

export function calculateDodgeRate(
  baseDodge: number,
  buffs: Buff[],
): number {
  const modifiers = getCombatModifiers(buffs);
  const agilityBonus = modifiers.dodgeRate;

  return Math.min(1, baseDodge + agilityBonus);
}

export function calculateResistancePenetration(
  baseResistance: number,
  buffs: Buff[],
): number {
  const penetration = getPenetrationModifiers(buffs);

  if (penetration.absolutePenetration) {
    return 0;
  }

  return baseResistance * (1 - penetration.resistancePenetration);
}

export function applyBuff(player: Player, buff: Buff): Player {
  const existingBuff = player.buffs.find((b) => b.id === buff.id);

  if (existingBuff) {
    const newStacks = Math.min(existingBuff.stacks + buff.stacks, existingBuff.maxStacks);

    return {
      ...player,
      buffs: player.buffs.map((b) =>
        b.id === buff.id ? { ...b, stacks: newStacks } : b,
      ),
    };
  }

  return {
    ...player,
    buffs: [...player.buffs, { ...buff, stacks: Math.min(buff.stacks, buff.maxStacks) }],
  };
}

export function removeBuff(player: Player, buffId: string): Player {
  return {
    ...player,
    buffs: player.buffs.filter((b) => b.id !== buffId),
  };
}

export function updateBuffDuration(player: Player): Player {
  return {
    ...player,
    buffs: player.buffs.filter((buff) => {
      if (buff.durationType !== "round") return true;
      if (buff.duration === undefined) return true;

      return buff.duration > 0;
    }).map((buff) => {
      if (buff.durationType !== "round" || buff.duration === undefined) return buff;

      return { ...buff, duration: buff.duration - 1 };
    }),
  };
}

export function applyShield(player: Player, shield: ShieldData): Player {
  const existingShield = player.shields.find((s) => s.id === shield.id);

  if (existingShield) {
    const newValue = Math.min(existingShield.value + shield.value, existingShield.maxValue);

    return {
      ...player,
      shields: player.shields.map((s) =>
        s.id === shield.id ? { ...s, value: newValue } : s,
      ),
    };
  }

  return {
    ...player,
    shields: [...player.shields, { ...shield }],
  };
}

export function consumeShield(player: Player, amount: number): { player: Player; consumed: number } {
  let remaining = amount;
  let consumed = 0;

  const newShields = [...player.shields];

  for (let i = 0; i < newShields.length && remaining > 0; i++) {
    const shield = newShields[i];
    const consumeAmount = Math.min(remaining, shield.value);

    consumed += consumeAmount;
    remaining -= consumeAmount;
    shield.value -= consumeAmount;

    if (shield.value <= 0) {
      newShields.splice(i, 1);
      i--;
    }
  }

  return {
    player: { ...player, shields: newShields },
    consumed,
  };
}

export function getActiveBuffs(buffs: Buff[]): Buff[] {
  return buffs.filter((buff) => {
    if (buff.durationType === "round" && buff.duration !== undefined) {
      return buff.duration > 0;
    }
    if (buff.durationType === "conditional" && buff.condition) {
      return true;
    }
    return true;
  });
}

export function getDebuffs(buffs: Buff[]): Buff[] {
  return getActiveBuffs(buffs).filter((buff) => buff.isDebuff);
}

export function getBuffsByCategory(buffs: Buff[], category: string): Buff[] {
  return getActiveBuffs(buffs).filter((buff) => buff.category === category);
}
