import { NextResponse } from 'next/server';
import { updatePracticeRating } from '@/lib/data/practice';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDifficulty(value: unknown): value is 'easy' | 'medium' | 'hard' {
  return value === 'easy' || value === 'medium' || value === 'hard';
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ questionId: string }> }
) {
  try {
    const { questionId } = await params;
    const body: unknown = await request.json();
    const rawDifficulty = isRecord(body) ? body.difficulty : undefined;

    if (!isDifficulty(rawDifficulty)) {
      return NextResponse.json({ error: 'Valid difficulty (easy, medium, hard) is required' }, { status: 400 });
    }

    const practice = await updatePracticeRating(questionId, rawDifficulty);
    return NextResponse.json({ practice });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal error';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (message === 'QUESTION_NOT_FOUND') {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
