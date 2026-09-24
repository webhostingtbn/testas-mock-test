import { NextResponse } from 'next/server';
import { submitAttempt } from '@/lib/data/attempts';
import { parseSubmissionRequest } from '@/lib/exam/submission-request';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const raw: unknown = await request.json();

    const parsed = parseSubmissionRequest(raw);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const result = await submitAttempt(
      id,
      parsed.value.userAnswers,
      parsed.value.completionReason,
    );
    return NextResponse.json({ result });
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
    if (message === 'ANSWER_KEY_MISSING' || message === 'NO_QUESTIONS_FOUND_FOR_ATTEMPT') {
      return NextResponse.json({ error: message }, { status: 422 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
