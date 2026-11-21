import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import SavedSessionsModal from '../SavedSessionsModal';
import { STORAGE_KEY_SAVES, SearchSessionSave } from '@/core/session-saves';

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
    useSearchParams: () => new URLSearchParams('q=responsabilidade+civil&Secção=1.ª+Secção'),
}));

describe('SavedSessionsModal Component (Prof. Borbinha UX Feedback)', () => {
    let mockStorage: Record<string, string> = {};

    beforeEach(() => {
        mockStorage = {};
        const localStorageMock = {
            getItem: (key: string) => mockStorage[key] || null,
            setItem: (key: string, val: string) => { mockStorage[key] = val; },
            removeItem: (key: string) => { delete mockStorage[key]; },
            clear: () => { mockStorage = {}; },
        };
        Object.defineProperty(window, 'localStorage', {
            value: localStorageMock,
            writable: true,
            configurable: true,
        });

        // Mock window.location
        delete (window as any).location;
        (window as any).location = {
            search: '?q=responsabilidade+civil&Secção=1.ª+Secção',
            pathname: '/pesquisa',
            assign: jest.fn(),
        };
    });

    it('renders with title "Pesquisas Guardadas" and table header', () => {
        render(<SavedSessionsModal id="test-modal" />);

        expect(screen.getByRole('heading', { name: /pesquisas guardadas/i })).toBeInTheDocument();
        expect(screen.getByText(/Nome da Pesquisa \(editável\)/i)).toBeInTheDocument();
        expect(screen.getByText(/Critérios \/ Filtros/i)).toBeInTheDocument();
    });

    it('displays active search as the first suggestion row with a "Guardar" button', () => {
        render(<SavedSessionsModal id="test-modal" />);

        expect(screen.getByText('Nova')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /guardar/i })).toBeInTheDocument();
        expect(screen.getByDisplayValue(/Pesquisa: "responsabilidade civil"/i)).toBeInTheDocument();
    });

    it('renders saved session in a tabular row with "Pesquisar" button', () => {
        const sampleSave: SearchSessionSave = {
            id: 'save-123',
            name: 'Pesquisa Contratos',
            createdAt: 1700000000000,
            updatedAt: 1700000000000,
            pathname: '/pesquisa',
            params: { q: ['contratos'] },
            queryString: '?q=contratos',
            hash: 'abcd1234efgh5678',
            summary: {
                queryText: 'contratos',
                filterCount: 0,
                filtersPreview: [],
            },
        };
        mockStorage[STORAGE_KEY_SAVES] = JSON.stringify([sampleSave]);

        render(<SavedSessionsModal id="test-modal" />);

        expect(screen.getByDisplayValue('Pesquisa Contratos')).toBeInTheDocument();
        const pesquisarBtns = screen.getAllByRole('button', { name: /pesquisar/i });
        expect(pesquisarBtns.length).toBeGreaterThan(0);
    });

    it('has coherent "Exportar Histórico (.json)" and "Importar Histórico (.json)" buttons in footer', () => {
        render(<SavedSessionsModal id="test-modal" />);

        expect(screen.getByRole('button', { name: /exportar histórico \(\.json\)/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /importar histórico \(\.json\)/i })).toBeInTheDocument();
    });
});
