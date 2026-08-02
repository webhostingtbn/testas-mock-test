import { NextResponse } from 'next/server';
import { adminToggleExamActive } from '@/lib/data/admin-data';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { is_active } = await request.json();

    if (typeof is_active !== 'boolean') {
      return NextResponse.json({ error: 'is_active boolean is required' }, { status: 400 });
    }

    const exam = await adminToggleExamActive(id, is_active);
    return NextResponse.json({ exam });
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
