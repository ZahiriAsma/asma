<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Stock;
use App\Models\TechnicalSheet;
use App\Models\BonLivraison;
use Illuminate\Http\Request;
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
            ->whereRaw('LOWER(TRIM(bordereau.service_description)) = LOWER(TRIM(?))', [$designation])
            ->sum('technical_sheets.calculated_quantity');
    }

    private function computeConsumedForPeriod(string $designation, string $startDate, string $endDate): float
    {
        return (float) TechnicalSheet::join('bordereau', 'technical_sheets.bordereau_id', '=', 'bordereau.id')
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
        $bls = BonLivraison::all();
        $blQuantities = [];

        foreach ($bls as $bl) {
            $items = $bl->items ?? [];
            foreach ($items as $item) {
                $designation = trim($item['service_description'] ?? ($item['designation'] ?? ($item['label'] ?? '')));
                $unite = trim($item['unit_of_measure'] ?? ($item['unit'] ?? 'Unité'));
                $qty = (float)($item['qty'] ?? ($item['quantity'] ?? 0));

                if (empty($designation)) continue;

                $key = strtolower($designation);
                if (!isset($blQuantities[$key])) {
                    $blQuantities[$key] = [
                        'designation' => $designation,
                        'unite' => $unite,
                        'qty' => 0,
                        'last_date' => $bl->date_bl
                    ];
                }
                
                $blQuantities[$key]['qty'] += $qty;
                if ($bl->date_bl > $blQuantities[$key]['last_date']) {
                    $blQuantities[$key]['last_date'] = $bl->date_bl;
                }
            }
        }

        // Ensure all products from validated BLs exist in the stocks table
        foreach ($blQuantities as $key => $data) {
            $exists = Stock::whereRaw('LOWER(TRIM(designation)) = ?', [$key])->exists();
            if (!$exists) {
                Stock::create([
                    'designation' => $data['designation'],
                    'unite' => $data['unite'],
                    'quantite_initiale' => 0,
                    'last_entry_date' => $data['last_date']
                ]);
            } else {
                // Update last_entry_date if BL is newer
                Stock::whereRaw('LOWER(TRIM(designation)) = ?', [$key])
                    ->where(function ($q) use ($data) {
                        $q->whereNull('last_entry_date')
                          ->orWhere('last_entry_date', '<', $data['last_date']);
                    })
                    ->update(['last_entry_date' => $data['last_date']]);
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

            // Disponible = Initial Stock (manual) + Quantities from Validated BLs
            $available  = round((float) $stock->quantite_initiale + $qty_bl, 3);
            $consumed   = round($this->computeConsumed($stock->designation), 3);
            $remaining  = round($available - $consumed, 3);

            $stock->quantite_disponible = $available;
            $stock->quantite_consommee  = $consumed;
            $stock->quantite_restante   = $remaining;
            $stock->statut              = $this->computeStatus($remaining, $available);

            return $stock;
        });

        return response()->json($stocks);
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

            $stock->quantite_disponible = $available;
            $stock->quantite_consommee  = $consumed;
            $stock->quantite_restante   = $remaining;
            $stock->statut              = $this->computeStatus($remaining, $available);

            return $stock;
        });

        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Inventaire du Stock');

        $sheet->setShowGridlines(true);
        $sheet->getPageSetup()->setOrientation(\PhpOffice\PhpSpreadsheet\Worksheet\PageSetup::ORIENTATION_LANDSCAPE);
        $sheet->getPageSetup()->setPaperSize(\PhpOffice\PhpSpreadsheet\Worksheet\PageSetup::PAPERSIZE_A4);
        $sheet->getPageSetup()->setFitToWidth(1);

        $sheet->getColumnDimension('A')->setWidth(50);
        $sheet->getColumnDimension('B')->setWidth(12);
        $sheet->getColumnDimension('C')->setWidth(18);
        $sheet->getColumnDimension('D')->setWidth(18);
        $sheet->getColumnDimension('E')->setWidth(18);
        $sheet->getColumnDimension('F')->setWidth(20);

        $sheet->setCellValue('A1', 'ÉTAT DU STOCK / INVENTAIRE');
        $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(16);
        $sheet->getStyle('A1')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->mergeCells('A1:F1');

        $sheet->setCellValue('A2', 'Période du ' . date('d/m/Y', strtotime($startDate)) . ' au ' . date('d/m/Y', strtotime($endDate)));
        $sheet->getStyle('A2')->getFont()->setItalic(true)->setSize(12);
        $sheet->getStyle('A2')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->mergeCells('A2:F2');

        $sheet->setCellValue('A3', 'Généré le : ' . date('d/m/Y à H:i'));
        $sheet->getStyle('A3')->getFont()->setItalic(true)->setSize(10)->getColor()->setARGB('FF64748B');
        $sheet->getStyle('A3')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
        $sheet->mergeCells('A3:F3');

        $headers = [
            'A5' => 'Désignation Produit',
            'B5' => 'Unité',
            'C5' => 'Qté Disponible (BL)',
            'D5' => 'Qté Consommée (Fiches Tech.)',
            'E5' => 'Qté Restante',
            'F5' => 'Statut',
        ];
        foreach ($headers as $cell => $value) {
            $sheet->setCellValue($cell, $value);
        }

        $headerStyle = $sheet->getStyle('A5:F5');
        $headerStyle->getFont()->setBold(true)->setSize(11)->getColor()->setARGB('FFFFFFFF');
        $headerStyle->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FF0F766E');
        $headerStyle->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $headerStyle->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);

        $currentRow = 6;
        foreach ($stocks as $index => $stock) {
            $isEven = ($index % 2 === 0);

            $sheet->setCellValue('A' . $currentRow, $stock->designation);
            $sheet->setCellValue('B' . $currentRow, $stock->unite);
            $sheet->setCellValue('C' . $currentRow, $stock->quantite_disponible);
            $sheet->setCellValue('D' . $currentRow, $stock->quantite_consommee);
            $sheet->setCellValue('E' . $currentRow, $stock->quantite_restante);
            $sheet->setCellValue('F' . $currentRow, $stock->statut);

            $sheet->getStyle('A' . $currentRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT);
            $sheet->getStyle('B' . $currentRow . ':F' . $currentRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
            $sheet->getStyle('A' . $currentRow . ':F' . $currentRow)->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);

            $rowBg = $isEven ? 'FFF8FAFC' : 'FFFFFFFF';
            $sheet->getStyle('A' . $currentRow . ':F' . $currentRow)->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB($rowBg);

            if ($stock->quantite_restante <= 0) {
                $sheet->getStyle('E' . $currentRow . ':F' . $currentRow)->getFont()->getColor()->setARGB('FFDC2626');
                $sheet->getStyle('E' . $currentRow . ':F' . $currentRow)->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FFFEE2E2');
            } elseif ($stock->statut === 'Stock Faible') {
                $sheet->getStyle('E' . $currentRow . ':F' . $currentRow)->getFont()->getColor()->setARGB('FFD97706');
                $sheet->getStyle('E' . $currentRow . ':F' . $currentRow)->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FFFEF3C7');
            } else {
                $sheet->getStyle('F' . $currentRow)->getFont()->getColor()->setARGB('FF16A34A');
            }

            $sheet->getRowDimension($currentRow)->setRowHeight(20);
            $currentRow++;
        }

        $totalsRow = $currentRow;
        $sheet->setCellValue('A' . $totalsRow, 'TOTAUX');
        $sheet->setCellValue('C' . $totalsRow, '=SUM(C6:C' . ($totalsRow - 1) . ')');
        $sheet->setCellValue('D' . $totalsRow, '=SUM(D6:D' . ($totalsRow - 1) . ')');
        $sheet->setCellValue('E' . $totalsRow, '=SUM(E6:E' . ($totalsRow - 1) . ')');
        $sheet->getStyle('A' . $totalsRow . ':F' . $totalsRow)->getFont()->setBold(true)->setSize(11);
        $sheet->getStyle('A' . $totalsRow . ':F' . $totalsRow)->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FFE2E8F0');
        $sheet->getStyle('A' . $totalsRow . ':F' . $totalsRow)->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_MEDIUM);
        $sheet->getStyle('C' . $totalsRow . ':E' . $totalsRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

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
