<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Stock;
use App\Models\TechnicalSheet;
use App\Models\BonLivraison;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;

class StockController extends Controller
{
    /**
     * Compute total consumed quantity for a product designation (case-insensitive).
     */
    private function computeConsumed(string $designation): float
    {
        return (float) TechnicalSheet::join('bordereau', 'technical_sheets.bordereau_id', '=', 'bordereau.id')
            ->where('technical_sheets.statut', 'Validé')
            ->whereRaw('LOWER(TRIM(bordereau.service_description)) = LOWER(TRIM(?))', [$designation])
            ->sum('technical_sheets.calculated_quantity');
    }

    private function computeConsumedForPeriod(string $designation, string $startDate, string $endDate): float
    {
        return (float) TechnicalSheet::join('bordereau', 'technical_sheets.bordereau_id', '=', 'bordereau.id')
            ->where('technical_sheets.statut', 'Validé')
            ->whereRaw('LOWER(TRIM(bordereau.service_description)) = LOWER(TRIM(?))', [$designation])
            ->whereBetween('technical_sheets.date', [$startDate, $endDate])
            ->sum('technical_sheets.calculated_quantity');
    }

    private function computeStatus(float $remaining, float $available): string
    {
        if ($remaining <= 0) {
            return 'Rupture de Stock';
        }
        if ($available > 0 && ($remaining / $available) <= 0.15) {
            return 'Stock Faible';
        }
        return 'En Stock';
    }

    /**
     * Synchronize products from Validated BLs to ensure they exist in the Stock table.
     * Also returns the aggregated quantities from BLs to be added to quantite_initiale.
     */
    private function getDynamicBLQuantitiesAndSyncProducts(): array
    {
        $bls = BonLivraison::where('statut', 'Validé')->get();
        $blQuantities = [];

        foreach ($bls as $bl) {
            $items = $bl->items ?? [];
            foreach ($items as $item) {
                $designation = trim($item['service_description'] ?? ($item['designation'] ?? ($item['label'] ?? '')));
                $unite = trim($item['unit_of_measure'] ?? ($item['unit'] ?? 'Unité'));
                $qty = (float)($item['qty'] ?? ($item['quantity'] ?? 0));
                $ref = isset($item['price_number']) ? trim((string)$item['price_number']) : null;

                if (empty($designation)) continue;

                $key = strtolower($designation);
                if (!isset($blQuantities[$key])) {
                    $blQuantities[$key] = [
                        'designation' => $designation,
                        'unite' => $unite,
                        'qty' => 0,
                        'reference' => $ref,
                        'last_date' => $bl->date_bl
                    ];
                }
                
                $blQuantities[$key]['qty'] += $qty;
                if ($bl->date_bl > $blQuantities[$key]['last_date']) {
                    $blQuantities[$key]['last_date'] = $bl->date_bl;
                }
                if (empty($blQuantities[$key]['reference']) && !empty($ref)) {
                    $blQuantities[$key]['reference'] = $ref;
                }
            }
        }

        // Ensure all products from validated BLs exist in the stocks table
        foreach ($blQuantities as $key => $data) {
            // Search priority:
            // 1. By designation (case-insensitive)
            $stock = Stock::whereRaw('LOWER(TRIM(designation)) = ?', [$key])->first();

            // 2. By reference if available
            if (!$stock && !empty($data['reference'])) {
                $stock = Stock::where('reference', $data['reference'])->first();
            }

            // 3. Fallback: Search bordereau reference if reference was empty
            $reference = $data['reference'];
            if (empty($reference)) {
                $bordereauItem = \App\Models\Bordereau::whereRaw('LOWER(TRIM(service_description)) = ?', [$key])->first();
                if ($bordereauItem) {
                    $reference = $bordereauItem->price_number;
                }
            }

            if (!$stock) {
                Stock::create([
                    'reference' => $reference,
                    'designation' => $data['designation'],
                    'unite' => $data['unite'],
                    'quantite_initiale' => 0,
                    'last_entry_date' => $data['last_date']
                ]);
            } else {
                // Update properties if empty
                $updated = false;
                if (empty($stock->reference) && !empty($reference)) {
                    $stock->reference = $reference;
                    $updated = true;
                }
                if (empty($stock->unite) && !empty($data['unite'])) {
                    $stock->unite = $data['unite'];
                    $updated = true;
                }
                if (empty($stock->last_entry_date) || $stock->last_entry_date < $data['last_date']) {
                    $stock->last_entry_date = $data['last_date'];
                    $updated = true;
                }
                if ($updated) {
                    $stock->save();
                }
            }
        }

        return $blQuantities;
    }

    public function index()
    {
        // 1. Sync products & get dynamic BL quantities
        $blQuantities = $this->getDynamicBLQuantitiesAndSyncProducts();

        // 2. Map all stocks and calculate dynamically
        $stocks = Stock::orderBy('designation', 'asc')->get()->map(function ($stock) use ($blQuantities) {
            $key = strtolower(trim($stock->designation));
            $qty_bl = $blQuantities[$key]['qty'] ?? 0;

            // Formule :
            // Disponible = Stock Initial (quantite_initiale) + Reçu (from Validated BLs)
            // Consommé = computeConsumed
            // Restant = Disponible - Consommé
            $available  = round((float) $stock->quantite_initiale + $qty_bl, 3);
            $consumed   = round($this->computeConsumed($stock->designation), 3);
            $remaining  = round($available - $consumed, 3);

            $stock->quantite_recue       = $qty_bl;
            $stock->quantite_disponible = $available;
            $stock->quantite_consommee  = $consumed;
            $stock->quantite_restante   = $remaining;
            $stock->statut              = $this->computeStatus($remaining, $available);

            return $stock;
        })->filter(function ($stock) {
            return $stock->quantite_disponible > 0;
        })->values();

        return response()->json($stocks);
    }

    public function importInitial(Request $request)
    {
        $validated = $request->validate([
            'items' => 'required|array',
            'items.*.designation' => 'required|string',
            'items.*.reference' => 'nullable|string',
            'items.*.unite' => 'nullable|string',
            'items.*.quantite' => 'required|numeric|min:0',
        ]);

        $items = $validated['items'];

        DB::beginTransaction();
        try {
            foreach ($items as $item) {
                $designation = trim($item['designation']);
                $unite = trim($item['unite'] ?? 'Unité');
                $qty = (float) $item['quantite'];
                $ref = isset($item['reference']) ? trim((string)$item['reference']) : null;

                $key = strtolower($designation);

                // Search priority:
                // 1. By reference in stocks (if reference is provided)
                $stock = null;
                if (!empty($ref)) {
                    $stock = Stock::where('reference', $ref)->first();
                }

                // 2. By designation (case-insensitive)
                if (!$stock) {
                    $stock = Stock::whereRaw('LOWER(TRIM(designation)) = ?', [$key])->first();
                }

                // 3. Fallback: check bordereau price_number (reference)
                $reference = $ref;
                if (empty($reference)) {
                    $bordereauItem = \App\Models\Bordereau::whereRaw('LOWER(TRIM(service_description)) = ?', [$key])->first();
                    if ($bordereauItem) {
                        $reference = $bordereauItem->price_number;
                    }
                }

                if ($stock) {
                    // Update existing (add imported quantity to existing initial quantity)
                    $stock->quantite_initiale += $qty;
                    if (empty($stock->reference) && !empty($reference)) {
                        $stock->reference = $reference;
                    }
                    if (empty($stock->unite) && !empty($unite)) {
                        $stock->unite = $unite;
                    }
                    $stock->save();
                } else {
                    // Create new
                    Stock::create([
                        'reference' => $reference,
                        'designation' => $designation,
                        'unite' => $unite,
                        'quantite_initiale' => $qty,
                    ]);
                }
            }

            DB::commit();
            return response()->json(['message' => 'Stock initial importé et fusionné avec succès.']);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'error' => "Une erreur s'est produite lors de l'importation.",
                'details' => $e->getMessage()
            ], 500);
        }
    }

    public function export(Request $request)
    {
        $startDate = $request->query('start_date', '2000-01-01');
        $endDate   = $request->query('end_date', date('Y-m-d'));

        $blQuantities = $this->getDynamicBLQuantitiesAndSyncProducts();

        $stocks = Stock::orderBy('designation', 'asc')->get()->map(function ($stock) use ($startDate, $endDate, $blQuantities) {
            $key = strtolower(trim($stock->designation));
            $qty_bl = $blQuantities[$key]['qty'] ?? 0;

            $available = round((float) $stock->quantite_initiale + $qty_bl, 3);
            $consumed  = round($this->computeConsumedForPeriod($stock->designation, $startDate, $endDate), 3);
            $remaining = round($available - $consumed, 3);

            $stock->quantite_recue       = $qty_bl;
            $stock->quantite_disponible = $available;
            $stock->quantite_consommee  = $consumed;
            $stock->quantite_restante   = $remaining;
            $stock->statut              = $this->computeStatus($remaining, $available);

            return $stock;
        })->filter(function ($stock) {
            return $stock->quantite_disponible > 0;
        })->values();

        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Inventaire du Stock');

        $sheet->setShowGridlines(true);
        $sheet->getPageSetup()->setOrientation(\PhpOffice\PhpSpreadsheet\Worksheet\PageSetup::ORIENTATION_LANDSCAPE);
        $sheet->getPageSetup()->setPaperSize(\PhpOffice\PhpSpreadsheet\Worksheet\PageSetup::PAPERSIZE_A4);
        $sheet->getPageSetup()->setFitToWidth(1);

        $sheet->getColumnDimension('A')->setWidth(40); // Désignation
        $sheet->getColumnDimension('B')->setWidth(15); // Référence
        $sheet->getColumnDimension('C')->setWidth(10); // Unité
        $sheet->getColumnDimension('D')->setWidth(15); // Qté Initiale
        $sheet->getColumnDimension('E')->setWidth(15); // Qté Reçue
        $sheet->getColumnDimension('F')->setWidth(15); // Qté Disponible
        $sheet->getColumnDimension('G')->setWidth(15); // Qté Consommée
        $sheet->getColumnDimension('H')->setWidth(15); // Qté Restante
        $sheet->getColumnDimension('I')->setWidth(18); // Statut

        $sheet->setCellValue('A1', 'ÉTAT DU STOCK / INVENTAIRE');
        $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(16);
        $sheet->getStyle('A1')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->mergeCells('A1:I1');

        $sheet->setCellValue('A2', 'Période du ' . date('d/m/Y', strtotime($startDate)) . ' au ' . date('d/m/Y', strtotime($endDate)));
        $sheet->getStyle('A2')->getFont()->setItalic(true)->setSize(12);
        $sheet->getStyle('A2')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->mergeCells('A2:I2');

        $sheet->setCellValue('A3', 'Généré le : ' . date('d/m/Y à H:i'));
        $sheet->getStyle('A3')->getFont()->setItalic(true)->setSize(10)->getColor()->setARGB('FF64748B');
        $sheet->getStyle('A3')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
        $sheet->mergeCells('A3:I3');

        $headers = [
            'A5' => 'Désignation Produit',
            'B5' => 'Référence',
            'C5' => 'Unité',
            'D5' => 'Qté Initiale',
            'E5' => 'Qté Reçue (BL)',
            'F5' => 'Qté Disponible',
            'G5' => 'Qté Consommée (Fiches Tech.)',
            'H5' => 'Qté Restante',
            'I5' => 'Statut',
        ];
        foreach ($headers as $cell => $value) {
            $sheet->setCellValue($cell, $value);
        }

        $headerStyle = $sheet->getStyle('A5:I5');
        $headerStyle->getFont()->setBold(true)->setSize(11)->getColor()->setARGB('FFFFFFFF');
        $headerStyle->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FF0F766E');
        $headerStyle->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $headerStyle->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);

        $currentRow = 6;
        foreach ($stocks as $index => $stock) {
            $isEven = ($index % 2 === 0);

            $sheet->setCellValue('A' . $currentRow, $stock->designation);
            $sheet->setCellValue('B' . $currentRow, $stock->reference ?: '—');
            $sheet->setCellValue('C' . $currentRow, $stock->unite);
            $sheet->setCellValue('D' . $currentRow, $stock->quantite_initiale);
            $sheet->setCellValue('E' . $currentRow, $stock->quantite_recue);
            $sheet->setCellValue('F' . $currentRow, $stock->quantite_disponible);
            $sheet->setCellValue('G' . $currentRow, $stock->quantite_consommee);
            $sheet->setCellValue('H' . $currentRow, $stock->quantite_restante);
            $sheet->setCellValue('I' . $currentRow, $stock->statut);

            $sheet->getStyle('A' . $currentRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT);
            $sheet->getStyle('B' . $currentRow . ':I' . $currentRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
            $sheet->getStyle('A' . $currentRow . ':I' . $currentRow)->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);

            $rowBg = $isEven ? 'FFF8FAFC' : 'FFFFFFFF';
            $sheet->getStyle('A' . $currentRow . ':I' . $currentRow)->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB($rowBg);

            if ($stock->quantite_restante <= 0) {
                $sheet->getStyle('H' . $currentRow . ':I' . $currentRow)->getFont()->getColor()->setARGB('FFDC2626');
                $sheet->getStyle('H' . $currentRow . ':I' . $currentRow)->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FFFEE2E2');
            } elseif ($stock->statut === 'Stock Faible') {
                $sheet->getStyle('H' . $currentRow . ':I' . $currentRow)->getFont()->getColor()->setARGB('FFD97706');
                $sheet->getStyle('H' . $currentRow . ':I' . $currentRow)->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FFFEF3C7');
            } else {
                $sheet->getStyle('I' . $currentRow)->getFont()->getColor()->setARGB('FF16A34A');
            }

            $sheet->getRowDimension($currentRow)->setRowHeight(20);
            $currentRow++;
        }

        $totalsRow = $currentRow;
        $sheet->setCellValue('A' . $totalsRow, 'TOTAUX');
        $sheet->setCellValue('D' . $totalsRow, '=SUM(D6:D' . ($totalsRow - 1) . ')');
        $sheet->setCellValue('E' . $totalsRow, '=SUM(E6:E' . ($totalsRow - 1) . ')');
        $sheet->setCellValue('F' . $totalsRow, '=SUM(F6:F' . ($totalsRow - 1) . ')');
        $sheet->setCellValue('G' . $totalsRow, '=SUM(G6:G' . ($totalsRow - 1) . ')');
        $sheet->setCellValue('H' . $totalsRow, '=SUM(H6:H' . ($totalsRow - 1) . ')');
        $sheet->getStyle('A' . $totalsRow . ':I' . $totalsRow)->getFont()->setBold(true)->setSize(11);
        $sheet->getStyle('A' . $totalsRow . ':I' . $totalsRow)->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FFE2E8F0');
        $sheet->getStyle('A' . $totalsRow . ':I' . $totalsRow)->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_MEDIUM);
        $sheet->getStyle('D' . $totalsRow . ':H' . $totalsRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

        $writer   = new Xlsx($spreadsheet);
        $filename = 'Inventaire_Stock_' . date('Y_m_d') . '.xlsx';

        return response()->streamDownload(function () use ($writer) {
            $writer->save('php://output');
        }, $filename, [
            'Content-Type'  => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Cache-Control' => 'max-age=0',
        ]);
    }
}
