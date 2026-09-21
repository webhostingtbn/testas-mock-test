import 'server-only';

import { getAdminSupabaseClient } from '@/lib/supabase/admin';
import type { UserProfile } from '@/lib/auth/guards';

const STORAGE_BUCKET = 'ExamDataset';

function collectStrings(value: unknown, output: Set<string>): void {
  if (typeof value === 'string') {
    output.add(value);
    // Collect the bare storage path alongside full URLs, excluding any
    // query string or hash so signed URLs still match their object.
    const match = value.match(/\/ExamDataset\/([^?#]+)/);
    if (match && match[1]) {
      output.add(match[1]);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectStrings(item, output));
    return;
  }
  if (typeof value === 'object' && value !== null) {
    Object.values(value).forEach((item) => collectStrings(item, output));
  }
}

export function isSafeStoragePath(path: string): boolean {
  return path.length > 0
    && path.length <= 512
    && !path.startsWith('/')
    && !path.startsWith('http://')
    && !path.startsWith('https://')
    && !path.includes('..')
    && !path.includes('\\')
    && !path.includes('?')
    && !path.includes('#');
}

export async function canAccessStoragePath(path: string, profile: UserProfile): Promise<boolean> {
  if (!isSafeStoragePath(path)) return false;
  if (profile.role === 'admin') return true;

  const supabase = getAdminSupabaseClient();
  let examQuery = supabase
    .from('exams')
    .select('id')
    .eq('is_active', true);
  if (profile.format) {
    examQuery = examQuery.eq('format', profile.format);
  }

  const { data: exams, error: examError } = await examQuery;
  if (examError) throw new Error(`Failed to check storage access: ${examError.message}`);

  const examIds = (exams ?? []).map((exam) => exam.id);
  if (examIds.length === 0) return false;

  const { data: sections, error: sectionError } = await supabase
    .from('sections')
    .select('id')
    .in('exam_id', examIds);
  if (sectionError) throw new Error(`Failed to check storage sections: ${sectionError.message}`);

  const sectionIds = (sections ?? []).map((section) => section.id);
  if (sectionIds.length === 0) return false;

  const [{ data: passages, error: passageError }, { data: questions, error: questionError }] = await Promise.all([
    supabase.from('passages').select('image_url').in('section_id', sectionIds),
    supabase.from('questions').select('content').in('section_id', sectionIds),
  ]);

  if (passageError) throw new Error(`Failed to check passage assets: ${passageError.message}`);
  if (questionError) throw new Error(`Failed to check question assets: ${questionError.message}`);

  const referencedPaths = new Set<string>();
  (passages ?? []).forEach((passage) => {
    if (passage.image_url) referencedPaths.add(passage.image_url);
  });
  (questions ?? []).forEach((question) => collectStrings(question.content, referencedPaths));

  return referencedPaths.has(path);
}

export function getStorageBucket(): string {
  return STORAGE_BUCKET;
}
