<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BonCommande;
use Illuminate\Http\Request;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;

class BonCommandeController extends Controller
{
    public function index()
    {
        return response()->json(BonCommande::with('fournisseur')->get());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'numeroBC' => 'required|string|unique:bon_commandes,numeroBC',
            'dateEmission' => 'required|date',
            'budget' => 'nullable|string',
            'exercice' => 'nullable|integer',
            'rubrique' => 'nullable|string',
            'referenceMarcheCadre' => 'nullable|string',
            'lieuLivraison' => 'nullable|string',
            'conditionsGenerales' => 'nullable|string',
            'conditionsParticulieres' => 'nullable|string',
            'montantHT' => 'nullable|numeric',
            'montantTVA' => 'nullable|numeric',
            'montantTTC' => 'nullable|numeric',
            'statut' => 'nullable|string',
            'fournisseur_id' => 'nullable|exists:fournisseurs,id',
            'marche_id' => 'nullable|exists:marches,id',
            'items' => 'nullable|array'
        ]);

        // Automatically compute TTC if HT is provided and TTC is not
        if ($request->filled('montantHT')) {
            $ht = (float) $request->input('montantHT');
            if (!$request->filled('montantTVA')) {
                $validated['montantTVA'] = $ht * 0.20;
            }
            if (!$request->filled('montantTTC')) {
                $validated['montantTTC'] = $ht + (float)($validated['montantTVA'] ?? ($ht * 0.20));
            }
        }

        $bonCommande = BonCommande::create($validated);
        return response()->json($bonCommande->load('fournisseur'), 201);
    }

    public function show($id)
    {
        $bonCommande = BonCommande::with('fournisseur')->findOrFail($id);
        return response()->json($bonCommande);
    }

    public function update(Request $request, $id)
    {
        $bonCommande = BonCommande::findOrFail($id);

        $validated = $request->validate([
            'numeroBC' => 'required|string|unique:bon_commandes,numeroBC,' . $id,
            'dateEmission' => 'required|date',
            'budget' => 'nullable|string',
            'exercice' => 'nullable|integer',
            'rubrique' => 'nullable|string',
            'referenceMarcheCadre' => 'nullable|string',
            'lieuLivraison' => 'nullable|string',
            'conditionsGenerales' => 'nullable|string',
            'conditionsParticulieres' => 'nullable|string',
            'montantHT' => 'nullable|numeric',
            'montantTVA' => 'nullable|numeric',
            'montantTTC' => 'nullable|numeric',
            'statut' => 'nullable|string',
            'fournisseur_id' => 'nullable|exists:fournisseurs,id',
            'marche_id' => 'nullable|exists:marches,id',
            'items' => 'nullable|array'
        ]);

        if ($request->filled('montantHT')) {
            $ht = (float) $request->input('montantHT');
            if (!$request->filled('montantTVA')) {
                $validated['montantTVA'] = $ht * 0.20;
            }
            if (!$request->filled('montantTTC')) {
                $validated['montantTTC'] = $ht + (float)($validated['montantTVA'] ?? ($ht * 0.20));
            }
        }

        $bonCommande->update($validated);
        return response()->json($bonCommande->load('fournisseur'));
    }

    public function destroy($id)
    {
        $bonCommande = BonCommande::findOrFail($id);
        $bonCommande->delete();
        return response()->json(['message' => 'Bon de commande supprimé avec succès']);
    }

    public function export($id)
    {
        $bc = BonCommande::with('fournisseur')->findOrFail($id);
        $items = $bc->items ?? [];

        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Bon de Commande');

        // Page setup
        $sheet->getPageSetup()->setOrientation(\PhpOffice\PhpSpreadsheet\Worksheet\PageSetup::ORIENTATION_PORTRAIT);
        $sheet->getPageSetup()->setPaperSize(\PhpOffice\PhpSpreadsheet\Worksheet\PageSetup::PAPERSIZE_A4);
        $sheet->getPageSetup()->setFitToWidth(1);
        $sheet->getPageSetup()->setFitToHeight(0);

        // Column widths
        $sheet->getColumnDimension('A')->setWidth(5);   // N°
        $sheet->getColumnDimension('B')->setWidth(40);  // Désignation
        $sheet->getColumnDimension('C')->setWidth(8);   // Unité
        $sheet->getColumnDimension('D')->setWidth(8);   // Qté
        $sheet->getColumnDimension('E')->setWidth(10);  // PU HT
        $sheet->getColumnDimension('F')->setWidth(10);  // Taux TVA
        $sheet->getColumnDimension('G')->setWidth(12);  // TVA
        $sheet->getColumnDimension('H')->setWidth(14);  // Total HT
        $sheet->getColumnDimension('I')->setWidth(35);  // Conditions

        $sheet->getStyle('A1:I200')->getFont()->setName('Arial')->setSize(9);

        // --- Left Header Block ---
        $sheet->mergeCells('A1:C1'); $sheet->setCellValue('A1', 'OFFICE DE LA FORMATION PROFESSIONNELLE');
        $sheet->mergeCells('A2:C2'); $sheet->setCellValue('A2', 'ET DE LA PROMOTION DU TRAVAIL');
        $sheet->mergeCells('A4:C4'); $sheet->setCellValue('A4', 'Direction Régionale Draa Tafilalet');
        $sheet->mergeCells('A5:C5'); $sheet->setCellValue('A5', 'ISBTP QUARTIER EL MATAR');
        $sheet->mergeCells('A7:C7'); $sheet->setCellValue('A7', 'ERRACHIDIA');
        $sheet->mergeCells('A8:C8'); $sheet->setCellValue('A8', 'Tél : 0535572740');
        
        $sheet->getStyle('A1:C8')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->getStyle('A1:C2')->getFont()->setBold(true)->setSize(8);
        $sheet->getStyle('A4:C8')->getFont()->setBold(true)->setSize(8);

        // --- Middle Header Block ---
        $fourn = $bc->fournisseur;
        $sheet->mergeCells('D1:G1'); $sheet->setCellValue('D1', 'Référence du Fournisseur');
        $sheet->mergeCells('D2:G3'); $sheet->setCellValue('D2', 'Sté ' . ($fourn->raisonSociale ?? ''));
        $sheet->mergeCells('D4:G4'); $sheet->setCellValue('D4', 'Adresse : ' . ($fourn->adresse ?? ''));
        $sheet->mergeCells('D5:G5'); $sheet->setCellValue('D5', 'PATENTE N° : ' . ($fourn->patente ?? '') . '      RC : ' . ($fourn->rc ?? ''));
        $sheet->mergeCells('D6:G6'); $sheet->setCellValue('D6', 'IF : ' . ($fourn->if ?? '') . '      ICE : ' . ($fourn->ice ?? ''));
        $sheet->mergeCells('D7:G7'); $sheet->setCellValue('D7', 'RIB : ' . ($fourn->rib ?? ''));
        $sheet->mergeCells('D8:G8'); $sheet->setCellValue('D8', 'Nous vous prions de bien vouloir exécuter la');
        $sheet->mergeCells('D9:G9'); $sheet->setCellValue('D9', 'Présente Commande aux conditions ci-après:');

        $sheet->getStyle('D1')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->getStyle('D2')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER)->setVertical(Alignment::VERTICAL_CENTER);
        $sheet->getStyle('D2')->getFont()->setBold(true);
        $sheet->getStyle('D4:D7')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT);
        $sheet->getStyle('D8:D9')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        
        // Borders for Middle block
        $sheet->getStyle('D1:G9')->getBorders()->getOutline()->setBorderStyle(Border::BORDER_THIN);
        $sheet->getStyle('D1:G1')->getBorders()->getBottom()->setBorderStyle(Border::BORDER_THIN);

        // --- Right Header Block ---
        $sheet->mergeCells('H1:I2'); $sheet->setCellValue('H1', 'BON DE COMMANDE');
        $sheet->getStyle('H1')->getFont()->setBold(true)->setSize(11);
        $sheet->getStyle('H1')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER)->setVertical(Alignment::VERTICAL_CENTER);
        
        $sheet->mergeCells('H3:I3'); $sheet->setCellValue('H3', 'B.C PA  ' . ($bc->numeroBC ?: ''));
        $sheet->getStyle('H3')->getFont()->setBold(true)->setSize(10);
        $sheet->getStyle('H3')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

        // Sub-table in right block
        $sheet->setCellValue('H4', 'BUDGET:'); $sheet->setCellValue('I4', $bc->budget ?: 'BF');
        $sheet->setCellValue('H5', 'EXERCICE:'); $sheet->setCellValue('I5', $bc->exercice ?: date('Y'));
        $sheet->setCellValue('H6', 'Rubrique:'); $sheet->setCellValue('I6', $bc->rubrique ?: 'ACHAT PRODUITS ALIMENTAIRES');
        $sheet->setCellValue('H7', 'Réf MARCHE CADRE:'); $sheet->setCellValue('I7', $bc->referenceMarcheCadre ?: '');
        $sheet->setCellValue('H8', 'LIEU DE LIVRAISON:'); $sheet->setCellValue('I8', $bc->lieuLivraison ?: 'Ouarzazate');
        
        $sheet->getStyle('H4:I8')->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
        $sheet->getStyle('H4:H8')->getFont()->setSize(8);
        $sheet->getStyle('I4:I8')->getFont()->setSize(8);
        $sheet->getStyle('H1:I8')->getBorders()->getOutline()->setBorderStyle(Border::BORDER_THICK);

        // --- Table Headers ---
        $sheet->mergeCells('E10:H10'); $sheet->setCellValue('E10', 'PRIX');
        $sheet->getStyle('E10')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->getStyle('E10:H10')->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
        $sheet->getStyle('E10')->getFont()->setBold(true);

        $sheet->setCellValue('A11', 'N°');
        $sheet->setCellValue('B11', 'DESIGNATIONS ET REFERENCES');
        $sheet->setCellValue('C11', 'UNITE');
        $sheet->setCellValue('D11', 'QTE');
        $sheet->setCellValue('E11', 'P.U HT');
        $sheet->setCellValue('F11', 'Taux TVA');
        $sheet->setCellValue('G11', 'TVA');
        $sheet->setCellValue('H11', 'TOTAL HT');
        $sheet->setCellValue('I11', 'CONDITIONS GENERALES');
        
        $sheet->mergeCells('A10:A11');
        $sheet->mergeCells('B10:B11');
        $sheet->mergeCells('C10:C11');
        $sheet->mergeCells('D10:D11');
        $sheet->mergeCells('I10:I11');

        $sheet->getStyle('A10:I11')->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
        $sheet->getStyle('A10:I11')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->getStyle('A10:I11')->getAlignment()->setVertical(Alignment::VERTICAL_CENTER);
        $sheet->getStyle('A10:I11')->getFont()->setBold(true)->setSize(8);

        // --- Items Data ---
        $row = 12;
        foreach ($items as $item) {
            $sheet->setCellValue('A' . $row, $item['price_number'] ?? '');
            $sheet->setCellValue('B' . $row, $item['service_description'] ?? ($item['designation'] ?? ($item['label'] ?? '')));
            $sheet->setCellValue('C' . $row, $item['unit_of_measure'] ?? ($item['unit'] ?? 'Unité'));
            $sheet->setCellValue('D' . $row, $item['qty'] ?? ($item['quantity'] ?? 0));
            $sheet->setCellValue('E' . $row, $item['unit_price_ht'] ?? ($item['price'] ?? ($item['unit_price'] ?? ($item['pu'] ?? 0))));
            
            $vatRate = isset($item['vat_rate']) ? (float)str_replace('%', '', $item['vat_rate']) : 20;
            $sheet->setCellValue('F' . $row, $vatRate / 100);

            $sheet->setCellValue('G' . $row, '=IF(F'.$row.'=0,"-",D' . $row . '*E' . $row . '*F' . $row.')');
            $sheet->setCellValue('H' . $row, '=D' . $row . '*E' . $row);

            // Background color for Qté
            $sheet->getStyle('D'.$row)->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FFD9E1F2');

            // Formatting
            $sheet->getStyle('E' . $row)->getNumberFormat()->setFormatCode('#,##0.00');
            $sheet->getStyle('F' . $row)->getNumberFormat()->setFormatCode('0%');
            $sheet->getStyle('G' . $row)->getNumberFormat()->setFormatCode('#,##0.00');
            $sheet->getStyle('H' . $row)->getNumberFormat()->setFormatCode('#,##0.00');
            
            $sheet->getStyle('A'.$row.':H'.$row)->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
            
            $sheet->getStyle('A' . $row)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
            $sheet->getStyle('B' . $row)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT)->setWrapText(true);
            $sheet->getStyle('C' . $row)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
            $sheet->getStyle('D' . $row)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

            $row++;
        }

        // If no items, ensure at least one row for structure
        if ($row == 12) {
            $sheet->getStyle('A12:H12')->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
            $row++;
        }

        $lastItemRow = $row - 1;

        // --- Conditions Generales ---
        $sheet->mergeCells('I12:I'.$lastItemRow);
        $conditionsDefault = "1- L'acceptation de la commande d'achat entraîne pour le fournisseur l'obligation de se conformer aux conditions générales et particulières de cette commande.\n2- Toute livraison doit faire l'objet d'un bon de livraison en 3 exemplaires.\n3- Les délais de réception indiqués sur notre Commande s'entendent pour marchandises rendues au lieu de livraison.\n4- La réception définitive des marchandises est subordonnée à leur acceptation par nos services et la quantité à livrer doit être égale à celle indiquée sur la commande d'achat.\n5- Les prix s'entendent toutes taxes comprises d'une seule facturation de 3 exemplaires.\n6- Toute commande doit faire l'objet dans la mesure du possible.";
        $sheet->setCellValue('I12', $bc->conditionsGenerales ?? $conditionsDefault);
        $sheet->getStyle('I12')->getAlignment()->setVertical(Alignment::VERTICAL_TOP);
        $sheet->getStyle('I12')->getAlignment()->setWrapText(true);
        $sheet->getStyle('I12')->getFont()->setSize(7);
        $sheet->getStyle('I12:I'.$lastItemRow)->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);

        // --- Totals ---
        $totalsStart = $row;
        
        $sheet->mergeCells('D'.$totalsStart.':G'.$totalsStart); $sheet->setCellValue('D'.$totalsStart, 'TOTAL H.T');
        $sheet->setCellValue('H'.$totalsStart, '=SUM(H12:H'.$lastItemRow.')');
        
        $totalsStart++;
        $sheet->mergeCells('D'.$totalsStart.':G'.$totalsStart); $sheet->setCellValue('D'.$totalsStart, 'TVA 9 %');
        $sheet->setCellValue('H'.$totalsStart, '=SUMIF(F12:F'.$lastItemRow.', 0.09, G12:G'.$lastItemRow.')');
        
        $totalsStart++;
        $sheet->mergeCells('D'.$totalsStart.':G'.$totalsStart); $sheet->setCellValue('D'.$totalsStart, 'TVA 10 %');
        $sheet->setCellValue('H'.$totalsStart, '=SUMIF(F12:F'.$lastItemRow.', 0.10, G12:G'.$lastItemRow.')');
        
        $totalsStart++;
        $sheet->mergeCells('D'.$totalsStart.':G'.$totalsStart); $sheet->setCellValue('D'.$totalsStart, 'TVA 20 %');
        $sheet->setCellValue('H'.$totalsStart, '=SUMIF(F12:F'.$lastItemRow.', 0.20, G12:G'.$lastItemRow.')');
        
        $totalsStart++;
        $ttcRow = $totalsStart;
        $sheet->mergeCells('D'.$ttcRow.':G'.$ttcRow); $sheet->setCellValue('D'.$ttcRow, 'TOTAL T.T.C');
        $sheet->setCellValue('H'.$ttcRow, '=H'.($row).'+H'.($row+1).'+H'.($row+2).'+H'.($row+3));

        $sheet->getStyle('D'.$row.':H'.$ttcRow)->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
        $sheet->getStyle('D'.$row.':G'.$ttcRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->getStyle('H'.$row.':H'.$ttcRow)->getNumberFormat()->setFormatCode('#,##0.00');
        $sheet->getStyle('D'.$row.':H'.$ttcRow)->getFont()->setBold(true);

        // Date Livraison (Left of Totals)
        $sheet->mergeCells('A'.$row.':C'.$ttcRow);
        $sheet->setCellValue('A'.$row, 'Date Livraison :');
        $sheet->getStyle('A'.$row.':C'.$ttcRow)->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
        $sheet->getStyle('A'.$row)->getAlignment()->setVertical(Alignment::VERTICAL_CENTER);
        $sheet->getStyle('A'.$row)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT);
        $sheet->getStyle('A'.$row)->getFont()->setItalic(true)->setSize(8);

        // Conditions Particulieres (Right of Totals)
        $sheet->mergeCells('I'.$row.':I'.$ttcRow);
        $sheet->setCellValue('I'.$row, "CONDITIONS PARTICULIERES\n\n" . ($bc->conditionsParticulieres ?? ''));
        $sheet->getStyle('I'.$row.':I'.$ttcRow)->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
        $sheet->getStyle('I'.$row)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->getStyle('I'.$row)->getAlignment()->setVertical(Alignment::VERTICAL_CENTER);
        $sheet->getStyle('I'.$row)->getAlignment()->setWrapText(true);
        $sheet->getStyle('I'.$row)->getFont()->setSize(8);

        // --- Footer ---
        $footerRow = $ttcRow + 2;
        $sheet->mergeCells('D'.$footerRow.':I'.$footerRow);
        $sheet->setCellValue('D'.$footerRow, 'Errachidia, le ' . date('d/m/Y', strtotime($bc->dateEmission)));
        $sheet->getStyle('D'.$footerRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

        $footerRow += 2;
        $sheet->mergeCells('D'.$footerRow.':I'.$footerRow);
        $sheet->setCellValue('D'.$footerRow, 'LE SOUS ORDONNATEUR');
        $sheet->getStyle('D'.$footerRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->getStyle('D'.$footerRow)->getFont()->setBold(true);

        // Outline around the entire main content to match image a bit more
        $sheet->getStyle('A10:I'.$ttcRow)->getBorders()->getOutline()->setBorderStyle(Border::BORDER_THICK);

        $writer = new Xlsx($spreadsheet);
        $filename = 'Bon_de_Commande_' . str_replace('/', '_', $bc->numeroBC) . '.xlsx';

        return response()->streamDownload(function () use ($writer) {
            $writer->save('php://output');
        }, $filename, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Cache-Control' => 'max-age=0',
        ]);
    }
}
