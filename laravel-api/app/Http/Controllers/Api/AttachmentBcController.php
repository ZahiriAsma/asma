<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AttachmentBc;
use App\Models\BonLivraison;
use Illuminate\Http\Request;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;

class AttachmentBcController extends Controller
{
    public function index(Request $request)
    {
        $query = AttachmentBc::query();

        if ($request->has('bon_livraison_id')) {
            $query->where('bon_livraison_id', $request->bon_livraison_id);
        }

        return response()->json($query->orderBy('created_at', 'desc')->get());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'bon_livraison_id' => 'required|exists:bons_livraison,id',
            'numero_attachment' => 'required|integer',
            'marche_id' => 'nullable|exists:marches,id',
            'date_attachment' => 'nullable|date',
            'budget' => 'nullable|string',
            'exercice' => 'nullable|integer',
            'rubrique' => 'nullable|string',
            'reference_marche' => 'nullable|string',
            'lieu_livraison' => 'nullable|string',
            'items' => 'nullable|array'
        ]);

        $attachment = AttachmentBc::create($validated);
        return response()->json($attachment, 201);
    }

    public function update(Request $request, $id)
    {
        $attachment = AttachmentBc::findOrFail($id);

        $validated = $request->validate([
            'bon_livraison_id' => 'nullable|exists:bons_livraison,id',
            'numero_attachment' => 'nullable|integer',
            'marche_id' => 'nullable|exists:marches,id',
            'date_attachment' => 'nullable|date',
            'budget' => 'nullable|string',
            'exercice' => 'nullable|integer',
            'rubrique' => 'nullable|string',
            'reference_marche' => 'nullable|string',
            'lieu_livraison' => 'nullable|string',
            'items' => 'nullable|array'
        ]);

        $attachment->update($validated);
        return response()->json($attachment);
    }

    public function destroy($id)
    {
        $attachment = AttachmentBc::findOrFail($id);
        $attachment->delete();
        return response()->json(['message' => 'Attachment supprimé avec succès']);
    }

    public function export($id)
    {
        $attachment = AttachmentBc::findOrFail($id);

        if (!$attachment) {
            return response()->json(['error' => 'Aucun attachement trouvé.'], 404);
        }

        $items = is_string($attachment->items) ? json_decode($attachment->items, true) : ($attachment->items ?? []);

        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Attachement');

        // Page setup & gridlines
        $sheet->setShowGridlines(true);
        $sheet->getPageSetup()->setOrientation(\PhpOffice\PhpSpreadsheet\Worksheet\PageSetup::ORIENTATION_PORTRAIT);
        $sheet->getPageSetup()->setPaperSize(\PhpOffice\PhpSpreadsheet\Worksheet\PageSetup::PAPERSIZE_A4);
        $sheet->getPageSetup()->setFitToWidth(1);
        $sheet->getPageSetup()->setFitToHeight(0);

        // Column widths - N°, DESIGNATIONS ET REFERENCES, UNITE, QTE, Taux TVA
        $sheet->getColumnDimension('A')->setWidth(6);   // N°
        $sheet->getColumnDimension('B')->setWidth(50);  // DESIGNATIONS
        $sheet->getColumnDimension('C')->setWidth(15);  // UNITE
        $sheet->getColumnDimension('D')->setWidth(15);  // QTE
        $sheet->getColumnDimension('E')->setWidth(15);  // Taux TVA

        // Default Font
        $sheet->getStyle('A1:E200')->getFont()->setName('Arial')->setSize(10);

        // --- Left Header Block ---
        $sheet->setCellValue('A1', 'OFFICE DE LA FORMATION PROFESSIONNELLE');
        $sheet->setCellValue('A2', 'ET DE LA PROMOTION DU TRAVAIL');
        $sheet->setCellValue('A3', 'Direction Régionale Draa Tafilalet');
        $sheet->setCellValue('A4', 'ISBTP QUARTIER EL MATAR');
        $sheet->setCellValue('A5', 'ERRACHIDIA');
        $sheet->setCellValue('A6', 'Tél : 0535572740');
        
        $sheet->getStyle('A1:A2')->getFont()->setBold(true)->setSize(9);
        $sheet->getStyle('A3:A6')->getFont()->setBold(true)->setSize(8);
        $sheet->getStyle('A1:A6')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->mergeCells('A1:B1');
        $sheet->mergeCells('A2:B2');
        $sheet->mergeCells('A3:B3');
        $sheet->mergeCells('A4:B4');
        $sheet->mergeCells('A5:B5');
        $sheet->mergeCells('A6:B6');

        // --- Right Header Block (Date) ---
        $dateAttachment = $attachment->date_attachment ? date('d/m/Y', strtotime($attachment->date_attachment)) : date('d/m/Y');
        $sheet->setCellValue('D1', 'Errachidia, le ' . $dateAttachment);
        $sheet->getStyle('D1')->getFont()->setSize(9);
        $sheet->getStyle('D1')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
        $sheet->mergeCells('D1:E1');

        // Extract header data
        $num_att = $attachment->numero_attachment ?? '';
        $budget = $attachment->budget ?? 'BF';
        $exercice = $attachment->exercice ?? date('Y');
        $rubrique = $attachment->rubrique ?? 'ACHAT PRODUITS ALIMENTAIRES';
        $ref_marche = $attachment->reference_marche ?? 'N° 07-Z-2024';
        $lieu_livraison = $attachment->lieu_livraison ?? 'Ouarzazate';

        // --- Title Block ---
        $sheet->setCellValue('C3', 'ATTACHEMENT N° : ' . $num_att . '/' . $exercice);
        $sheet->getStyle('C3')->getFont()->setBold(true)->setSize(11);
        $sheet->getStyle('C3')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->mergeCells('C3:E3');

        // --- Right Info Box ---
        $infoStartRow = 5;
        
        $sheet->setCellValue('C' . $infoStartRow, 'BUDGET');
        $sheet->setCellValue('D' . $infoStartRow, $budget);
        $sheet->mergeCells('D' . $infoStartRow . ':E' . $infoStartRow);

        $sheet->setCellValue('C' . ($infoStartRow + 1), 'EXERCICE');
        $sheet->setCellValue('D' . ($infoStartRow + 1), $exercice);
        $sheet->mergeCells('D' . ($infoStartRow + 1) . ':E' . ($infoStartRow + 1));

        $sheet->setCellValue('C' . ($infoStartRow + 2), 'Rubrique');
        $sheet->setCellValue('D' . ($infoStartRow + 2), $rubrique);
        $sheet->mergeCells('D' . ($infoStartRow + 2) . ':E' . ($infoStartRow + 2));

        $sheet->setCellValue('C' . ($infoStartRow + 3), 'Réf MARCHE CADRE');
        $sheet->setCellValue('D' . ($infoStartRow + 3), $ref_marche);
        $sheet->mergeCells('D' . ($infoStartRow + 3) . ':E' . ($infoStartRow + 3));

        $sheet->setCellValue('C' . ($infoStartRow + 4), 'LIEU DE LIVRAISON');
        $sheet->setCellValue('D' . ($infoStartRow + 4), $lieu_livraison);
        $sheet->mergeCells('D' . ($infoStartRow + 4) . ':E' . ($infoStartRow + 4));

        $infoBoxRange = 'C' . $infoStartRow . ':E' . ($infoStartRow + 4);
        $sheet->getStyle($infoBoxRange)->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
        $sheet->getStyle('C' . $infoStartRow . ':C' . ($infoStartRow + 4))->getFont()->setSize(9);
        $sheet->getStyle('D' . $infoStartRow . ':D' . ($infoStartRow + 4))->getFont()->setSize(9);

        // Big outer border around header
        $sheet->getStyle('A1:E10')->getBorders()->getOutline()->setBorderStyle(Border::BORDER_THICK);

        // --- Items Table Headers (Row 12) ---
        $sheet->setCellValue('A12', 'N°');
        $sheet->setCellValue('B12', 'DESIGNATIONS ET REFERENCES');
        $sheet->setCellValue('C12', 'UNITE');
        $sheet->setCellValue('D12', 'QTE INITIALE');
        $sheet->setCellValue('E12', 'QTE CONSOMMEE');

        $sheet->getStyle('A12:E12')->getFont()->setBold(true)->setSize(9);
        $sheet->getStyle('A12:E12')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->getStyle('A12:E12')->getAlignment()->setVertical(Alignment::VERTICAL_CENTER);
        $sheet->getStyle('A12:E12')->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
        $sheet->getRowDimension('12')->setRowHeight(25);

        // --- Items Data Rows ---
        $currentRow = 13;
        foreach ($items as $item) {
            $sheet->setCellValue('A' . $currentRow, $item['numero_article'] ?? $item['price_number'] ?? '');
            $sheet->setCellValue('B' . $currentRow, $item['designation'] ?? $item['service_description'] ?? '');
            $sheet->setCellValue('C' . $currentRow, $item['unite'] ?? $item['unit_of_measure'] ?? 'U');
            $sheet->setCellValue('D' . $currentRow, $item['quantite_initiale'] ?? 0);
            
            $sheet->setCellValue('E' . $currentRow, $item['quantite'] ?? $item['qty'] ?? 1);

            // Alignments
            $sheet->getStyle('A' . $currentRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
            $sheet->getStyle('B' . $currentRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT);
            $sheet->getStyle('C' . $currentRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
            $sheet->getStyle('D' . $currentRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
            $sheet->getStyle('E' . $currentRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

            // Borders
            $sheet->getStyle('A' . $currentRow . ':E' . $currentRow)->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
            
            $sheet->getRowDimension($currentRow)->setRowHeight(20);
            $currentRow++;
        }

        // --- Signatures Block ---
        $signatureRow = $currentRow + 2;
        $sheet->setCellValue('A' . $signatureRow, 'Signature du Fournisseur');
        $sheet->getStyle('A' . $signatureRow)->getFont()->setUnderline(true)->setBold(true)->setSize(9);

        $sheet->setCellValue('D' . $signatureRow, 'Signature du Sous ordonnateur');
        $sheet->getStyle('D' . $signatureRow)->getFont()->setUnderline(true)->setBold(true)->setSize(9);
        $sheet->mergeCells('D' . $signatureRow . ':E' . $signatureRow);

        // Outer border for the whole document content?
        $sheet->getStyle('A12:E' . ($currentRow - 1))->getBorders()->getOutline()->setBorderStyle(Border::BORDER_THICK);

        $writer = new Xlsx($spreadsheet);
        $filename = 'Attachement_' . ($attachment->numero_attachment ?? $attachment->id) . '_' . ($attachment->exercice ?? date('Y')) . '.xlsx';

        return response()->streamDownload(function () use ($writer) {
            $writer->save('php://output');
        }, $filename, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Cache-Control' => 'max-age=0',
        ]);
    }
}
