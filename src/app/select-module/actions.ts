'use server';

import { createClient as createServerClient } from '@supabase/supabase-js';
import { auth } from '@/auth';

export async function saveModuleSelection(moduleTest: string) {
  const session = await auth();
  
  if (!session?.user?.email) {
    return { error: 'Not authenticated' };
  }

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabase
      .from('profiles')
      .update({ module_test: moduleTest })
      .eq('email', session.user.email);

    if (error) {
      console.error('Failed to update module_test:', error);
      return { error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Exception updating module_test:', err);
    return { error: err.message };
  }
}