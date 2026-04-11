import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { createClient as createServerClient } from '@supabase/supabase-js';
import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
    } & DefaultSession['user'];
  }
}

/**
 * Sync user to Supabase database after successful OAuth login
 * Uses service role key for server-side operations
 */
async function syncUserToSupabase(user: {
  email: string;
  name: string | null;
  image: string | null;
}) {
  try {
    // Initialize Supabase with service role key (only for server operations)
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Upsert user into Supabase users table
    const { error } = await supabase.from('users').upsert(
      {
        email: user.email,
        name: user.name || null,
        avatar_url: user.image || null,
        last_login: new Date().toISOString(),
      },
      {
        onConflict: 'email',
      }
    );

    if (error) {
      console.error('Error syncing user to Supabase:', error);
    } else {
      console.log('User synced to Supabase:', user.email);
    }
  } catch (err) {
    console.error('Supabase sync error:', err);
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
  ],
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) {
        return false;
      }

      // Sync user to Supabase when signing in
      await syncUserToSupabase({
        email: user.email,
        name: user.name || null,
        image: user.image || null,
      });

      return true;
    },
    async session({ session, token }) {
      // Attach user ID from token to session
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
