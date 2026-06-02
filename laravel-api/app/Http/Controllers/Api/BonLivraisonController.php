<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BonLivraison;
use Illuminate\Http\Request;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;

class BonLivraisonController extends Controller
{
    public function index(Request $request)
    {
        $query = BonLivraison::with('fournisseurModel')->orderBy('created_at', 'desc');
        if ($request->has('marche_id')) {
            $query->where('marche_id', $request->query('marche_id'));
        }
        return response()->json($query->get());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'numero_bl' => 'required|string|unique:bons_livraison,numero_bl',
            'date_bl' => 'required|date',
            'fournisseur' => 'nullable|string',
            'fournisseur_id' => 'nullable|exists:fournisseurs,id',
            'reference_bc' => 'nullable|string',
            'client' => 'nullable|string',
            'total_ht' => 'nullable|numeric',
            'total_tva' => 'nullable|numeric',
            'total_ttc' => 'nullable|numeric',
            'items' => 'nullable|array',
            'marche_id' => 'nullable|exists:marches,id',
            'statut' => 'nullable|string'
        ]);

        $this->validateBcUniqueness($request->input('reference_bc'));

        // Secure automatic totals computation if not fully calculated on client-side
        if (!isset($validated['total_ht']) && is_array($request->input('items'))) {
            $ht = 0;
            $tva = 0;
            foreach ($request->input('items') as $item) {
                $qty = (float)($item['qty'] ?? ($item['quantity'] ?? 0));
                $pu = (float)($item['unit_price_ht'] ?? ($item['price'] ?? ($item['unit_price'] ?? ($item['pu'] ?? 0))));
                $rate = (float)($item['vat_rate'] ?? 20);
                $lineHt = $qty * $pu;
                $ht += $lineHt;
                $tva += $lineHt * ($rate / 100);
            }
            $validated['total_ht'] = $ht;
            $validated['total_tva'] = $tva;
            $validated['total_ttc'] = $ht + $tva;
        }

        $bonLivraison = BonLivraison::create($validated);
        $this->processStock($bonLivraison);

        return response()->json($bonLivraison->load('fournisseurModel'), 201);
    }

    public function show($id)
    {
        $bonLivraison = BonLivraison::with('fournisseurModel')->findOrFail($id);
        return response()->json($bonLivraison);
    }

    public function update(Request $request, $id)
    {
        $bonLivraison = BonLivraison::findOrFail($id);

        $validated = $request->validate([
            'numero_bl' => 'required|string|unique:bons_livraison,numero_bl,' . $id,
            'date_bl' => 'required|date',
            'fournisseur' => 'nullable|string',
            'fournisseur_id' => 'nullable|exists:fournisseurs,id',
            'reference_bc' => 'nullable|string',
            'client' => 'nullable|string',
            'total_ht' => 'nullable|numeric',
            'total_tva' => 'nullable|numeric',
            'total_ttc' => 'nullable|numeric',
            'items' => 'nullable|array',
            'marche_id' => 'nullable|exists:marches,id',
            'statut' => 'nullable|string'
        ]);

        $this->validateBcUniqueness($request->input('reference_bc'), $id);

        if (!isset($validated['total_ht']) && is_array($request->input('items'))) {
            $ht = 0;
            $tva = 0;
            foreach ($request->input('items') as $item) {
                $qty = (float)($item['qty'] ?? ($item['quantity'] ?? 0));
                $pu = (float)($item['unit_price_ht'] ?? ($item['price'] ?? ($item['unit_price'] ?? ($item['pu'] ?? 0))));
                $rate = (float)($item['vat_rate'] ?? 20);
                $lineHt = $qty * $pu;
                $ht += $lineHt;
                $tva += $lineHt * ($rate / 100);
            }
            $validated['total_ht'] = $ht;
            $validated['total_tva'] = $tva;
            $validated['total_ttc'] = $ht + $tva;
        }

        $bonLivraison->update($validated);
        $this->processStock($bonLivraison);

        return response()->json($bonLivraison->load('fournisseurModel'));
    }

    public function destroy($id)
    {
        $bonLivraison = BonLivraison::findOrFail($id);
        $bonLivraison->delete();
        return response()->json(['message' => 'Bon de livraison supprimé avec succès']);
    }

    public function export($id)
    {
        $bl = BonLivraison::with('fournisseurModel')->findOrFail($id);
        $items = $bl->items ?? [];

        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Bon de Livraison');

        // Page setup & gridlines
        $sheet->setShowGridlines(true);
        $sheet->getPageSetup()->setOrientation(\PhpOffice\PhpSpreadsheet\Worksheet\PageSetup::ORIENTATION_PORTRAIT);
        $sheet->getPageSetup()->setPaperSize(\PhpOffice\PhpSpreadsheet\Worksheet\PageSetup::PAPERSIZE_A4);
        $sheet->getPageSetup()->setFitToWidth(1);
        $sheet->getPageSetup()->setFitToHeight(0);

        // Column widths - N°, Désignations et références, Unité, Qté, PU HT, Taux TVA, TVA, Total HT
        $sheet->getColumnDimension('A')->setWidth(5);   // N°
        $sheet->getColumnDimension('B')->setWidth(40);  // Désignations et références
        $sheet->getColumnDimension('C')->setWidth(8);   // UNIT/B
        $sheet->getColumnDimension('D')->setWidth(8);   // QTE
        $sheet->getColumnDimension('E')->setWidth(10);  // P.U HT
        $sheet->getColumnDimension('F')->setWidth(8);   // Taux TVA
        $sheet->getColumnDimension('G')->setWidth(10);  // TVA
        $sheet->getColumnDimension('H')->setWidth(12);  // TOTAL HT

        // Default Font
        $sheet->getStyle('A1:H200')->getFont()->setName('Arial')->setSize(10);

        // --- Header Block ---
        $fourn = $bl->fournisseurModel;
        $nomSte = $fourn->raisonSociale ?? 'SIHAMID TRAV SARL AU';
        $adresse = $fourn->adresse ?? 'BLOC 23 N°87 AIT BAMOUHA ERRACHIDIA';
        $rc = $fourn->rc ?? '12253';
        $patente = $fourn->patente ?? '19200273';
        $cnss = $fourn->cnss ?? '5793387';
        $if = $fourn->if ?? '25090312';
        $ice = $fourn->ice ?? '002031857000054';
        $rib = $fourn->rib ?? '007 210 000 770 900 000 021 657';
        $bank = $fourn->bank ?? 'ATTIJARIWAFA Bank ERRACHIDIA';

        $sheet->mergeCells('A1:H1');
        $sheet->setCellValue('A1', 'STE ' . $nomSte);
        $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(16);
        $sheet->getStyle('A1')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

        $sheet->mergeCells('A2:H2');
        $sheet->setCellValue('A2', $adresse . '. RC ' . $rc . ' ERRACHIDIA');
        $sheet->getStyle('A2')->getFont()->setSize(10);
        $sheet->getStyle('A2')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

        $sheet->mergeCells('A3:H3');
        $sheet->setCellValue('A3', 'PATENTE :' . $patente . '-CNSS : ' . $cnss . '-IF : ' . $if . '-ICE : ' . $ice);
        $sheet->getStyle('A3')->getFont()->setSize(10);
        $sheet->getStyle('A3')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

        $sheet->mergeCells('A4:H4');
        $sheet->setCellValue('A4', '(RIB) : ' . $rib . ' à ' . $bank);
        $sheet->getStyle('A4')->getFont()->setSize(10);
        $sheet->getStyle('A4')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

        // --- Title Block ---
        $sheet->setCellValue('A6', ' BON DE LIVRAISON N° : ' . ($bl->numero_bl ?: ''));
        $sheet->getStyle('A6')->getFont()->setBold(true)->setSize(14);
        $sheet->mergeCells('A6:E6');
        $sheet->getStyle('A6:E6')->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_MEDIUM);

        // --- Client Block ---
        $sheet->setCellValue('A8', 'CLIENT: ' . ($bl->client ?: 'OFPPT / ISTA OUARZAZATE'));
        $sheet->getStyle('A8')->getFont()->setBold(true);

        $sheet->setCellValue('A9', 'Date : ' . date('d/m/Y', strtotime($bl->date_bl)));
        
        $sheet->setCellValue('G9', 'réf : ' . ($bl->reference_bc ?: 'BON DE COMMANDE N° PA 43/2025'));
        $sheet->getStyle('G9')->getFont()->setUnderline(true);
        $sheet->mergeCells('G9:H9');

        $sheet->setCellValue('A10', 'Site delivraison : ISTA OUARZAZATE');
        $sheet->setCellValue('A11', 'ICE CLIENT 00 1674314000081');

        $sheet->getStyle('A8:A11')->getFont()->setSize(10);

        // --- Items Table Headers (Row 13) ---
        $sheet->setCellValue('A13', 'N°');
        $sheet->setCellValue('B13', 'DESIGNATIONS ET REFERENCES');
        $sheet->setCellValue('C13', 'UNIT/B');
        $sheet->setCellValue('D13', 'QTE');
        $sheet->setCellValue('E13', 'P.U HT');
        $sheet->setCellValue('F13', 'Taux TVA');
        $sheet->setCellValue('G13', 'TVA');
        $sheet->setCellValue('H13', 'TOTAL HT');

        $sheet->getStyle('A13:H13')->getFont()->setBold(true)->setSize(9);
        $sheet->getStyle('A13:H13')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->getStyle('A13:H13')->getAlignment()->setVertical(Alignment::VERTICAL_CENTER);
        $sheet->getStyle('A13:H13')->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FFDDDDDD');
        $sheet->getStyle('A13:H13')->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
        $sheet->getRowDimension('13')->setRowHeight(25);

        // --- Items Data Rows ---
        $currentRow = 14;
        foreach ($items as $item) {
            $qty = (float)($item['qty'] ?? ($item['quantity'] ?? 0));
            $pu = (float)($item['unit_price_ht'] ?? ($item['price'] ?? ($item['unit_price'] ?? ($item['pu'] ?? 0))));
            $vatRate = (float)(isset($item['vat_rate']) ? $item['vat_rate'] : 0);
            
            $sheet->setCellValue('A' . $currentRow, $item['price_number'] ?? ($item['id'] ?? ''));
            $sheet->setCellValue('B' . $currentRow, $item['service_description'] ?? ($item['designation'] ?? ($item['label'] ?? '')));
            $sheet->setCellValue('C' . $currentRow, $item['unit_of_measure'] ?? ($item['unit'] ?? 'Unité'));
            $sheet->setCellValue('D' . $currentRow, $qty);
            $sheet->setCellValue('E' . $currentRow, $pu);
            $sheet->setCellValue('F' . $currentRow, $vatRate . '%');
            $sheet->setCellValue('G' . $currentRow, '=D' . $currentRow . '*E' . $currentRow . '*(' . $vatRate . '/100)');
            $sheet->setCellValue('H' . $currentRow, '=D' . $currentRow . '*E' . $currentRow);

            // Alignments
            $sheet->getStyle('A' . $currentRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
            $sheet->getStyle('B' . $currentRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT);
            $sheet->getStyle('C' . $currentRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
            $sheet->getStyle('D' . $currentRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
            $sheet->getStyle('E' . $currentRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
            $sheet->getStyle('F' . $currentRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
            $sheet->getStyle('G' . $currentRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
            $sheet->getStyle('H' . $currentRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);

            // Formats
            $sheet->getStyle('E' . $currentRow)->getNumberFormat()->setFormatCode('#,##0.00');
            $sheet->getStyle('G' . $currentRow)->getNumberFormat()->setFormatCode('#,##0.00');
            $sheet->getStyle('H' . $currentRow)->getNumberFormat()->setFormatCode('#,##0.00');

            // Borders
            $sheet->getStyle('A' . $currentRow . ':H' . $currentRow)->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
            
            $sheet->getRowDimension($currentRow)->setRowHeight(20);

            // Highlight VAT rate if > 0
            if ($vatRate > 0) {
                $sheet->getStyle('F' . $currentRow)->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FFFFFF00');
            }

            $currentRow++;
        }

        // --- Totals Block ---
        $lastDataRow = $currentRow - 1;
        $totalsStartRow = $currentRow;

        // Calculate exact TVA categories in PHP
        $tva9 = 0;
        $tva10 = 0;
        $tva20 = 0;
        foreach ($items as $item) {
            $qty = (float)($item['qty'] ?? ($item['quantity'] ?? 0));
            $pu = (float)($item['unit_price_ht'] ?? ($item['price'] ?? ($item['unit_price'] ?? ($item['pu'] ?? 0))));
            $vatRate = (float)(isset($item['vat_rate']) ? $item['vat_rate'] : 20);
            $lineHt = $qty * $pu;
            if ($vatRate == 9) {
                $tva9 += $lineHt * 0.09;
            } else if ($vatRate == 10) {
                $tva10 += $lineHt * 0.10;
            } else if ($vatRate == 20) {
                $tva20 += $lineHt * 0.20;
            }
        }

        // Total H.T
        $sheet->mergeCells('F' . $totalsStartRow . ':G' . $totalsStartRow);
        $sheet->setCellValue('F' . $totalsStartRow, 'TOTAL H.T');
        $sheet->setCellValue('H' . $totalsStartRow, '=SUM(H14:H' . $lastDataRow . ')');

        // TVA 9%
        $tva9Row = $totalsStartRow + 1;
        $sheet->mergeCells('F' . $tva9Row . ':G' . $tva9Row);
        $sheet->setCellValue('F' . $tva9Row, 'TVA 9 %');
        $sheet->setCellValue('H' . $tva9Row, $tva9);

        // TVA 10%
        $tva10Row = $totalsStartRow + 2;
        $sheet->mergeCells('F' . $tva10Row . ':G' . $tva10Row);
        $sheet->setCellValue('F' . $tva10Row, 'TVA 10 %');
        $sheet->setCellValue('H' . $tva10Row, $tva10);

        // TVA 20%
        $tva20Row = $totalsStartRow + 3;
        $sheet->mergeCells('F' . $tva20Row . ':G' . $tva20Row);
        $sheet->setCellValue('F' . $tva20Row, 'TVA 20 %');
        $sheet->setCellValue('H' . $tva20Row, $tva20);

        // Total T.T.C
        $ttcRow = $totalsStartRow + 4;
        $sheet->mergeCells('F' . $ttcRow . ':G' . $ttcRow);
        $sheet->setCellValue('F' . $ttcRow, 'TOTAL T.T.C');
        $sheet->setCellValue('H' . $ttcRow, '=H' . $totalsStartRow . '+H' . $tva9Row . '+H' . $tva10Row . '+H' . $tva20Row);

        // Format Totals Box
        $totalBoxRange = 'F' . $totalsStartRow . ':H' . $ttcRow;
        $sheet->getStyle($totalBoxRange)->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
        $sheet->getStyle($totalBoxRange)->getFont()->setBold(true)->setSize(9);
        
        $sheet->getStyle('H' . $totalsStartRow . ':H' . $ttcRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
        $sheet->getStyle('H' . $totalsStartRow . ':H' . $ttcRow)->getNumberFormat()->setFormatCode('#,##0.00');
        $sheet->getStyle('F' . $totalsStartRow . ':F' . $ttcRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

        $writer = new Xlsx($spreadsheet);
        $filename = 'Bon_de_Livraison_' . str_replace('/', '_', $bl->numero_bl) . '.xlsx';

        return response()->streamDownload(function () use ($writer) {
            $writer->save('php://output');
        }, $filename, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Cache-Control' => 'max-age=0',
        ]);
    }

    protected function processStock(BonLivraison $bl)
    {
        // Stock is now dynamically computed in StockController
        // to guarantee perfect real-time synchronization.
    }

    protected function validateBcUniqueness($referenceBc, $ignoreBlId = null)
    {
        if (!$referenceBc) return;
        
        $bcsToLink = array_filter(array_map('trim', explode(',', $referenceBc)));
        if (empty($bcsToLink)) return;

        $query = BonLivraison::whereNotNull('reference_bc');
        if ($ignoreBlId) {
            $query->where('id', '!=', $ignoreBlId);
        }
        
        $existingBls = $query->get(['reference_bc']);
        $usedBcs = [];
        foreach ($existingBls as $bl) {
            $bcs = array_filter(array_map('trim', explode(',', $bl->reference_bc)));
            $usedBcs = array_merge($usedBcs, $bcs);
        }
        
        $intersection = array_intersect($bcsToLink, $usedBcs);
        if (!empty($intersection)) {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'reference_bc' => 'Les Bons de Commande suivants sont déjà associés à un autre Bon de Livraison : ' . implode(', ', $intersection)
            ]);
        }
    }
}
