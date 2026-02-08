import * as XLSX from 'xlsx';
import type { RawAnomaly } from '@/types';
import { resolveCanonicalName } from './columnAliases';

/**
 * Normalize a raw header string into a standardized key.
 */
function normalizeHeaderKey(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[()]/g, '')
    .replace(/%/g, 'percent')
    .replace(/['']/g, '')
    .replace(/[^\w]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Parse an XLSX file and return an array of raw anomaly objects.
 * Column headers are remapped to canonical names using the alias map.
 */
export async function parseXlsxFile(file: File): Promise<RawAnomaly[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        // Use first sheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
          defval: null,
        });

        // Build a header remap cache (original normalized -> canonical | original)
        const headerRemap = new Map<string, string>();

        // Normalize column names and remap to canonical names
        const normalized = jsonData.map((row) => {
          const normalizedRow: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(row)) {
            const normalizedKey = normalizeHeaderKey(key);

            // Look up from cache or resolve
            if (!headerRemap.has(normalizedKey)) {
              const canonical = resolveCanonicalName(normalizedKey);
              headerRemap.set(normalizedKey, canonical ?? normalizedKey);
            }

            const finalKey = headerRemap.get(normalizedKey)!;
            // If two vendor columns remap to the same canonical, keep the first non-null
            if (normalizedRow[finalKey] == null || normalizedRow[finalKey] === '') {
              normalizedRow[finalKey] = value;
            }
          }
          return normalizedRow as unknown as RawAnomaly;
        });

        resolve(normalized);
      } catch (error) {
        reject(new Error(`Failed to parse XLSX file: ${error}`));
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Get column headers from an XLSX file, normalized the same way as parseXlsxFile.
 */
export async function getXlsxHeaders(file: File): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
        const headers: string[] = [];

        for (let col = range.s.c; col <= range.e.c; col++) {
          const cell = worksheet[XLSX.utils.encode_cell({ r: range.s.r, c: col })];
          headers.push(cell ? normalizeHeaderKey(String(cell.v)) : `column_${col}`);
        }

        resolve(headers);
      } catch (error) {
        reject(new Error(`Failed to read headers: ${error}`));
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}
