/**
 * POST /api/gacha/duel
 * Duel with a random opponent card using element advantages
 */
import { type NextRequest, NextResponse } from "next/server";
import { awardDuelReward, getOwnedCard, getRandomActiveCard } from "@/server/dal/gacha";
import { badRequest, getApiUser, serverError, unauthorized } from "../helpers";

const ELEMENT_ADVANTAGE: Record<string, string> = {
  FEU: "VENT",
  VENT: "TERRE",
  TERRE: "EAU",
  EAU: "FEU",
  LUMIERE: "OMBRE",
  OMBRE: "LUMIERE",
};

const DUEL_REWARD = 25;

function calcDamage(card: { att: number; def: number; end: number; equilibre: number }) {
  return card.att * 0.35 + card.def * 0.25 + card.end * 0.25 + card.equilibre * 0.15;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getApiUser();
    if (!user) return unauthorized();

    const body = await request.json();
    const { cardId } = body as { cardId?: string };

    if (!cardId) return badRequest("cardId requis");

    // Verify the user owns this card
    const owned = await getOwnedCard(user.id, cardId);

    if (!owned) return badRequest("Tu ne possèdes pas cette carte");

    const playerCard = owned.gachaCard;

    // Pick a random opponent card
    const opponentCard = await getRandomActiveCard();

    if (!opponentCard) {
      return NextResponse.json(
        { success: false, error: "Pas d'adversaire disponible" },
        { status: 404 },
      );
    }

    // Calculate damage
    let playerDmg = calcDamage(playerCard);
    let opponentDmg = calcDamage(opponentCard);

    // Element advantage
    let elementAdvantage = false;
    const playerEl = playerCard.element ?? "NEUTRAL";
    const opponentEl = opponentCard.element ?? "NEUTRAL";

    if (ELEMENT_ADVANTAGE[playerEl] === opponentEl) {
      playerDmg *= 1.25;
      elementAdvantage = true;
    } else if (ELEMENT_ADVANTAGE[opponentEl] === playerEl) {
      opponentDmg *= 1.25;
    }

    // Add randomness (±15%)
    playerDmg *= 0.85 + Math.random() * 0.3;
    opponentDmg *= 0.85 + Math.random() * 0.3;

    const winner = playerDmg >= opponentDmg ? "player" : "opponent";

    // Award BeyCoins if player wins
    if (winner === "player") {
      await awardDuelReward(
        user.id,
        DUEL_REWARD,
        `Duel gagné — ${playerCard.name} vs ${opponentCard.name}`,
      );
    }

    return NextResponse.json({
      success: true,
      winner,
      playerCard,
      opponentCard,
      playerDamage: Math.round(playerDmg),
      opponentDamage: Math.round(opponentDmg),
      elementAdvantage,
      reward: winner === "player" ? DUEL_REWARD : 0,
    });
  } catch (error) {
    return serverError(error);
  }
}
