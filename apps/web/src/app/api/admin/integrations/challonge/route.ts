import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-utils';
import { getChallongeService } from '@/lib/challonge';

export async function POST() {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const challongeService = getChallongeService();
    // Try to list tournaments (limit to 1) to check if credentials are valid
    await challongeService.listTournaments({ perPage: 1 });

    return NextResponse.json({
      success: true,
      message: 'Connexion Challonge établie avec succès',
    });
  } catch (error) {
    console.error('Challonge integration check failed:', error);
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Échec de la connexion à Challonge',
      },
      { status: 500 },
    );
  }
}
