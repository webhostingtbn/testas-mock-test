import { NextResponse } from 'next/server';
import { requireApprovedUser } from '@/lib/auth/guards';
import { getAdminSupabaseClient } from '@/lib/supabase/admin';
import { canAccessStoragePath, getStorageBucket } from '@/lib/data/storage';

export async function GET(request: Request) {
  try {
    const { profile } = await requireApprovedUser();

    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path');

    if (!path) {
      return NextResponse.json({ error: 'path parameter is required' }, { status: 400 });
    }

    if (!(await canAccessStoragePath(path, profile))) {
      return NextResponse.json({ error: 'Storage object is not accessible' }, { status: 403 });
    }

    const supabase = getAdminSupabaseClient();
    const { data, error } = await supabase.storage
      .from(getStorageBucket())
      .createSignedUrl(path, 60); // 60 seconds expiry

    if (error || !data) {
      return NextResponse.json({ error: error?.message || 'Failed to sign URL' }, { status: 500 });
    }

    return NextResponse.json({ signedUrl: data.signedUrl });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal error';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
