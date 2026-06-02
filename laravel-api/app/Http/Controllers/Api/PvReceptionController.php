<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PvReception;
use App\Models\Commission;
use Illuminate\Http\Request;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;

class PvReceptionController extends Controller
{
    public function index()
    {
        return response()->json(PvReception::with(['commissions', 'bonLivraison', 'marche', 'pvConformites'])->get());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'marche_id' => 'required|exists:marches,id',
            'bon_livraison_id' => 'required|exists:bons_livraison,id',
            'date_reception' => 'required|date',
            'commissions' => 'nullable|array',
            'commissions.*.nom_prenom' => 'required|string',
            'commissions.*.fonction' => 'required|string',
            'commissions.*.role' => 'required|string|in:President,Membre,Rapporteur'
        ]);

        $pv = PvReception::create([
            'marche_id' => $validated['marche_id'],
            'bon_livraison_id' => $validated['bon_livraison_id'],
            'date_reception' => $validated['date_reception']
        ]);

        if (!empty($validated['commissions'])) {
            foreach ($validated['commissions'] as $member) {
                $pv->commissions()->create([
                    'nom_prenom' => $member['nom_prenom'],
                    'fonction' => $member['fonction'],
                    'role' => $member['role']
                ]);
            }
        }

        return response()->json($pv->load(['commissions', 'bonLivraison', 'marche']), 201);
    }

    public function show($id)
    {
        $pv = PvReception::with(['commissions', 'bonLivraison', 'marche'])->findOrFail($id);
        return response()->json($pv);
    }

    public function update(Request $request, $id)
    {
        $pv = PvReception::findOrFail($id);

        $validated = $request->validate([
            'marche_id' => 'required|exists:marches,id',
            'bon_livraison_id' => 'required|exists:bons_livraison,id',
            'date_reception' => 'required|date',
            'commissions' => 'nullable|array',
            'commissions.*.nom_prenom' => 'required|string',
            'commissions.*.fonction' => 'required|string',
            'commissions.*.role' => 'required|string|in:President,Membre,Rapporteur'
        ]);

        $pv->update([
            'marche_id' => $validated['marche_id'],
            'bon_livraison_id' => $validated['bon_livraison_id'],
            'date_reception' => $validated['date_reception']
        ]);

        // Delete existing and recreate
        $pv->commissions()->delete();

        if (!empty($validated['commissions'])) {
            foreach ($validated['commissions'] as $member) {
                $pv->commissions()->create([
                    'nom_prenom' => $member['nom_prenom'],
                    'fonction' => $member['fonction'],
                    'role' => $member['role']
                ]);
            }
        }

        return response()->json($pv->load(['commissions', 'bonLivraison', 'marche']));
    }

    public function destroy($id)
    {
        $pv = PvReception::findOrFail($id);
        $pv->delete();
        return response()->json(['message' => 'PV supprimé avec succès']);
    }

    public function export($id)
    {
        $pv = PvReception::with(['commissions', 'bonLivraison', 'marche'])->findOrFail($id);
        $bl = $pv->bonLivraison;
        $fourn = clone $bl ? $bl->fournisseurModel : null;
        $marche = $pv->marche;

        $logoPath = public_path('ofppt_banner.png');
        $base64Logo = '';
        if (file_exists($logoPath)) {
            $base64Logo = 'data:image/png;base64,' . base64_encode(file_get_contents($logoPath));
        }

        // Generate HTML
        $html = '<html xmlns:o="urn:schemas-microsoft-com:office:office"
              xmlns:w="urn:schemas-microsoft-com:office:word"
              xmlns="http://www.w3.org/TR/REC-html40">
        <head><meta charset="utf-8"><title>PV Reception</title>
        <style>
            body { font-family: "Arial", sans-serif; font-size: 11pt; }
            table { width: 100%; border-collapse: collapse; }
            td, th { border: 1px solid black; padding: 5px; }
            .header-table td { border: none; }
        </style>
        </head><body>';
        
        $html .= '<div style="text-align: center; margin-bottom: 20px;">';
        if ($base64Logo) {
            $html .= '<img src="' . $base64Logo . '" style="height: 60px; max-width: 100%;">';
        }
        $html .= '</div>';

        $html .= '<br><table class="header-table" style="width: 100%;"><tr>';
        $html .= '<td style="width: 50%;"><i>Direction Régionale Draa Tafilalet<br>CF Ouarzazate</i></td>';
        $html .= '<td style="width: 50%; text-align: right;"><i>Ouarzazate, le : ' . date('d/m/Y', strtotime($pv->date_reception)) . '</i></td>';
        $html .= '</tr></table>';

        $html .= '<br><br><h2 style="text-align: center; text-decoration: underline;">PROCES – VERBAL DE RECEPTION</h2><br>';

        $html .= '<p><b><i>BC N° :</i></b> ' . ($bl->reference_bc ?? '') . '<br>';
        $html .= '<b><i>Rubrique :</i></b> ' . ($bl->rubrique ?? 'Produits alimentaires') . '<br>';
        $html .= '<b><i>FOURNISSEUR :</i></b> ' . ($fourn->raisonSociale ?? '') . '<br>';
        $html .= '<u><b><i>Objet :</i></b></u> ' . ($marche->titulaire ?? 'Achat des produits alimentaires') . '<br></p>';

        $html .= '<p><b><i>Prestations Réceptionnées : Voir Bon Commande N° ' . ($bl->reference_bc ?? '') . ',</i></b></p>';

        $html .= '<p style="text-indent: 50px; text-align: justify; font-style: italic;">Nous soussignés membre de la commission reconnaissons que les prestations ci-dessus ont été exécutées par la société "' . ($fourn->raisonSociale ?? '') . '" conformément aux prescriptions et aux conditions précisées du Bon de commande N° ' . ($bl->reference_bc ?? '') . '.</p>';

        $html .= '<br><p><u><b><i>Membres de la commission :</i></b></u></p>';

        $html .= '<table><tr><th style="width:40%;">Nom et Prénom</th><th style="width:30%;">FONCTION</th><th style="width:30%;">SIGNATURE</th></tr>';

        foreach ($pv->commissions as $comm) {
            $roleLabel = ($comm->role === 'President' || $comm->role === 'Rapporteur') ? $comm->role : 'Membre';
            $html .= '<tr style="height: 40px;">';
            $html .= '<td><i>Mr. ' . $comm->nom_prenom . '</i></td>';
            $html .= '<td><i>' . $comm->fonction . ' (' . $roleLabel . ')</i></td>';
            $html .= '<td></td>';
            $html .= '</tr>';
        }

        $html .= '</table>';

        $html .= '<br><br><table class="header-table" style="color: #666; font-size: 10pt; font-style: italic;"><tr>';
        $html .= '<td>OFPPT<br>Direction Régionale Draa Tafilalet</td>';
        $html .= '<td style="text-align: right;">ISBTP QUARTIER EL MATAR ERRACHIDIA<br>Tél (0535) 79.41.09</td>';
        $html .= '</tr></table>';

        $html .= '</body></html>';

        $filename = 'PV_Reception_BC_' . str_replace('/', '_', $bl->reference_bc ?? 'Inconnu') . '.doc';

        return response($html)
            ->header('Content-Type', 'application/msword')
            ->header('Content-Disposition', 'attachment; filename="' . $filename . '"')
            ->header('Cache-Control', 'max-age=0');
    }
}
