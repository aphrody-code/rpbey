/** Logique de jeu pure (sans DB). */
import { RATES, type Rarity } from "./config";

export interface CardRow {
  id: string;
  name: string;
  nameJp: string | null;
  series: string;
  description: string | null;
  rarity: string;
  element: string;
  att: number;
  def: number;
  end: number;
  equilibre: number;
  beyblade: string | null;
  imageUrl: string | null;
  specialMove: string | null;
  isActive: boolean;
  dropId: string | null;
}

export interface CardDto extends CardRow {}

export function cardDto(c: CardRow): CardDto {
  return {
    id: c.id,
    name: c.name,
    nameJp: c.nameJp,
    series: c.series,
    description: c.description,
    rarity: c.rarity,
    element: c.element,
    att: c.att,
    def: c.def,
    end: c.end,
    equilibre: c.equilibre,
    beyblade: c.beyblade,
    imageUrl: c.imageUrl,
    specialMove: c.specialMove,
    isActive: c.isActive,
    dropId: c.dropId,
  };
}

/** Tire `MISS` ou une rareté selon la table pondérée RATES. */
export function rollRarity(): "MISS" | Rarity {
  const roll = Math.random() * 100;
  let cum = 0;
  for (const [k, w] of Object.entries(RATES) as [keyof typeof RATES, number][]) {
    cum += w;
    if (roll < cum) return k as "MISS" | Rarity;
  }
  return "COMMON";
}
