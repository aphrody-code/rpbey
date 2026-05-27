import { NextResponse } from 'next/server';
import { parseStringPromise } from 'xml2js';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const hubChallenge = searchParams.get('hub.challenge');
  const hubMode = searchParams.get('hub.mode');

  // Verify the subscription
  if (hubMode === 'subscribe' && hubChallenge) {
    return new NextResponse(hubChallenge, { status: 200 });
  }

  return new NextResponse('Invalid request', { status: 400 });
}

export async function POST(req: Request) {
  try {
    const body = await req.text();

    // Parse Atom feed XML
    const result = await parseStringPromise(body, { explicitArray: false });

    if (!result?.feed?.entry) {
      return new NextResponse('No entry found', { status: 200 });
    }

    const entry = result.feed.entry;

    const videoId = entry['yt:videoId'];
    const title = entry.title;
    const authorName = entry.author?.name;

    console.log(`YouTube Notification: ${title} by ${authorName} (${videoId})`);

    return new NextResponse('OK', { status: 200 });
  } catch (error) {
    console.error('YouTube Webhook Error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
