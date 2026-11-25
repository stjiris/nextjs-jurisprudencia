import { CANONICAL_SECCAO_NAMES, canonicalizeSeccao, getSeccaoVariants, mergeSeccaoBuckets } from '../seccao-util';

describe('Seccao Normalization Utilities', () => {
    it('includes Contencioso, Tribunal de Conflitos, and Formação in canonical section names', () => {
        expect(CANONICAL_SECCAO_NAMES).toContain('Contencioso');
        expect(CANONICAL_SECCAO_NAMES).toContain('Tribunal de Conflitos');
        expect(CANONICAL_SECCAO_NAMES).toContain('Formação');
    });

    it('canonicalizes Conflitos, Cnflitos typo, and Formação variations', () => {
        expect(canonicalizeSeccao('Conflitos')).toBe('Tribunal de Conflitos');
        expect(canonicalizeSeccao('Cnflitos')).toBe('Tribunal de Conflitos');
        expect(canonicalizeSeccao('Tribunal de Conflitos')).toBe('Tribunal de Conflitos');
        expect(canonicalizeSeccao('Formação')).toBe('Formação');
        expect(canonicalizeSeccao('Formação de Apreciação Preliminar')).toBe('Formação');
        expect(canonicalizeSeccao('Secção de Formação')).toBe('Formação');
    });

    it('returns search variants for Conflitos and Formação', () => {
        expect(getSeccaoVariants('Tribunal de Conflitos')).toEqual(
            expect.arrayContaining(['Tribunal de Conflitos', 'Conflitos', 'Cnflitos'])
        );
        expect(getSeccaoVariants('Formação')).toEqual(
            expect.arrayContaining(['Formação', 'Formação de Apreciação Preliminar', 'Secção de Formação'])
        );
    });

    it('merges buckets for Conflitos and Formação cleanly', () => {
        const merged = mergeSeccaoBuckets([
            { key: 'Conflitos', doc_count: 10 },
            { key: 'Cnflitos', doc_count: 2 },
            { key: 'Formação de Apreciação Preliminar', doc_count: 5 },
            { key: 'Formação', doc_count: 3 },
        ]);
        expect(merged).toEqual([
            { key: 'Tribunal de Conflitos', count: 12 },
            { key: 'Formação', count: 8 },
        ]);
    });
});
