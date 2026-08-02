import { NextResponse } from 'next/server';
import { fetchExams } from '@/lib/data/exams';

export async function GET() {
  try {
    const exams = await fetchExams();
    return NextResponse.json({ exams });
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
