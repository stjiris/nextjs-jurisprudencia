import React from 'react';
import { render, screen, act } from '@testing-library/react';
import SavedSessionsQuickButtons from '../SavedSessionsQuickButtons';
import { STORAGE_KEY_SAVES } from '@/core/session-saves';

describe('SavedSessionsQuickButtons Component', () => {
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
    });

    it('renders Guardar and Histórico buttons with modal target', () => {
        render(<SavedSessionsQuickButtons />);

        const guardarBtn = screen.getByRole('button', { name: /guardar/i });
        const historicoBtn = screen.getByRole('button', { name: /histórico/i });

        expect(guardarBtn).toBeInTheDocument();
        expect(historicoBtn).toBeInTheDocument();

        expect(guardarBtn).toHaveAttribute('data-bs-toggle', 'modal');
        expect(guardarBtn).toHaveAttribute('data-bs-target', '#modal-saved-sessions');
        expect(historicoBtn).toHaveAttribute('data-bs-toggle', 'modal');
        expect(historicoBtn).toHaveAttribute('data-bs-target', '#modal-saved-sessions');
    });

    it('displays session count badge and updates on juris-sessions-updated event', () => {
        mockStorage[STORAGE_KEY_SAVES] = JSON.stringify([
            { id: '1', name: 'Pesquisa 1' },
            { id: '2', name: 'Pesquisa 2' }
        ]);

        render(<SavedSessionsQuickButtons />);

        expect(screen.getByText('2')).toBeInTheDocument();

        // Simulate new session saved
        act(() => {
            mockStorage[STORAGE_KEY_SAVES] = JSON.stringify([
                { id: '1', name: 'Pesquisa 1' },
                { id: '2', name: 'Pesquisa 2' },
                { id: '3', name: 'Pesquisa 3' }
            ]);
            window.dispatchEvent(new Event('juris-sessions-updated'));
        });

        expect(screen.getByText('3')).toBeInTheDocument();
    });
});
