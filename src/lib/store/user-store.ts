import { create } from 'zustand';
import type { Profile } from '@/lib/types';

interface UserState {
  profile: Profile | null;
  isLoading: boolean;
  setProfile: (profile: Profile | null) => void;
  fetchProfile: () => Promise<Profile | null>;
  clearProfile: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  profile: null,
  isLoading: false,
  setProfile: (profile) => set({ profile }),
  fetchProfile: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch('/api/me');
      if (!res.ok) {
        set({ isLoading: false });
        return null;
      }
      const data = await res.json();
      const userProfile = data.profile as Profile;
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
