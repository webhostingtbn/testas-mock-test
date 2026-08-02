import { NextResponse } from 'next/server';
import { adminSetAllUsersLimit } from '@/lib/data/admin-data';

export async function PATCH(request: Request) {
  try {
    const { allow_test_limit } = await request.json();

    if (typeof allow_test_limit !== 'number') {
      return NextResponse.json({ error: 'allow_test_limit number is required' }, { status: 400 });
    }

    const users = await adminSetAllUsersLimit(allow_test_limit);
    return NextResponse.json({ users });
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
