<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Marche;
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

        return response()->json(Marche::orderBy('created_at', 'desc')->get());
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
        if (!isset($data['consomme'])) {
            $data['consomme'] = rand(0, 100); // Random consumption percentage
        }
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
