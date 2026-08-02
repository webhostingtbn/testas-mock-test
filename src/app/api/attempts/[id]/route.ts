import { NextResponse } from 'next/server';
import { getAttempt } from '@/lib/data/attempts';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const attempt = await getAttempt(id);
    return NextResponse.json({ attempt });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal error';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (message === 'ATTEMPT_NOT_FOUND') {
      return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
