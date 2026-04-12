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
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Look for an existing profile by email first
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', user.email)
      .maybeSingle();

    if (existingProfile) {
      // Update existing profile (e.g. for last_login/updated_at if we had those columns or just name/avatar)
      await supabase
        .from('profiles')
        .update({
          full_name: user.name || null,
          avatar_url: user.image || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingProfile.id);
      
      console.log('User synced to existing Supabase profile:', user.email);
    } else {
      // Create new profile with a generated UUID 
      // Note: Assumes `id` is a serial UUID default or we generate one.
      const newId = crypto.randomUUID();
      
      const { error } = await supabase
        .from('profiles')
        .insert({
          id: newId,
          email: user.email,
          full_name: user.name || null,
          avatar_url: user.image || null,
        });

      if (error) console.error('Error creating new Supabase profile:', error);
      else console.log('Created new Supabase profile for:', user.email);
    }
  } catch (err) {
    console.error('Supabase sync error:', err);
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
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
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production' ? '__Secure-authjs.session-token' : 'authjs.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
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
    async jwt({ token, user }) {
      if (user) {
        token.email = user.email;
        token.name = user.name;
        token.image = user.image;
        
        // Try to get user id from Supabase, but don't fail if it doesn't work
        try {
          const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          );
          const { data } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', user.email)
            .maybeSingle();

          if (data?.id) {
            token.sub = data.id;
          }
        } catch (err) {
          console.warn('Failed to get user id from Supabase in JWT callback:', err);
          // Continue with the default token.sub
        }
      }
      return token;
    },
    async session({ session, token }) {
      // Attach user data from token
      if (session.user) {
        session.user.id = token.sub || '';
        session.user.email = (token.email as string) || '';
        session.user.name = (token.name as string) || '';
        session.user.image = (token.image as string | null) || null;
      }
      return session;
    },
  },
});
