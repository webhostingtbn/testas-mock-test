import { NextResponse } from 'next/server';
import { fetchExamById } from '@/lib/data/exams';
import { isLang } from '@/lib/i18n/config';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const langParam = searchParams.get('lang');
    const lang = isLang(langParam) ? langParam : undefined;

    const data = await fetchExamById(id, lang ? { lang } : undefined);
    return NextResponse.json(data);
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
