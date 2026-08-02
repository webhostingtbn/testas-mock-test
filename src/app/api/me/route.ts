import { NextResponse } from 'next/server';
import { fetchMyProfile, updateMyProfile } from '@/lib/data/profiles';

export async function GET() {
  try {
    const profile = await fetchMyProfile();
    return NextResponse.json({ profile });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal error';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message === 'PROFILE_NOT_FOUND') {
      return NextResponse.json({ error: 'Profile not found' }, { status: 403 });
    }
    if (message === 'PROFILE_LOOKUP_FAILED') {
      return NextResponse.json({ error: 'Profile service unavailable' }, { status: 503 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const profile = await updateMyProfile(body);
    return NextResponse.json({ profile });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal error';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message === 'PROFILE_NOT_FOUND') {
      return NextResponse.json({ error: 'Profile not found' }, { status: 403 });
    }
    if (message === 'PROFILE_LOOKUP_FAILED') {
      return NextResponse.json({ error: 'Profile service unavailable' }, { status: 503 });
    }
    if (message === 'INVALID_PROFILE_FIELD' || message === 'INVALID_PROFILE_UPDATE') {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
