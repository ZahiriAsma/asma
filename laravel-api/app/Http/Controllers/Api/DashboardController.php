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

            // 6. Tous les marchés triés par budget décroissant (Bar Chart + Pie Chart)
            $allMarches = Marche::where('budget', '>', 0)
                ->orderBy('budget', 'desc')
                ->get()
                ->map(function ($marche) use ($blConsommes) {
                    return [
                        'id'              => $marche->id,
                        'name'            => $marche->titulaire ?? 'Marché #' . $marche->id,
                        'budget_total'    => (float) $marche->budget,
                        'budget_consomme' => (float) ($blConsommes[$marche->id] ?? 0),
                        'statut'          => $marche->statut,
                    ];
                });

            $grandTotal = $allMarches->sum('budget_total');

            // Ajouter le pourcentage pour le Pie Chart
            $marchesWithPercent = $allMarches->map(function ($m) use ($grandTotal) {
                return array_merge($m, [
                    'percentage' => $grandTotal > 0 ? round(($m['budget_total'] / $grandTotal) * 100, 1) : 0,
                ]);
            });

            // Répartition par statut (Donut secondaire)
            $marchesDistribution = Marche::select('statut', DB::raw('count(*) as total'))
                ->groupBy('statut')
                ->get()
                ->map(function ($item) {
                    return [
                        'name'  => $item->statut ?: 'Autre',
                        'value' => $item->total,
                    ];
                });
            $totalMarchesForPie = $marchesDistribution->sum('value');

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
                'marches_chart'           => $marchesWithPercent,   // Bar Chart (tous les marchés triés budget DESC)
                'marches_pie'             => $marchesWithPercent,    // Pie Chart (mêmes données)
                'grand_total_budget'      => $grandTotal,
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
