<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Marche;
use App\Models\BonLivraison;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;

class MarcheController extends Controller
{
    public function index()
    {
        // Auto-archive only markets expired more than 3 years ago
        Marche::where('is_archived', false)
            ->whereDate('date_fin', '<', now()->subYears(3))
            ->update([
                'is_archived' => true,
                'archived_at' => now(),
                'statut' => 'Archivé'
            ]);

        // Calculate consumed amounts from validated BLs
        $blsValides = BonLivraison::where('statut', 'Validé')
            ->whereNotNull('marche_id')
            ->select('marche_id', DB::raw('SUM(total_ttc) as montant'))
            ->groupBy('marche_id')
            ->pluck('montant', 'marche_id');

        $marches = Marche::orderBy('created_at', 'desc')->get()->map(function($marche) use ($blsValides) {
            $consumedAmount = $blsValides[$marche->id] ?? 0;
            $budget = $marche->budget > 0 ? $marche->budget : 1;
            $progressPercent = min(100, round(($consumedAmount / $budget) * 100, 2));
            
            $marche->consomme_amount = $consumedAmount;
            $marche->progress_percent = $progressPercent;
            
            return $marche;
        });

        return response()->json($marches);
    }

    public function store(Request $request)
    {
        $request->validate([
            'titulaire' => 'required|string|max:255',
            'id_fournisseur' => 'required|integer',
        ]);

        $data = $request->all();
        
        // Auto-date logic
        $data['date_debut'] = now()->toDateString();
        $data['date_fin'] = now()->addYears(3)->toDateString();

        // Default values for mocked UI features
        if (!isset($data['budget'])) {
            $data['budget'] = rand(20000, 150000); // Random budget for demonstration
        }
        $data['consomme'] = 0; // Removed random generation, handled dynamically
        if (!isset($data['statut'])) {
            $data['statut'] = 'En cours';
        }

        $marche = Marche::create($data);

        return response()->json($marche, 201);
    }

    public function archive($id)
    {
        $marche = Marche::findOrFail($id);
        $marche->is_archived = true;
        $marche->archived_at = now();
        $marche->statut = 'Archivé';
        $marche->save();

        return response()->json(['message' => 'Marche archived successfully', 'marche' => $marche]);
    }
}
