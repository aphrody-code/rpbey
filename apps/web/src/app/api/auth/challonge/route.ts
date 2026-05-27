import { headers } from 'next/headers';
import { connection, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getChallongeService } from '@/lib/challonge';

export async function GET(request: Request) {
  await connection();
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      console.warn('Challonge OAuth: Unauthorized access attempt');
      return new NextResponse('Unauthorized: Please sign in first', {
        status: 401,
      });
    }

    const clientId = process.env.CHALLONGE_CLIENT_ID;
    if (!clientId) {
      console.error('Challonge OAuth: CHALLONGE_CLIENT_ID is missing in .env');
      return new NextResponse(
        'Configuration Error: Challonge Client ID missing',
        { status: 500 },
      );
    }

    const { searchParams } = new URL(request.url);
    const returnTo = searchParams.get('returnTo') || '/dashboard/profile/edit';

    const challonge = getChallongeService();

    // Generate a random state for security
    const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
      b.toString(16).padStart(2, '0'),
    ).join('');
    const state = btoa(
      JSON.stringify({
        userId: session.user.id,
        nonce,
        returnTo,
      }),
    );

    const authUrl = challonge.getAuthorizationUrl(state);
    console.log(`🚀 Initiating Challonge OAuth for user ${session.user.id}`);

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('❌ Challonge OAuth initiation failed:', error);
    return new NextResponse(
      `Internal Server Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      { status: 500 },
    );
  }
}
