import { NextResponse } from 'next/server';
import { createAttempt, listAttempts } from '@/lib/data/attempts';

export async function GET() {
  try {
    const attempts = await listAttempts();
    return NextResponse.json({ attempts });
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

export async function POST(request: Request) {
  try {
    const { examId } = await request.json();
    if (!examId) {
      return NextResponse.json({ error: 'examId is required' }, { status: 400 });
    }

    const attempt = await createAttempt(examId);
    return NextResponse.json({ attempt });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal error';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (message === 'TEST_LIMIT_EXCEEDED') {
      return NextResponse.json({ error: 'Test limit exceeded' }, { status: 403 });
    }
    if (message === 'EXAM_NOT_AVAILABLE') {
      return NextResponse.json({ error: 'Exam is not available' }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
