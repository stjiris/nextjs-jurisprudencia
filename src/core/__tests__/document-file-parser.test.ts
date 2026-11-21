import { parseFilename, normalizeProcessNumber } from '../filename-parser';
import { parseDocumentFile } from '../document-file-parser';

describe('Filename & Document File Parser', () => {
    describe('Filename Parser', () => {
        it('should parse Pattern B: "Processo - Acordao - Relator"', () => {
            const parsed = parseFilename('1469-18.2T8AVR.P1.S1 - Acordao - Manuel Aguiar Pereira.docx');
            expect(parsed.nrProcesso).toBe('1469/18.2T8AVR.P1.S1');
            expect(parsed.tipoDocumento).toBe('acordao');
            expect(parsed.relator).toBe('Manuel Aguiar Pereira');
            expect(parsed.hasEmbeddedSumario).toBe(false);
        });

        it('should parse Pattern B with Sumário', () => {
            const parsed = parseFilename('1575-23.1JACBR-A.S1 - Sumario - Celso Manata.docx');
            expect(parsed.nrProcesso).toBe('1575/23.1JACBR-A.S1');
            expect(parsed.tipoDocumento).toBe('sumario');
            expect(parsed.relator).toBe('Celso Manata');
        });

        it('should parse Pattern C: "Processo+Acórdão+Sumário-Relator"', () => {
            const parsed = parseFilename('29756-21.5T8LSB.L1.S1+Acórdão+Sumário-António Magalhães.docx');
            expect(parsed.nrProcesso).toBe('29756/21.5T8LSB.L1.S1');
            expect(parsed.tipoDocumento).toBe('acordao_com_sumario');
            expect(parsed.hasEmbeddedSumario).toBe(true);
            expect(parsed.relator).toBe('António Magalhães');
        });

        it('should parse Pattern A: "Processo_acordao"', () => {
            const parsed = parseFilename('547_22.8T8ENT-A.E1.S2-A_acordao.docx');
            expect(parsed.nrProcesso).toBe('547/22.8T8ENT-A.E1.S2-A');
            expect(parsed.tipoDocumento).toBe('acordao');
        });

        it('should normalize process number with hyphen or underscore before 2-digit year to slash', () => {
            expect(normalizeProcessNumber('525-25.5PFLRS.S1.L1')).toBe('525/25.5PFLRS.S1.L1');
            expect(normalizeProcessNumber('36_25.9GFVFX.L1.S1')).toBe('36/25.9GFVFX.L1.S1');
            expect(normalizeProcessNumber('3556/22.3T8PNF-A.P1.S1')).toBe('3556/22.3T8PNF-A.P1.S1');
        });
    });

    describe('Document Content Parser', () => {
        it('should parse text buffer and extract metadata', async () => {
            const mockText = `
                SUPREMO TRIBUNAL DE JUSTIÇA
                3.ª Secção Criminal
                
                Processo n.º 1469/18.2T8AVR.P1.S1
                Acordam no Supremo Tribunal de Justiça em 28 de Outubro de 2026.
                
                Relator: Conselheiro Manuel Aguiar Pereira
                Meio Processual: Recurso de revista
                Decisão: Negar provimento
                Descritores: Habeas Corpus; Prisão Preventiva; Nulidade
                
                SUMÁRIO:
                I. O recurso extraordinário de revisão visa a reparação de erro judiciário.
                II. A mera divergência quanto à valoração da prova não fundamenta revisão.
                
                I - Relatório
                1. O arguido AA interpôs recurso da decisão condenatória...
                2. O Ministério Público respondeu pugnando pela manutenção do julgado.
                
                Decisão:
                Pelo exposto, acordam em negar provimento ao recurso.
            `;

            const buffer = Buffer.from(mockText, 'utf-8');
            const result = await parseDocumentFile('1469-18.2T8AVR.P1.S1 - Acordao.txt', buffer);

            expect(result.ok).toBe(true);
            expect(result.parsedDoc['Número de Processo']).toBe('1469/18.2T8AVR.P1.S1');
            expect(result.parsedDoc['Relator Nome Profissional']?.Show[0]).toContain('Manuel Aguiar Pereira');
            expect(result.parsedDoc['Data']).toBe('28/10/2026');
            expect(result.parsedDoc['Secção']?.Show[0]).toBe('3.ª Secção (Criminal)');
            expect(result.parsedDoc['Área']?.Show[0]).toBe('Área Criminal');
            expect(result.parsedDoc['Decisão']?.Show[0]).toBe('Negar provimento');
            expect(result.parsedDoc['Meio Processual']?.Show[0]).toBe('Recurso de revista');
            expect(result.parsedDoc['Descritores']?.Show).toEqual(
                expect.arrayContaining(['Habeas Corpus', 'Prisão Preventiva', 'Nulidade'])
            );
            expect(result.parsedDoc['STATE']).toBe('importação');
            expect(result.summary.temSumario).toBe(true);
        });
    });
});
