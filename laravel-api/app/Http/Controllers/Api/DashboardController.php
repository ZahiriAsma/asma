<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Marche;
use App\Models\Stock;
use App\Models\BonCommande;
use App\Models\BonLivraison;
use App\Models\Fournisseur;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function stats(Request $request)
    {
        try {
            // 1. Marchés Actifs
            $activeMarchesCount = Marche::where('statut', 'En cours')->count();

            // 2. Produits en Stock
            $productsInStockCount = Stock::count();

            // 3. Fournisseurs
            $fournisseursCount = Fournisseur::count();

            // 4. Budget Consommé RÉEL par marché = SUM(total_ttc) des BL Validés
            $blConsommes = BonLivraison::select('marche_id', DB::raw('SUM(total_ttc) as montant_consomme'))
                ->where('statut', '!=', 'Annulé')
                ->whereNotNull('marche_id')
                ->groupBy('marche_id')
                ->pluck('montant_consomme', 'marche_id');

            // 5. Marché critique : celui dont le ratio (BL consommé / budget total) est le plus élevé
            $criticalAlert = null;
            $marchesAll   = Marche::where('budget', '>', 0)->get();
            $highestRatio = -1;

            foreach ($marchesAll as $marche) {
                $consomme = (float) ($blConsommes[$marche->id] ?? 0);
                $budget   = (float) $marche->budget;
                if ($budget > 0) {
                    $ratio = $consomme / $budget;
                    if ($ratio > $highestRatio) {
                        $highestRatio = $ratio;
                        $criticalAlert = [
                            'titulaire'  => $marche->titulaire,
                            'percentage' => round($ratio * 100, 1),
                            'consomme'   => $consomme,
                            'budget'     => $budget,
                        ];
                    }
                }
            }

            // 6 & 7. Statistiques des Marchés (Graphiques)
            $allMarches = Marche::all();
            $globalBudget = $allMarches->sum('budget');

            $marchesStats = $allMarches->map(function ($marche) use ($blConsommes, $globalBudget) {
                $budgetTotal = (float) $marche->budget;
                $budgetConsomme = (float) ($blConsommes[$marche->id] ?? 0);
                $budgetRestant = max(0, $budgetTotal - $budgetConsomme);
                
                $pctConsomme = $budgetTotal > 0 ? round(($budgetConsomme / $budgetTotal) * 100, 2) : 0;
                $pctGlobal = $globalBudget > 0 ? round(($budgetTotal / $globalBudget) * 100, 2) : 0;
                
                return [
                    'name'                 => $marche->titulaire ?? 'Marché #' . $marche->id,
                    'budget_total'         => $budgetTotal,
                    'budget_consomme'      => $budgetConsomme,
                    'budget_restant'       => $budgetRestant,
                    'pourcentage_consomme' => $pctConsomme,
                    'pourcentage_global'   => $pctGlobal,
                    'value'                => $budgetTotal // Pour le PieChart
                ];
            })->sortByDesc('budget_total')->values();

            $marchesChart = $marchesStats;
            $marchesDistribution = $marchesStats;
            $totalMarchesForPie = $globalBudget;

            // 8. Dernières Commandes (tableau du bas)
            $latestOrders = BonCommande::with(['marche', 'fournisseur'])
                ->orderBy('created_at', 'desc')
                ->take(5)
                ->get()
                ->map(function ($bc) {
                    return [
                        'id'          => $bc->numeroBC ?: 'BC #' . $bc->id,
                        'fournisseur' => $bc->fournisseur ? $bc->fournisseur->raisonSociale : 'Fournisseur Inconnu',
                        'marche'      => $bc->marche ? $bc->marche->titulaire : 'Marché Inconnu',
                        'montant'     => (float) $bc->montantTTC,
                        'statut'      => $bc->statut ?: 'En cours',
                    ];
                });

            return response()->json([
                'active_marches_count'    => $activeMarchesCount,
                'products_in_stock_count' => $productsInStockCount,
                'fournisseurs_count'      => $fournisseursCount,
                'critical_alert'          => $criticalAlert,
                'marches_chart'           => $marchesChart,
                'latest_orders'           => $latestOrders,
                'marches_distribution'    => $marchesDistribution,
                'total_marches_pie'       => $totalMarchesForPie,
            ], 200);

        } catch (\Exception $e) {
            return response()->json([
                'error'   => 'Erreur lors de la récupération des statistiques du Dashboard',
                'details' => $e->getMessage(),
            ], 500);
        }
    }
}
