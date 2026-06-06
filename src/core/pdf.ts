import { existsSync, mkdirSync } from "fs";
import { join } from "path";

export const PDF_DIR = "./files/pdf";
mkdirSync(PDF_DIR, { recursive: true });

export function getPdfPath(uuid: string): string | null {
    const pdfPath = join(PDF_DIR, `${uuid}.pdf`);
    return existsSync(pdfPath) ? pdfPath : null;
}
