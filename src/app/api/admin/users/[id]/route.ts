import { NextResponse } from 'next/server';
import { adminUpdateUserLimit } from '@/lib/data/admin-data';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { allow_test_limit } = await request.json();

    if (typeof allow_test_limit !== 'number') {
      return NextResponse.json({ error: 'allow_test_limit number is required' }, { status: 400 });
    }

    const user = await adminUpdateUserLimit(id, allow_test_limit);
    return NextResponse.json({ user });
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
