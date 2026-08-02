import { NextResponse } from 'next/server';
import { adminUpdateUserProfile } from '@/lib/data/admin-data';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const updates: unknown = await request.json();
    const user = await adminUpdateUserProfile(id, updates);
    return NextResponse.json({ user });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal error';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (message === 'INVALID_PROFILE_UPDATE') {
      return NextResponse.json({ error: 'Invalid profile update' }, { status: 400 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
