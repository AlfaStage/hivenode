import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import SaaSPage from './page';
afterEach(() => vi.unstubAllGlobals());
describe('B2B sharing', () => {
  it('loads real devices and submits a server-backed invitation', async () => {
    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
      if (url === '/api/nodes') return { json: async () => ({ success: true, data: { nodes: [{ id: 'node-a', deviceName: 'Real device', visibility: 'PRIVATE', status: 'ONLINE' }] } }) };
      if (url === '/api/auth/me') return { json: async () => ({ success: true, data: { id: 'owner' } }) };
      if (options?.method === 'POST') return { ok: true };
      return { json: async () => ({ success: true, data: { shares: [] } }) };
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<SaaSPage />);
    await screen.findByText('Real device — ONLINE');
    fireEvent.change(screen.getByLabelText('Aparelho'), { target: { value: 'node-a' } });
    fireEvent.change(screen.getByLabelText('Email do Gestor'), { target: { value: 'guest@example.com' } });
    fireEvent.click(screen.getByText('Convidar'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/shares', expect.objectContaining({ method: 'POST', body: JSON.stringify({ nodeId: 'node-a', email: 'guest@example.com', maxProxies: 1 }) })));
    expect(await screen.findByText('Convite disponível para o destinatário')).toBeInTheDocument();
  });
});
