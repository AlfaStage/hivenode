import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MinerPage from './page';

describe('Miner Web3 Dashboard', () => {
  it('Critério 1: Deve renderizar o título HiveMiner Web3', () => {
    render(<MinerPage />);
    expect(screen.getByText('HiveMiner Web3')).toBeInTheDocument();
  });

  it('Critério 2: Deve exibir a pontuação do usuário', () => {
    render(<MinerPage />);
    expect(screen.getByText('Pontos Acumulados ($HIVE Points)')).toBeInTheDocument();
    expect(screen.getByText('14,500.00')).toBeInTheDocument();
  });

  it('Critério 3: Deve solicitar conexão com a MetaMask', () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    
    render(<MinerPage />);
    const button = screen.getByText('🔗 Conectar MetaMask');
    
    fireEvent.click(button);
    
    // Como a window.ethereum não está mockada no JSDOM, o alerta será chamado
    expect(alertMock).toHaveBeenCalledWith('Por favor, instale a MetaMask ou outra carteira Web3.');
    
    alertMock.mockRestore();
  });
});
