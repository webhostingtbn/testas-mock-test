import { NextResponse } from 'next/server';
import { requireApprovedUser } from '@/lib/auth/guards';
import { getAdminSupabaseClient } from '@/lib/supabase/admin';
import { evaluateAnswer } from '@/lib/exam/answer-evaluator';

interface VerifyItem {
  questionId: string;
  answer: unknown;
}

interface VerifyResult {
  questionId: string;
  isCorrect: boolean;
  correctAnswer?: unknown;
  notFound?: boolean;
}

const MAX_VERIFY_ITEMS = 50;

export async function POST(req: Request) {
  try {
    const { profile } = await requireApprovedUser();

    const raw = await req.json().catch(() => null);
    if (!raw || typeof raw !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const rawObj = raw as Record<string, unknown>;
    const items: VerifyItem[] = [];

    if (Array.isArray(rawObj.items)) {
      for (const it of rawObj.items) {
        if (it && typeof it === 'object' && 'questionId' in it && typeof (it as { questionId: unknown }).questionId === 'string') {
          const typedItem = it as { questionId: string; answer?: unknown };
          items.push({ questionId: typedItem.questionId, answer: typedItem.answer });
        }
      }
    } else if (typeof rawObj.questionId === 'string' && rawObj.questionId.length > 0) {
      items.push({ questionId: rawObj.questionId, answer: rawObj.answer });
    }

    if (items.length === 0) {
      return NextResponse.json({ error: 'Missing question items to verify' }, { status: 400 });
    }

    if (items.length > MAX_VERIFY_ITEMS) {
      return NextResponse.json({ error: `Exceeded maximum batch limit of ${MAX_VERIFY_ITEMS} items` }, { status: 400 });
    }

    const questionIds = Array.from(new Set(items.map((it) => it.questionId)));

    const supabase = getAdminSupabaseClient();


    // Fetch question types from public.questions
    const { data: questions, error: qErr } = await supabase
      .from('questions')
      .select('id, question_type, section_id')
      .in('id', questionIds);

    if (qErr) {
      console.error('[API Practice Verify] Failed to fetch questions:', qErr);
      return NextResponse.json({ error: 'Failed to fetch question data' }, { status: 500 });
    }

    // Fetch answer keys via secure RPC
    const { data: answerKeys, error: aErr } = await supabase.rpc('get_practice_question_answers', {
      p_question_ids: questionIds,
    });

    if (aErr) {
      console.error('[API Practice Verify] Failed to fetch answer keys:', aErr);
      return NextResponse.json({ error: 'Failed to fetch answer keys' }, { status: 500 });
    }

    const questionMap = new Map((questions || []).map((q) => [q.id, q]));
    const answerMap = new Map<string, unknown>();

    if (Array.isArray(answerKeys)) {
      for (const row of answerKeys) {
        if (
          row &&
          typeof row === 'object' &&
          'question_id' in row &&
          typeof (row as { question_id: unknown }).question_id === 'string'
        ) {
          const typedRow = row as { question_id: string; correct_answer: unknown };
          answerMap.set(typedRow.question_id, typedRow.correct_answer);
        }
      }
    }

    const results: VerifyResult[] = [];

    for (const item of items) {
      const q = questionMap.get(item.questionId);
      const correctAnswer = answerMap.get(item.questionId);

      if (!q || correctAnswer === undefined) {
        results.push({
          questionId: item.questionId,
          isCorrect: false,
          notFound: true,
        });
        continue;
      }

      const isCorrect = evaluateAnswer(q.question_type, item.answer, correctAnswer);
      results.push({
        questionId: item.questionId,
        isCorrect,
        correctAnswer,
      });
    }

    return NextResponse.json({ results });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal error';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('[API Practice Verify] Unexpected error:', error);
    return NextResponse.json({ error: 'Failed to verify answers' }, { status: 500 });
  }
}
