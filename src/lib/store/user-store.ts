import { create } from 'zustand';
import type { Profile } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';

interface UserState {
  profile: Profile | null;
  isLoading: boolean;
  setProfile: (profile: Profile | null) => void;
  fetchProfile: (email: string) => Promise<Profile | null>;
  clearProfile: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  profile: null,
  isLoading: false,
  setProfile: (profile) => set({ profile }),
  fetchProfile: async (email) => {
    set({ isLoading: true });
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user profile:', error);
        set({ isLoading: false });
        return null;
      }

      const userProfile = data as Profile;
      set({ profile: userProfile, isLoading: false });
      return userProfile;
    } catch (err) {
      console.error('Failed to fetch user profile:', err);
      set({ isLoading: false });
      return null;
    }
  },
  clearProfile: () => set({ profile: null }),
}));
