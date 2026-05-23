<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Stock;
use App\Models\TechnicalSheet;
use Illuminate\Http\Request;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;

class StockController extends Controller
{
    public function index()
    {
        // Add any items that were used in Technical Sheets but don't exist in Stock yet
        $consumedItems = TechnicalSheet::join('bordereau', 'technical_sheets.bordereau_id', '=', 'bordereau.id')
            ->select('bordereau.service_description', 'bordereau.unit_of_measure')
            ->distinct()
            ->get();
            
        foreach ($consumedItems as $item) {
            if (!empty($item->service_description)) {
                Stock::firstOrCreate(
                    ['designation' => $item->service_description],
                    ['unite' => $item->unit_of_measure, 'quantite_initiale' => 0]
                );
            }
        }

        $stocks = Stock::orderBy('designation', 'asc')->get()->map(function ($stock) {
            $consumed = TechnicalSheet::join('bordereau', 'technical_sheets.bordereau_id', '=', 'bordereau.id')
                ->where('bordereau.service_description', $stock->designation)
                ->sum('technical_sheets.calculated_quantity');

            $stock->quantite_consommee = round((float)$consumed, 3);
            $stock->quantite_restante = round($stock->quantite_initiale - $stock->quantite_consommee, 3);
            return $stock;
        });

        return response()->json($stocks);
    }

    public function export(Request $request)
    {
        // Add any items that were used in Technical Sheets but don't exist in Stock yet
        $consumedItems = TechnicalSheet::join('bordereau', 'technical_sheets.bordereau_id', '=', 'bordereau.id')
            ->select('bordereau.service_description', 'bordereau.unit_of_measure')
            ->distinct()
            ->get();
            
        foreach ($consumedItems as $item) {
            if (!empty($item->service_description)) {
                Stock::firstOrCreate(
                    ['designation' => $item->service_description],
                    ['unite' => $item->unit_of_measure, 'quantite_initiale' => 0]
                );
            }
        }

        $startDate = $request->query('start_date', '2000-01-01');
        $endDate = $request->query('end_date', date('Y-m-d'));

        $stocks = Stock::orderBy('designation', 'asc')->get()->map(function ($stock) use ($startDate, $endDate) {
            $consumed = TechnicalSheet::join('bordereau', 'technical_sheets.bordereau_id', '=', 'bordereau.id')
                ->where('bordereau.service_description', $stock->designation)
                ->whereBetween('technical_sheets.date', [$startDate, $endDate])
                ->sum('technical_sheets.calculated_quantity');

            // For export, we compute consumed over the period. 
            // Total entered is still quantite_initiale unless we specifically track BonLivraison dates for that period.
            // Since the user asked for "quantités ajoutées, quantités consommées, quantité restante", 
            // we will provide the global quantite_initiale and the period's consumed qty.
            
            $stock->quantite_consommee = round((float)$consumed, 3);
            $stock->quantite_restante = round($stock->quantite_initiale - $stock->quantite_consommee, 3);
            return $stock;
        });

        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Inventaire du Stock');

        // Styles and Setup
        $sheet->setShowGridlines(true);
        $sheet->getPageSetup()->setOrientation(\PhpOffice\PhpSpreadsheet\Worksheet\PageSetup::ORIENTATION_LANDSCAPE);

        $sheet->getColumnDimension('A')->setWidth(50);
        $sheet->getColumnDimension('B')->setWidth(15);
        $sheet->getColumnDimension('C')->setWidth(15);
        $sheet->getColumnDimension('D')->setWidth(20);
        $sheet->getColumnDimension('E')->setWidth(20);

        // Header Title
        $sheet->setCellValue('A1', 'ÉTAT DU STOCK / INVENTAIRE');
        $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(16);
        $sheet->getStyle('A1')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->mergeCells('A1:E1');

        $sheet->setCellValue('A2', 'Période du ' . date('d/m/Y', strtotime($startDate)) . ' au ' . date('d/m/Y', strtotime($endDate)));
        $sheet->getStyle('A2')->getFont()->setItalic(true)->setSize(12);
        $sheet->getStyle('A2')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->mergeCells('A2:E2');

        // Headers
        $sheet->setCellValue('A4', 'Désignation Produit');
        $sheet->setCellValue('B4', 'Unité');
        $sheet->setCellValue('C4', 'Qté Entrée (BL)');
        $sheet->setCellValue('D4', 'Qté Consommée');
        $sheet->setCellValue('E4', 'Qté Restante');

        $sheet->getStyle('A4:E4')->getFont()->setBold(true)->setSize(11);
        $sheet->getStyle('A4:E4')->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FFD9EAD3');
        $sheet->getStyle('A4:E4')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->getStyle('A4:E4')->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);

        $currentRow = 5;
        foreach ($stocks as $stock) {
            $sheet->setCellValue('A' . $currentRow, $stock->designation);
            $sheet->setCellValue('B' . $currentRow, $stock->unite);
            $sheet->setCellValue('C' . $currentRow, $stock->quantite_initiale);
            $sheet->setCellValue('D' . $currentRow, $stock->quantite_consommee);
            $sheet->setCellValue('E' . $currentRow, $stock->quantite_restante);

            $sheet->getStyle('A' . $currentRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT);
            $sheet->getStyle('B' . $currentRow . ':E' . $currentRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
            $sheet->getStyle('A' . $currentRow . ':E' . $currentRow)->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);

            if ($stock->quantite_restante < 0) {
                $sheet->getStyle('E' . $currentRow)->getFont()->getColor()->setARGB('FFFF0000');
            }

            $currentRow++;
        }

        $writer = new Xlsx($spreadsheet);
        $filename = 'Inventaire_Stock_' . date('Y_m_d') . '.xlsx';

        return response()->streamDownload(function () use ($writer) {
            $writer->save('php://output');
        }, $filename, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Cache-Control' => 'max-age=0',
        ]);
    }
}
