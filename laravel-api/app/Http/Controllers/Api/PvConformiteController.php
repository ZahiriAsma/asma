<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PvReception;
use App\Models\PvConformite;
use Illuminate\Http\Request;

class PvConformiteController extends Controller
{
    /**
     * List all conformité lines for a given PV Reception.
     */
    public function index($pvReceptionId)
    {
        $pv = PvReception::with(['pvConformites', 'bonLivraison', 'marche', 'commissions'])->findOrFail($pvReceptionId);
        return response()->json($pv);
    }

    /**
     * Auto-generate conformité lines from a PV Reception's BL items.
     * POST /pv-receptions/{id}/conformites/generate
     */
    public function generate($pvReceptionId)
    {
        $pv = PvReception::with('bonLivraison')->findOrFail($pvReceptionId);
        $bl = $pv->bonLivraison;

        if (!$bl) {
            return response()->json(['message' => 'Bon de livraison introuvable.'], 404);
        }

        // Parse items from the BL
        $items = $bl->items;
        if (is_string($items)) {
            $items = json_decode($items, true);
            if (is_string($items)) {
                $items = json_decode($items, true);
            }
        }

        if (!is_array($items) || empty($items)) {
            return response()->json(['message' => 'Aucun produit trouvé dans le bon de livraison.'], 404);
        }

        // Delete existing conformité lines before regenerating
        $pv->pvConformites()->delete();

        $conformites = [];
        foreach ($items as $index => $item) {
            $conformites[] = $pv->pvConformites()->create([
                'numero_ligne'  => $index + 1,
                // BL items use 'service_description' as the product name field
                'designation'   => $item['service_description'] ?? $item['designation'] ?? $item['label'] ?? $item['name'] ?? 'Produit',
                // BL items use 'unit_of_measure' as the unit field
                'unite'         => $item['unit_of_measure'] ?? $item['unite'] ?? $item['unit'] ?? 'U',
                // BL items use 'qty' as the quantity field
                'quantite'      => floatval($item['qty'] ?? $item['quantity'] ?? $item['qte'] ?? 0),
                'conformite'    => 'Conforme',
                'observation'   => null,
            ]);
        }

        return response()->json($pv->load('pvConformites'), 201);
    }

    /**
     * Update conformité lines (batch update).
     * PUT /pv-receptions/{id}/conformites
     */
    public function update(Request $request, $pvReceptionId)
    {
        $pv = PvReception::findOrFail($pvReceptionId);

        $validated = $request->validate([
            'conformites' => 'required|array',
            'conformites.*.id' => 'nullable|integer',
            'conformites.*.numero_ligne' => 'required|integer',
            'conformites.*.designation' => 'required|string',
            'conformites.*.unite' => 'required|string',
            'conformites.*.quantite' => 'required|numeric',
            'conformites.*.conformite' => 'required|string|in:Conforme,Non Conforme',
            'conformites.*.observation' => 'nullable|string',
        ]);

        // Delete existing and recreate
        $pv->pvConformites()->delete();

        foreach ($validated['conformites'] as $line) {
            $pv->pvConformites()->create([
                'numero_ligne' => $line['numero_ligne'],
                'designation' => $line['designation'],
                'unite' => $line['unite'],
                'quantite' => $line['quantite'],
                'conformite' => $line['conformite'],
                'observation' => $line['observation'] ?? null,
            ]);
        }

        return response()->json($pv->load('pvConformites'));
    }

    /**
     * Export PV de Conformité as Word document.
     * GET /pv-receptions/{id}/conformites/export
     */
    public function export($pvReceptionId)
    {
        $pv = PvReception::with(['pvConformites', 'bonLivraison', 'marche', 'commissions'])->findOrFail($pvReceptionId);
        $bl = $pv->bonLivraison;
        $fourn = $bl ? $bl->fournisseurModel : null;
        $marche = $pv->marche;

        $logoPath = public_path('ofppt_header.png');
        $base64Logo = '';
        if (file_exists($logoPath)) {
            $base64Logo = 'data:image/png;base64,' . base64_encode(file_get_contents($logoPath));
        }

        // Build HTML for Word
        $html = '<html xmlns:o="urn:schemas-microsoft-com:office:office"
              xmlns:w="urn:schemas-microsoft-com:office:word"
              xmlns="http://www.w3.org/TR/REC-html40">
        <head><meta charset="utf-8"><title>PV Réception et Conformité</title>
        <style>
            @page { size: A4; margin: 2cm 1.5cm; }
            body { font-family: "Arial", sans-serif; font-size: 11pt; }
            table { width: 100%; border-collapse: collapse; }
            td, th { border: 1px solid black; padding: 5px; }
            .header-table td { border: none; padding: 2px; }
            .info-table td { border: none; padding: 8px 5px; font-weight: bold; font-style: italic; }
        </style>
        </head><body>';

        // Header banner
        $html .= '<div style="text-align: center; margin-bottom: 15px;">';
        if ($base64Logo) {
            $html .= '<img src="' . $base64Logo . '" style="height: 80px; max-width: 100%;">';
        }
        $html .= '</div>';

        // Direction and date
        $html .= '<table class="header-table" style="width: 100%; margin-bottom: 20px;"><tr>';
        $html .= '<td style="width: 50%;"><i>Direction Régionale Draa Tafilalet<br>CF Ouarzazate</i></td>';
        $html .= '<td style="width: 50%; text-align: right;"><i>Ouarzazate, le : ' . date('d/m/Y', strtotime($pv->date_reception)) . '</i></td>';
        $html .= '</tr></table>';

        // Title
        $html .= '<h3 style="text-align: center; text-decoration: underline; font-style: italic; margin-bottom: 30px;">PROCES – VERBAL DE RECEPTION ET DE CONFORMITE</h3>';

        // General info
        $bcRef = $bl->reference_bc ?? '';
        $blNum = $bl->numero_bl ?? '';
        $fournName = $fourn ? $fourn->raisonSociale : '';
        $objet = $marche->objet ?? 'Achat des produits alimentaires';

        $html .= '<table class="info-table" style="width: 100%; margin-bottom: 20px;">';
        $html .= '<tr><td style="width: 30%;">BC N°</td><td style="width: 70%;">: ' . $bcRef . '</td></tr>';
        $html .= '<tr><td>Date BC</td><td>: ' . ($bl->date_bc ?? date('d/m/Y', strtotime($bl->date_bl ?? now()))) . '</td></tr>';
        $html .= '<tr><td>BL N°</td><td>: ' . $blNum . '</td></tr>';
        $html .= '<tr><td>Objet</td><td>: ' . $objet . '</td></tr>';
        $html .= '<tr><td>Date BL</td><td>: ' . date('d/m/Y', strtotime($bl->date_bl ?? now())) . '</td></tr>';
        $html .= '<tr><td>Fournisseur</td><td>: ' . $fournName . '</td></tr>';
        $html .= '</table>';
        $html .= '<table>';
        $html .= '<tr style="background-color: #f0f0f0;">';
        $html .= '<th style="width: 8%; text-align: center;">N°</th>';
        $html .= '<th style="width: 32%;">DESIGNATION</th>';
        $html .= '<th style="width: 12%; text-align: center;">UNITÉ</th>';
        $html .= '<th style="width: 12%; text-align: center;">QTÉ</th>';
        $html .= '<th style="width: 16%; text-align: center;">CONFORMITÉ</th>';
        $html .= '<th style="width: 20%;">OBSERVATIONS</th>';
        $html .= '</tr>';

        foreach ($pv->pvConformites as $line) {
            $html .= '<tr style="height: 30px;">';
            $html .= '<td style="text-align: center;">' . $line->numero_ligne . '</td>';
            $html .= '<td>' . $line->designation . '</td>';
            $html .= '<td style="text-align: center;">' . $line->unite . '</td>';
            $html .= '<td style="text-align: center;">' . number_format($line->quantite, 2) . '</td>';
            $html .= '<td style="text-align: center;">' . $line->conformite . '</td>';
            $html .= '<td>' . ($line->observation ?? '') . '</td>';
            $html .= '</tr>';
        }

        $html .= '</table>';

        // Signature section
        $html .= '<br><br><table class="no-border" style="width: 100%;">';
        $html .= '<tr>';
        $html .= '<td style="width: 50%; text-align: center; padding-top: 30px;"><b>Le Responsable du Magasin</b><br><br><br><br></td>';
        $html .= '<td style="width: 50%; text-align: center; padding-top: 30px;"><b>Le Directeur</b><br><br><br><br></td>';
        $html .= '</tr></table>';

        // Footer
        $html .= '<br><table class="header-table" style="color: #666; font-size: 10pt; font-style: italic;"><tr>';
        $html .= '<td>OFPPT<br>Direction Régionale Draa Tafilalet</td>';
        $html .= '<td style="text-align: right;">ISBTP QUARTIER EL MATAR ERRACHIDIA<br>Tél (0535) 79.41.09</td>';
        $html .= '</tr></table>';

        $html .= '</body></html>';

        $filename = 'PV_Conformite_BC_' . str_replace('/', '_', $bcRef ?: 'Inconnu') . '.doc';

        return response($html)
            ->header('Content-Type', 'application/msword')
            ->header('Content-Disposition', 'attachment; filename="' . $filename . '"')
            ->header('Cache-Control', 'max-age=0');
    }

    /**
     * Delete all conformité lines for a given PV Reception.
     * DELETE /pv-receptions/{id}/conformites
     */
    public function destroy($pvReceptionId)
    {
        $pv = PvReception::findOrFail($pvReceptionId);
        $pv->pvConformites()->delete();

        return response()->json(['message' => 'PV de conformité supprimé avec succès.']);
    }
}
