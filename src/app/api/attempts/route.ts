import { NextResponse } from 'next/server';
import { createAttempt, listAttempts } from '@/lib/data/attempts';
import type { AttemptKind } from '@/lib/types';

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

interface CreateAttemptRequest {
  examId?: unknown;
  sectionIds?: unknown;
  attemptKind?: unknown;
}

function isCreateAttemptRequest(body: unknown): body is CreateAttemptRequest {
  return typeof body === 'object' && body !== null && !Array.isArray(body);
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!isCreateAttemptRequest(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { examId, sectionIds, attemptKind } = body;

    if (typeof examId !== 'string' || !examId) {
      return NextResponse.json({ error: 'examId is required' }, { status: 400 });
    }

    if (attemptKind !== undefined && attemptKind !== 'mock' && attemptKind !== 'drill') {
      return NextResponse.json({ error: 'Invalid attemptKind: must be mock or drill' }, { status: 400 });
    }

    let parsedSectionIds: string[] | undefined = undefined;
    if (sectionIds !== undefined) {
      if (!Array.isArray(sectionIds) || !sectionIds.every((id): id is string => typeof id === 'string')) {
        return NextResponse.json({ error: 'sectionIds must be an array of strings' }, { status: 400 });
      }
      parsedSectionIds = sectionIds;
    }

    const parsedKind: AttemptKind = attemptKind === 'drill' ? 'drill' : 'mock';

    if (parsedKind === 'mock' && parsedSectionIds && parsedSectionIds.length > 0) {
      return NextResponse.json({ error: 'Mock exams cannot specify sectionIds' }, { status: 400 });
    }

    if (parsedKind === 'drill' && (!parsedSectionIds || parsedSectionIds.length !== 1)) {
      return NextResponse.json({ error: 'Subtest drills require exactly 1 sectionId' }, { status: 400 });
    }

    const attempt = await createAttempt(examId, parsedSectionIds, parsedKind);
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
    if (message === 'DRILL_MISSING_SECTIONS') {
      return NextResponse.json({ error: 'Subtest drills require at least one section' }, { status: 400 });
    }
    if (message === 'DRILL_SINGLE_SECTION_ONLY') {
      return NextResponse.json({ error: 'Subtest drills currently only support single-section selection' }, { status: 400 });
    }
    if (message === 'INVALID_SECTION_FOR_EXAM') {
      return NextResponse.json({ error: 'Selected section does not belong to this exam' }, { status: 400 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
