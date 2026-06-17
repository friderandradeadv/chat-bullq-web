import { api } from '@/lib/api';

export interface ProfileUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

export const profileService = {
  async updateProfile(patch: { name?: string; avatarUrl?: string }): Promise<ProfileUser> {
    const { data } = await api.patch('/users/me', patch);
    return data;
  },

  async changePassword(payload: { currentPassword: string; newPassword: string }): Promise<void> {
    await api.post('/users/me/change-password', payload);
  },
};
