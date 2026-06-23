<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use App\Models\Facture;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Arr;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
class FactureController extends Controller
{
    public function index(Request $request)
    {
        $query = Facture::with('articles')->orderBy('id', 'desc');

        // Filter by marche_id if provided
        if ($request->has('marche_id') && $request->marche_id) {
            $query->where('marche_id', $request->marche_id);
        }

        return response()->json($query->get());
    }

    public function store(Request $request)
    {
        $marcheId = $request->input('marche_id');
        $validated = $request->validate([
            'numero_facture' => [
                'required', 'string',
                Rule::unique('factures', 'numero_facture')->where(function ($query) use ($marcheId) {
                    return $query->where('marche_id', $marcheId);
                }),
            ],
            'date_facture' => 'required|date',
            'client' => 'nullable|string',
            'ice_client' => 'nullable|string',
            'reference_bc' => 'nullable|string',
            'site_livraison' => 'nullable|string',
            'montant_lettres' => 'nullable|string',
            'total_ht' => 'nullable|numeric',
            'tva' => 'nullable|numeric',
            'tva_9' => 'nullable|numeric',
            'tva_10' => 'nullable|numeric',
            'tva_20' => 'nullable|numeric',
            'total_ttc' => 'nullable|numeric',
            'statut' => 'nullable|string',
            'marche_id' => 'nullable|exists:marches,id',
            'conditions_generales' => 'nullable|string',
            'conditions_particulieres' => 'nullable|string',
            'articles' => 'nullable|array'
        ]);

        DB::beginTransaction();
        try {
            $facture = Facture::create(Arr::except($validated, ['articles']));

            $articles = $request->input('articles', []);
            if (!empty($articles)) {
                foreach ($articles as $article) {
                    $facture->articles()->create($article);
                }
            }
            DB::commit();
            return response()->json($facture->load('articles'), 201);
        } catch (\Exception $e) {
            DB::rollback();
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    public function update(Request $request, $id)
    {
        $facture = Facture::findOrFail($id);

        $marcheId = $request->input('marche_id');
        $validated = $request->validate([
            'numero_facture' => [
                'required', 'string',
                Rule::unique('factures', 'numero_facture')->where(function ($query) use ($marcheId) {
                    return $query->where('marche_id', $marcheId);
                })->ignore($facture->id),
            ],
            'date_facture' => 'required|date',
            'client' => 'nullable|string',
            'ice_client' => 'nullable|string',
            'reference_bc' => 'nullable|string',
            'site_livraison' => 'nullable|string',
            'montant_lettres' => 'nullable|string',
            'total_ht' => 'nullable|numeric',
            'tva' => 'nullable|numeric',
            'tva_9' => 'nullable|numeric',
            'tva_10' => 'nullable|numeric',
            'tva_20' => 'nullable|numeric',
            'total_ttc' => 'nullable|numeric',
            'statut' => 'nullable|string',
            'marche_id' => 'nullable|exists:marches,id',
            'conditions_generales' => 'nullable|string',
            'conditions_particulieres' => 'nullable|string',
            'articles' => 'nullable|array'
        ]);

        DB::beginTransaction();
        try {
            $facture->update(Arr::except($validated, ['articles']));

            $articles = $request->input('articles');
            if (isset($articles)) {
                $facture->articles()->delete();
                foreach ($articles as $article) {
                    $facture->articles()->create($article);
                }
            }
            DB::commit();
            return response()->json($facture->load('articles'), 200);
        } catch (\Exception $e) {
            DB::rollback();
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    public function destroy($id)
    {
        $facture = Facture::findOrFail($id);
        $facture->delete();
        return response()->json(['message' => 'Facture deleted successfully']);
    }

    public function export($id)
    {
        $facture = Facture::with(['articles', 'marche.fournisseur'])->findOrFail($id);

        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Facture');

        // Page setup
        $sheet->setShowGridlines(false);
        $sheet->getPageSetup()->setOrientation(\PhpOffice\PhpSpreadsheet\Worksheet\PageSetup::ORIENTATION_PORTRAIT);
        $sheet->getPageSetup()->setPaperSize(\PhpOffice\PhpSpreadsheet\Worksheet\PageSetup::PAPERSIZE_A4);
        $sheet->getPageSetup()->setFitToWidth(1);
        $sheet->getPageSetup()->setFitToHeight(0);

        // Column widths to match layout
        $sheet->getColumnDimension('A')->setWidth(5);   // N°
        $sheet->getColumnDimension('B')->setWidth(45);  // DESIGNATIONS
        $sheet->getColumnDimension('C')->setWidth(10);  // UNITE
        $sheet->getColumnDimension('D')->setWidth(10);  // QTE
        $sheet->getColumnDimension('E')->setWidth(12);  // P.U HT
        $sheet->getColumnDimension('F')->setWidth(10);  // Taux TVA
        $sheet->getColumnDimension('G')->setWidth(12);  // TVA
        $sheet->getColumnDimension('H')->setWidth(15);  // TOTAL HT

        // Default Font
        $sheet->getStyle('A1:H100')->getFont()->setName('Arial')->setSize(10);

        // Fournisseur Info
        $fournisseur = $facture->marche ? $facture->marche->fournisseur : null;
        $nom_fournisseur = $fournisseur ? $fournisseur->raisonSociale : 'NOM DU FOURNISSEUR';
        $adresse = $fournisseur ? $fournisseur->adresse : '';
        $rc = $fournisseur ? $fournisseur->rc : '';
        $patente = $fournisseur ? $fournisseur->patente : '';
        $cnss = $fournisseur ? $fournisseur->cnss : '';
        $identifiant_fiscal = $fournisseur ? $fournisseur->{'if'} : '';
        $ice = $fournisseur ? $fournisseur->ice : '';
        $rib = $fournisseur ? $fournisseur->rib : '';
        $banque = $fournisseur ? $fournisseur->banque : '';

        // Header Block
        $sheet->setCellValue('A1', mb_strtoupper($nom_fournisseur));
        $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(18);
        $sheet->mergeCells('A1:H1');
        $sheet->getStyle('A1')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

        $line2 = trim($adresse . ' RC ' . $rc);
        $sheet->setCellValue('A2', mb_strtoupper($line2));
        $sheet->mergeCells('A2:H2');
        $sheet->getStyle('A2')->getFont()->setSize(9)->setBold(true);

        $line3 = "PATENTE : {$patente} - CNSS : {$cnss} - IF : {$identifiant_fiscal} - ICE : {$ice}";
        $sheet->setCellValue('A3', $line3);
        $sheet->mergeCells('A3:H3');
        $sheet->getStyle('A3')->getFont()->setSize(9)->setBold(true);

        $line4 = "(RIB) : {$rib} à {$banque}";
        $sheet->setCellValue('A4', $line4);
        $sheet->mergeCells('A4:H4');
        $sheet->getStyle('A4')->getFont()->setSize(9)->setBold(true);

        $sheet->getStyle('A2:A4')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->getStyle('A4:H4')->getBorders()->getBottom()->setBorderStyle(Border::BORDER_THIN);

        // Title FACTURE N°
        $sheet->setCellValue('A5', 'FACTURE N° : ' . $facture->numero_facture);
        $sheet->mergeCells('A5:E5');
        $sheet->getStyle('A5')->getFont()->setBold(true)->setSize(16);
        $sheet->getStyle('A5')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->getStyle('A5:E5')->getBorders()->getOutline()->setBorderStyle(Border::BORDER_THICK);

        // Client Info
        $sheet->setCellValue('A7', 'CLIENT: ' . mb_strtoupper($facture->client));
        $sheet->getStyle('A7')->getFont()->setBold(true);
        $sheet->mergeCells('A7:H7');

        $dateFacture = date('d/m/Y', strtotime($facture->date_facture));
        $sheet->setCellValue('A8', 'Date : ' . $dateFacture);
        $sheet->getStyle('A8')->getFont()->setBold(true);
        $sheet->mergeCells('A8:H8');

        $sheet->setCellValue('A9', 'Site de livraison : ' . mb_strtoupper($facture->site_livraison));
        $sheet->getStyle('A9')->getFont()->setBold(true);
        $sheet->mergeCells('A9:D9');

        $sheet->setCellValue('E9', 'réf : BON DE COMMANDE N° ' . mb_strtoupper($facture->reference_bc));
        $sheet->getStyle('E9')->getFont()->setBold(true);
        $sheet->mergeCells('E9:H9');
        $sheet->getStyle('E9')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);

        $sheet->setCellValue('A10', 'ICE CLIENT : ');
        $sheet->getStyle('A10')->getFont()->setBold(true);
        $sheet->mergeCells('A10:H10');

        // Table Headers
        $row = 12;
        $headers = ['N°', 'DESIGNATIONS ET REFERENCES', 'UNITE', 'QTE', 'P.U HT', 'Taux TVA', 'TVA', 'TOTAL HT'];
        $col = 'A';
        foreach ($headers as $header) {
            $sheet->setCellValue($col . $row, $header);
            $sheet->getStyle($col . $row)->getFont()->setBold(true);
            $sheet->getStyle($col . $row)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER)->setVertical(Alignment::VERTICAL_CENTER);
            $col++;
        }
        $sheet->getStyle("A{$row}:H{$row}")->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
        $sheet->getStyle("A{$row}:H{$row}")->getBorders()->getOutline()->setBorderStyle(Border::BORDER_MEDIUM);
        $sheet->getRowDimension($row)->setRowHeight(25);

        // Table Rows
        $row++;
        $index = 1;
        foreach ($facture->articles as $article) {
            $sheet->setCellValue('A' . $row, $index);
            $sheet->setCellValue('B' . $row, $article->designation);
            $sheet->setCellValue('C' . $row, $article->unite);
            $sheet->setCellValue('D' . $row, $article->qte);
            $sheet->setCellValue('E' . $row, number_format($article->pu_ht, 2, ',', ' '));
            $sheet->setCellValue('F' . $row, intval($article->taux_tva) . '%');
            $sheet->setCellValue('G' . $row, number_format($article->tva, 2, ',', ' '));
            $sheet->setCellValue('H' . $row, number_format($article->total_ht, 2, ',', ' '));

            $sheet->getStyle('A' . $row)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
            $sheet->getStyle('C' . $row)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
            $sheet->getStyle('D' . $row)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
            $sheet->getStyle('E' . $row)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
            $sheet->getStyle('F' . $row)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
            $sheet->getStyle('G' . $row)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
            $sheet->getStyle('H' . $row)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

            $sheet->getStyle("A{$row}:H{$row}")->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
            
            $sheet->getRowDimension($row)->setRowHeight(20);
            $row++;
            $index++;
        }

        // Totals Footer
        // Left side (Arrêt en lettres)
        $sheet->mergeCells("A{$row}:E" . ($row + 4));
        $lettres = "Arrêter la présente facture à la somme de :\n" . ($facture->montant_lettres ?? '');
        $sheet->setCellValue("A{$row}", $lettres);
        $sheet->getStyle("A{$row}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER)->setVertical(Alignment::VERTICAL_CENTER)->setWrapText(true);
        $sheet->getStyle("A{$row}")->getFont()->setBold(true);
        $sheet->getStyle("A{$row}:E" . ($row + 4))->getBorders()->getOutline()->setBorderStyle(Border::BORDER_MEDIUM);

        // Right side (Calculs)
        $totals = [
            ['TOTAL H.T', $facture->total_ht],
            ['TVA 9 %', $facture->tva_9],
            ['TVA 10 %', $facture->tva_10],
            ['TVA 20 %', $facture->tva_20],
            ['TOTAL T.T.C', $facture->total_ttc]
        ];

        $r = $row;
        foreach ($totals as $t) {
            $sheet->mergeCells("F{$r}:G{$r}");
            $sheet->setCellValue("F{$r}", $t[0]);
            $sheet->setCellValue("H{$r}", number_format($t[1], 2, ',', ' '));
            
            $sheet->getStyle("F{$r}:G{$r}")->getFont()->setBold(true);
            $sheet->getStyle("F{$r}:G{$r}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
            $sheet->getStyle("H{$r}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
            $sheet->getStyle("F{$r}:H{$r}")->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
            $r++;
        }
        $sheet->getStyle("F{$row}:H" . ($row + 4))->getBorders()->getOutline()->setBorderStyle(Border::BORDER_MEDIUM);

        // File download
        $writer = new Xlsx($spreadsheet);
        $filename = 'Facture_' . str_replace('/', '_', $facture->numero_facture) . '.xlsx';

        return response()->streamDownload(function () use ($writer) {
            $writer->save('php://output');
        }, $filename, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Cache-Control' => 'max-age=0',
        ]);
    }
}
