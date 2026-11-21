import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ChangelogPage from '../changelog';

const mockReleases = [
  {
    version: '0.4.0',
    date: '2026-11-21',
    isCurrent: true,
    sections: [
      {
        type: 'Adicionado' as const,
        items: [
          {
            title: 'Tabela de Resultados em Formato Folha de Cálculo',
            description: ['Ordenação interativa e filtros por coluna', 'Exportação Excel/CSV com UTF-8 BOM'],
          },
          {
            title: 'Página Dedicada de Registo de Alterações',
            description: ['Acesso a CHANGELOG.md'],
          },
        ],
      },
      {
        type: 'Melhorado' as const,
        items: [
          {
            title: 'Reformulação do Modal de Pesquisas Guardadas',
            description: ['Layout tabular compacto e inline editing'],
          },
        ],
      },
    ],
    rawMarkdown: '## [0.4.0] - 2026-11-21\n### Adicionado\n- Tabela\n',
  },
  {
    version: '0.3.0',
    date: '2026-11-18',
    isCurrent: false,
    sections: [
      {
        type: 'Adicionado' as const,
        items: [
          {
            title: 'Motor de Exportação Institucional para Word (.docx)',
            description: ['Geração via Pandoc com metadados estruturados'],
          },
        ],
      },
    ],
    rawMarkdown: '## [0.3.0] - 2026-11-18\n### Adicionado\n- Word\n',
  },
];

describe('ChangelogPage Component', () => {
  it('renders page header, version badges, and release cards', () => {
    render(
      <ChangelogPage
        releases={mockReleases}
        rawFullChangelog="## [0.4.0] - 2026-11-21\n## [0.3.0] - 2026-11-18"
      />
    );

    // Header & Titles
    expect(screen.getByText('Registo de Alterações')).toBeInTheDocument();
    expect(screen.getByText('v0.4.0')).toBeInTheDocument();
    expect(screen.getByText('Versão Atual em Produção')).toBeInTheDocument();
    expect(screen.getByText('v0.3.0')).toBeInTheDocument();

    // Section Items
    expect(screen.getByText('Tabela de Resultados em Formato Folha de Cálculo')).toBeInTheDocument();
    expect(screen.getByText('Motor de Exportação Institucional para Word (.docx)')).toBeInTheDocument();
    expect(screen.getByText('Reformulação do Modal de Pesquisas Guardadas')).toBeInTheDocument();
  });

  it('filters releases by search keyword', () => {
    render(
      <ChangelogPage
        releases={mockReleases}
        rawFullChangelog="## [0.4.0] - 2026-11-21\n## [0.3.0] - 2026-11-18"
      />
    );

    const input = screen.getByPlaceholderText(/Pesquisar nestas notas de lançamento/i);
    fireEvent.change(input, { target: { value: 'folha de cálculo' } });

    expect(screen.getByText('Tabela de Resultados em Formato Folha de Cálculo')).toBeInTheDocument();
    expect(screen.queryByText('Motor de Exportação Institucional para Word (.docx)')).not.toBeInTheDocument();
  });

  it('toggles raw markdown display on button click', () => {
    render(
      <ChangelogPage
        releases={mockReleases}
        rawFullChangelog="# Registo de Alterações Integral"
      />
    );

    const toggleBtn = screen.getByText('Ver Markdown');
    fireEvent.click(toggleBtn);

    expect(screen.getByText('Ocultar Texto Bruto')).toBeInTheDocument();
    expect(screen.getByText('# Registo de Alterações Integral')).toBeInTheDocument();
  });
});
