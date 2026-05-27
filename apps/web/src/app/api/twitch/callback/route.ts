import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');

  if (!code) {
    return new NextResponse("Aucun code trouvé dans l'URL.", { status: 400 });
  }

  return new NextResponse(
    `
    <html>
      <body style="font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #0f0f13; color: white;">
        <h1 style="color: #9146ff;">Code Twitch récupéré !</h1>
        <p>Copie le code ci-dessous et colle-le dans ton terminal :</p>
        <code style="background: #1f1f23; padding: 15px; border-radius: 8px; font-size: 1.2rem; border: 1px solid #9146ff; margin: 20px 0;">${code}</code>
        <button onclick="navigator.clipboard.writeText('${code}')" style="background: #9146ff; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">Copier le code</button>
      </body>
    </html>
  `,
    {
      headers: { 'Content-Type': 'text/html' },
    },
  );
}
