import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SaaSPage from './page';

describe('SaaS Dashboard', () => {
  it('Critério 1: Deve renderizar o título do painel corporativo', () => {
    render(<SaaSPage />);
    expect(screen.getByText('Painel Corporativo (SaaS)')).toBeInTheDocument();
  });

  it('Critério 2: Deve listar os nós privados do usuário', () => {
    render(<SaaSPage />);
    expect(screen.getByText('Seus Dispositivos (Nós Privados)')).toBeInTheDocument();
    expect(screen.getByText('📱 Galaxy S23 (SP)')).toBeInTheDocument();
  });

  it('Critério 3: Deve permitir o compartilhamento de acesso (B2B)', () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    
    render(<SaaSPage />);
    const input = screen.getByPlaceholderText('Email do Gestor');
    const button = screen.getByText('Convidar');
    
    fireEvent.change(input, { target: { value: 'gestor@agencia.com' } });
    fireEvent.click(button);
    
    expect(alertMock).toHaveBeenCalledWith('Convite enviado para gestor@agencia.com');
    
    alertMock.mockRestore();
  });
});
