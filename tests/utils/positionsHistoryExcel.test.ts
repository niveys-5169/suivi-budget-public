import { describe, it, expect } from 'vitest';
import * as XLSX from '@e965/xlsx';
import {
  normalizeMontant,
  normalizeDate,
  parseHistoryRows,
  buildHistoryWorkbook,
} from '../../public/src/utils/positionsHistoryExcel';

describe('positionsHistoryExcel Utility', () => {
  describe('normalizeMontant', () => {
    it('should handle numbers', () => {
      expect(normalizeMontant(123.45)).toBe(123.45);
    });

    it('should parse standard string numbers', () => {
      expect(normalizeMontant('123.45')).toBe(123.45);
    });

    it('should handle French separators (space and comma)', () => {
      expect(normalizeMontant('1 234,56')).toBe(1234.56);
    });

    it('should return NaN for invalid values', () => {
      expect(normalizeMontant('abc')).toBeNaN();
      expect(normalizeMontant(null)).toBeNaN();
    });
  });

  describe('normalizeDate', () => {
    it('should handle Date objects', () => {
      const d = new Date('2024-05-23');
      expect(normalizeDate(d)).toBe('2024-05-23');
    });

    it('should handle ISO strings', () => {
      expect(normalizeDate('2024-05-23')).toBe('2024-05-23');
    });

    it('should handle Excel serial numbers', () => {
      // 45435 is 2024-05-23 in Excel serial
      expect(normalizeDate(45435)).toBe('2024-05-23');
    });

    it('should return empty string for invalid dates', () => {
      expect(normalizeDate('invalid')).toBe('');
    });
  });

  describe('parseHistoryRows', () => {
    it('should map FR headers to internal keys', () => {
      const rows = [
        {
          'ID Actif': 'asset_1',
          Nom: 'Mon Actif',
          'Date (AAAA-MM-JJ)': '2024-01-01',
          Montant: 1000.5,
          Type: 'savings',
          Propriétaire: 'Nicolas',
          Source: 'manual',
        },
      ];

      const parsed = parseHistoryRows(rows);
      expect(parsed).toHaveLength(1);
      expect(parsed[0]).toEqual({
        assetId: 'asset_1',
        nom: 'Mon Actif',
        date: '2024-01-01',
        montant: 1000.5,
        type: 'savings',
        owner: 'Nicolas',
        source: 'manual',
        _errors: [],
      });
    });

    it('should be robust to case-mismatch and leading/trailing spaces in headers', () => {
      const rows = [
        {
          ' id actif ': 'asset_1',
          ' nom ': 'Mon Actif',
          'date (aaaa-mm-jj)': '2024-01-01',
          ' Montant ': ' 1000,5 ', // spaces around header and value
          ' type ': 'savings',
          ' propriétaire ': 'Nicolas',
        },
      ];

      const parsed = parseHistoryRows(rows);
      expect(parsed).toHaveLength(1);
      expect(parsed[0]!._errors).toHaveLength(0);
      expect(parsed[0]!.assetId).toBe('asset_1');
      expect(parsed[0]!.montant).toBe(1000.5);
    });

    it('should report errors for missing mandatory fields', () => {
      const rows = [{ 'ID Actif': '', 'Date (AAAA-MM-JJ)': 'invalid', Montant: 'abc' }];
      const parsed = parseHistoryRows(rows);
      expect(parsed[0]!._errors).toContain('ID Actif manquant');
      expect(parsed[0]!._errors).toContain('Date invalide ou manquante');
      expect(parsed[0]!._errors).toContain('Montant invalide');
    });
  });

  describe('round-trip (build -> parse)', () => {
    it('should preserve data after export and re-import', async () => {
      const originalEntries = [
        {
          assetId: 'asset_123',
          nom: 'Test Asset',
          date: '2024-05-01',
          montant: 1500.75,
          type: 'savings',
          owner: 'Nicolas',
          source: 'manual',
          id: 'doc_1',
        },
      ];

      // 1. Build workbook
      const wb = await buildHistoryWorkbook(originalEntries as any);

      // 2. Simulate reading it back
      const ws = wb.Sheets[wb.SheetNames[0]!];
      const rows = XLSX.utils.sheet_to_json(ws!);
      const imported = parseHistoryRows(rows);

      expect(imported).toHaveLength(1);
      expect(imported[0]!.assetId).toBe('asset_123');
      expect(imported[0]!.montant).toBe(1500.75);
      expect(imported[0]!.date).toBe('2024-05-01');
    });
  });
});
