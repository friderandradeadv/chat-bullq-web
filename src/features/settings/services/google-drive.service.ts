import { api } from '@/lib/api';

export interface GoogleDriveStatus {
  configured: boolean;
  connected: boolean;
  clientesFolderId: string | null;
  templatesFolderId: string | null;
}

export interface GoogleDriveConfigResult extends GoogleDriveStatus {
  authUrl: string | null;
  redirectUri: string;
}

export interface GoogleDriveConfigInput {
  clientId?: string;
  clientSecret?: string;
  clientesFolderId?: string;
  templatesFolderId?: string;
}

export const googleDriveService = {
  async getStatus(): Promise<GoogleDriveStatus> {
    const { data } = await api.get('/integrations/google-drive/status');
    return data.data ?? data;
  },

  async saveConfig(input: GoogleDriveConfigInput): Promise<GoogleDriveConfigResult> {
    const { data } = await api.post('/integrations/google-drive/config', input);
    return data.data ?? data;
  },
};
