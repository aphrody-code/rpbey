import { NextResponse } from 'next/server';
import { fetchLatestBeyblades } from '@/lib/feedmy';

export async function GET() {
  const products = await fetchLatestBeyblades();
  return NextResponse.json(products);
}
