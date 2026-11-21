import React from 'react';
import { render, screen } from '@testing-library/react';
import JurisprudenciaTable from '../JurisprudenciaTable';
import { KeysContext } from '@/contexts/keys';
import { SearchHandlerResponse } from '@/types/search';

describe('JurisprudenciaTable Component', () => {
  const mockKeysContext = {
    keys: [],
    records: {
      'Relator Nome Profissional': { key: 'Relator Nome Profissional', active: true, unauthenticated: true, name: 'Relator' },
      'Meio Processual': { key: 'Meio Processual', active: true, unauthenticated: true, name: 'Meio Processual' },
      Decisão: { key: 'Decisão', active: true, unauthenticated: true, name: 'Decisão' },
      Descritores: { key: 'Descritores', active: true, unauthenticated: true, name: 'Descritores' },
      STATE: { key: 'STATE', active: true, unauthenticated: false, name: 'Estado' }
    } as any
  };

  const mockResults: SearchHandlerResponse = [
    {
      score: 1.0,
      max_score: 1.0,
      _source: {
        UUID: 'uuid-123',
        'Número de Processo': '1234/20.5YFLSB',
        Data: '15/05/2024',
        'Relator Nome Profissional': { Show: ['Conselheiro Silva'] },
        'Meio Processual': { Show: ['Recurso de Revista'] },
        Decisão: { Show: ['Negado Provimento'] },
        Descritores: { Show: ['Responsabilidade Civil', 'Contrato de Empreitada'] },
        ECLI: 'ECLI:PT:STJ:2024:1234.5YFLSB',
        STATE: 'público'
      } as any
    },
    {
      score: 0.9,
      max_score: 1.0,
      _source: {
        UUID: 'uuid-456',
        'Número de Processo': '5678/22.1T8LRA',
        Data: '10/06/2024',
        'Relator Nome Profissional': { Original: ['Conselheira Santos'] },
        'Meio Processual': { Show: ['Apelação'] },
        Decisão: { Original: ['Concedido Provimento'] },
        Descritores: { Original: ['Crime de Burla', 'Medida da Pena'] },
        STATE: 'preparação'
      } as any
    }
  ];

  it('renders table headers and row cells properly', () => {
    render(
      <KeysContext.Provider value={mockKeysContext}>
        <JurisprudenciaTable results={mockResults} searchId="test-search-id" />
      </KeysContext.Provider>
    );

    // Headers
    expect(screen.getByText('Processo')).toBeInTheDocument();
    expect(screen.getByText('Data')).toBeInTheDocument();
    expect(screen.getByText('Relator')).toBeInTheDocument();
    expect(screen.getByText('Meio Processual')).toBeInTheDocument();
    expect(screen.getByText('Decisão')).toBeInTheDocument();
    expect(screen.getByText('Descritores')).toBeInTheDocument();
    expect(screen.getByText('Estado')).toBeInTheDocument();

    // Row 1
    expect(screen.getByText('1234/20.5YFLSB')).toBeInTheDocument();
    expect(screen.getByText('15/05/2024')).toBeInTheDocument();
    expect(screen.getByText('Conselheiro Silva')).toBeInTheDocument();
    expect(screen.getByText('Negado Provimento')).toBeInTheDocument();
    expect(screen.getByText('Responsabilidade Civil, Contrato de Empreitada')).toBeInTheDocument();

    // Row 2
    expect(screen.getByText('5678/22.1T8LRA')).toBeInTheDocument();
    expect(screen.getByText('10/06/2024')).toBeInTheDocument();
    expect(screen.getByText('Conselheira Santos')).toBeInTheDocument();
  });

  it('generates ECLI links when ECLI starts with ECLI:PT:STJ:', () => {
    render(
      <KeysContext.Provider value={mockKeysContext}>
        <JurisprudenciaTable results={mockResults} searchId="sid123" />
      </KeysContext.Provider>
    );

    const link1 = screen.getByText('1234/20.5YFLSB').closest('a');
    expect(link1).toHaveAttribute('href', '/ecli/ECLI:PT:STJ:2024:1234.5YFLSB?search=sid123');
  });

  it('renders spreadsheet controls (CSV export button, filter toggle, column filter inputs)', () => {
    render(
      <KeysContext.Provider value={mockKeysContext}>
        <JurisprudenciaTable results={mockResults} searchId="test-search-id" />
      </KeysContext.Provider>
    );

    // CSV export button
    expect(screen.getByText('Exportar CSV')).toBeInTheDocument();

    // Toggle filters button
    expect(screen.getByText('Filtros')).toBeInTheDocument();

    // Column filter placeholders
    expect(screen.getByPlaceholderText('Filtrar processo...')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Filtrar relator...')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Filtrar descritores...')).toBeInTheDocument();
  });
});
