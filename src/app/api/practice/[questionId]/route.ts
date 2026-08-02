import { NextResponse } from 'next/server';
import { updatePracticeRating } from '@/lib/data/practice';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ questionId: string }> }
) {
  try {
    const { questionId } = await params;
    const { difficulty } = await request.json();

    if (!difficulty || !['easy', 'medium', 'hard'].includes(difficulty)) {
      return NextResponse.json({ error: 'Valid difficulty (easy, medium, hard) is required' }, { status: 400 });
    }

    const practice = await updatePracticeRating(questionId, difficulty);
    return NextResponse.json({ practice });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal error';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message === 'QUESTION_NOT_AVAILABLE') {
      return NextResponse.json({ error: 'Question is not available' }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
