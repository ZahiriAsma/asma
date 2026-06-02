<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Marche;
use App\Models\BonLivraison;
use App\Models\BonCommande;
use App\Models\Fournisseur;
use App\Models\Stock;
use Illuminate\Support\Facades\DB;

class ReportsController extends Controller
{
    public function stats()
    {
        try {
            // ─── 1. KPIs Globaux ────────────────────────────────────────────────────
            $totalMarches      = Marche::count();
            $marchesEnCours    = Marche::where('statut', 'En cours')->count();
            $budgetTotal       = Marche::sum('budget');

            $blsValides = BonLivraison::where('statut', 'Validé')
                ->whereNotNull('marche_id')
                ->select('marche_id', DB::raw('SUM(total_ttc) as montant'))
                ->groupBy('marche_id')
                ->pluck('montant', 'marche_id');

            $budgetConsomme = $blsValides->sum();
            $budgetRestant  = $budgetTotal - $budgetConsomme;
            $tauxConsomme   = $budgetTotal > 0 ? round(($budgetConsomme / $budgetTotal) * 100, 1) : 0;

            $totalBls  = BonLivraison::count();
            $blsValideCount = BonLivraison::where('statut', 'Validé')->count();
            $totalBcs  = BonCommande::count();
            $totalFournisseurs = Fournisseur::count();
            $totalProduits = Stock::count();

            // ─── 2. Marchés détail (Bar Chart avancement) ───────────────────────────
            $marchesDetail = Marche::orderBy('budget', 'desc')->get()->map(function ($m) use ($blsValides) {
                $budget   = (float) $m->budget;
                $consomme = (float) ($blsValides[$m->id] ?? 0);
                $restant  = max(0, $budget - $consomme);
                $taux     = $budget > 0 ? round(($consomme / $budget) * 100, 1) : 0;
                return [
                    'id'       => $m->id,
                    'name'     => $m->titulaire ?? 'Marché #' . $m->id,
                    'statut'   => $m->statut,
                    'budget'   => $budget,
                    'consomme' => $consomme,
                    'restant'  => $restant,
                    'taux'     => $taux,
                ];
            });

            // ─── 3. BLs par mois (Line Chart) ───────────────────────────────────────
            $blsParMois = BonLivraison::where('statut', 'Validé')
                ->selectRaw('DATE_FORMAT(date_bl, "%Y-%m") as mois, SUM(total_ttc) as total, COUNT(*) as nb')
                ->groupBy('mois')
                ->orderBy('mois', 'asc')
                ->get()
                ->map(fn($r) => [
                    'mois'  => $r->mois,
                    'total' => (float) $r->total,
                    'nb'    => $r->nb,
                ]);

            // ─── 4. Fournisseurs — nombre marchés + budget engagé ───────────────────
            $fournisseursStats = Fournisseur::all()->map(function ($f) use ($blsValides) {
                // Manually count marches for this fournisseur
                $marchesCount = Marche::where('id_fournisseur', $f->id)->count();
                // Budget total des marchés de ce fournisseur
                $budgetFourn = Marche::where('id_fournisseur', $f->id)->sum('budget');
                // BL consommés liés aux marchés de ce fournisseur
                $marcheIds = Marche::where('id_fournisseur', $f->id)->pluck('id');
                $consommeFourn = BonLivraison::where('statut', 'Validé')
                    ->whereIn('marche_id', $marcheIds)
                    ->sum('total_ttc');
                return [
                    'id'       => $f->id,
                    'name'     => $f->raisonSociale,
                    'marches'  => $marchesCount,
                    'budget'   => (float) $budgetFourn,
                    'consomme' => (float) $consommeFourn,
                ];
            })->sortByDesc('budget')->values();

            // ─── 5. Répartition marchés par statut (Pie) ────────────────────────────
            $repartitionStatut = Marche::selectRaw('statut, count(*) as total')
                ->groupBy('statut')
                ->get()
                ->map(fn($r) => ['name' => $r->statut ?: 'Autre', 'value' => (int) $r->total]);

            // ─── 6. Stock — top produits ─────────────────────────────────────────────
            $stockSummary = Stock::orderBy('designation')->get()->map(function ($s) {
                $available = (float) $s->quantite_initiale;
                return [
                    'designation' => $s->designation,
                    'unite'       => $s->unite,
                    'disponible'  => $available,
                ];
            });

            // ─── 7. Dernières livraisons validées ───────────────────────────────────
            $derniersBlsValides = BonLivraison::where('statut', 'Validé')
                ->with('fournisseurModel')
                ->orderBy('date_bl', 'desc')
                ->take(5)
                ->get()
                ->map(fn($bl) => [
                    'numero'     => $bl->numero_bl,
                    'date'       => $bl->date_bl,
                    'fournisseur'=> $bl->fournisseurModel?->raisonSociale ?? 'N/A',
                    'total_ttc'  => (float) $bl->total_ttc,
                    'marche_id'  => $bl->marche_id,
                ]);

            return response()->json([
                // KPIs
                'total_marches'       => $totalMarches,
                'marches_en_cours'    => $marchesEnCours,
                'budget_total'        => (float) $budgetTotal,
                'budget_consomme'     => (float) $budgetConsomme,
                'budget_restant'      => (float) $budgetRestant,
                'taux_consomme'       => $tauxConsomme,
                'total_bls'           => $totalBls,
                'bls_valides'         => $blsValideCount,
                'total_bcs'           => $totalBcs,
                'total_fournisseurs'  => $totalFournisseurs,
                'total_produits'      => $totalProduits,
                // Charts
                'marches_detail'      => $marchesDetail,
                'bls_par_mois'        => $blsParMois,
                'fournisseurs_stats'  => $fournisseursStats,
                'repartition_statut'  => $repartitionStatut,
                'stock_summary'       => $stockSummary,
                'derniers_bls'        => $derniersBlsValides,
            ], 200);

        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }
}
