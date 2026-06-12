import { api } from '@/lib/api';

export interface ContactStatus {
  id: string;
  organizationId: string;
  name: string;
  color: string;
  description: string | null;
  departmentId: string | null;
  sortOrder: number;
  department?: { id: string; name: string; color: string } | null;
  _count?: { contacts: number };
}

export interface CreateContactStatusPayload {
  name: string;
  color?: string;
  description?: string;
  departmentId?: string;
  sortOrder?: number;
}

export interface UpdateContactStatusPayload {
  name?: string;
  color?: string;
  description?: string;
  departmentId?: string | null;
  sortOrder?: number;
}

export const contactStatusesService = {
  async list(): Promise<ContactStatus[]> {
    const { data } = await api.get('/contact-statuses');
    return data.data ?? data;
  },
  async create(payload: CreateContactStatusPayload): Promise<ContactStatus> {
    const { data } = await api.post('/contact-statuses', payload);
    return data.data ?? data;
  },
  async update(
    id: string,
    payload: UpdateContactStatusPayload,
  ): Promise<ContactStatus> {
    const { data } = await api.patch(`/contact-statuses/${id}`, payload);
    return data.data ?? data;
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/contact-statuses/${id}`);
  },
  /** statusId=null limpa o status do contato */
  async setContactStatus(contactId: string, statusId: string | null) {
    const { data } = await api.put(`/contact-statuses/contact/${contactId}`, {
      statusId,
    });
    return data.data ?? data;
  },
};
