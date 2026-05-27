import { NextResponse } from 'next/server';

const TWITCH_MESSAGE_ID = 'Twitch-Eventsub-Message-Id'.toLowerCase();
const TWITCH_MESSAGE_TIMESTAMP =
  'Twitch-Eventsub-Message-Timestamp'.toLowerCase();
const TWITCH_MESSAGE_SIGNATURE =
  'Twitch-Eventsub-Message-Signature'.toLowerCase();
const MESSAGE_TYPE = 'Twitch-Eventsub-Message-Type'.toLowerCase();

const MESSAGE_TYPE_VERIFICATION = 'webhook_callback_verification';
const MESSAGE_TYPE_NOTIFICATION = 'notification';
const MESSAGE_TYPE_REVOCATION = 'revocation';

const HMAC_PREFIX = 'sha256=';

export async function POST(req: Request) {
  const body = await req.text();
  const headers = req.headers;

  const messageId = headers.get(TWITCH_MESSAGE_ID);
  const messageTimestamp = headers.get(TWITCH_MESSAGE_TIMESTAMP);
  const messageSignature = headers.get(TWITCH_MESSAGE_SIGNATURE);
  const messageType = headers.get(MESSAGE_TYPE);

  if (!messageId || !messageTimestamp || !messageSignature || !messageType) {
    return new NextResponse('Missing headers', { status: 400 });
  }

  // Verify signature (Web Crypto — edge runtime compatible)
  const secret = process.env.TWITCH_WEBHOOK_SECRET;
  if (secret) {
    const message = messageId + messageTimestamp + body;
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sig = await crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(message),
    );
    const hmac =
      HMAC_PREFIX +
      Array.from(new Uint8Array(sig), (b) =>
        b.toString(16).padStart(2, '0'),
      ).join('');

    if (messageSignature !== hmac) {
      return new NextResponse('Invalid signature', { status: 403 });
    }
  }

  const data = JSON.parse(body);

  if (messageType === MESSAGE_TYPE_VERIFICATION) {
    return new NextResponse(data.challenge, { status: 200 });
  }

  if (messageType === MESSAGE_TYPE_NOTIFICATION) {
    const { event, subscription } = data;

    if (subscription.type === 'stream.online') {
      console.log(`Stream online event for ${event.broadcaster_user_name}`);

      console.log('Twitch stream online event received:', event);
    }

    return new NextResponse('OK', { status: 200 });
  }

  if (messageType === MESSAGE_TYPE_REVOCATION) {
    return new NextResponse('OK', { status: 200 });
  }

  return new NextResponse('Unknown message type', { status: 400 });
}
