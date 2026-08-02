import { NextResponse } from 'next/server';
import { updateAttemptProgress } from '@/lib/data/attempts';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userAnswers } = await request.json();
    if (typeof userAnswers !== 'object' || userAnswers === null || Array.isArray(userAnswers)) {
      return NextResponse.json({ error: 'userAnswers must be an object' }, { status: 400 });
    }

    const attempt = await updateAttemptProgress(id, userAnswers);
    return NextResponse.json({ attempt });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal error';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
