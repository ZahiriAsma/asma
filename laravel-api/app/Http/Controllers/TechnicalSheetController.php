<?php

namespace App\Http\Controllers;

use App\Models\TechnicalSheet;
use App\Models\Bordereau;
use App\Models\BordereauHeader;
use Illuminate\Http\Request;
use App\Services\NotificationService;

class TechnicalSheetController extends Controller
{
    public function index(Request $request)
    {
        $request->validate([
            'date' => 'required|date',
        ]);

        $sheets = TechnicalSheet::with('bordereau.header')
            ->where('date', $request->date)
            ->get();

        if ($sheets->isEmpty() && $request->query('fallback_latest')) {
            // Find the most recent date with technical sheets
            $latestDate = TechnicalSheet::where('date', '<', $request->date)
                ->orderBy('date', 'desc')
                ->value('date');

            if ($latestDate) {
                // Get the sheets for that date and format them as cloned
                $sheets = TechnicalSheet::with('bordereau.header')
                    ->where('date', $latestDate->format('Y-m-d'))
                    ->get()
                    ->map(function ($sheet) {
                        $sheet->is_cloned = true;
                        $sheet->cloned_from_date = $sheet->date->format('Y-m-d');
                        return $sheet;
                    });
            }
        }

        return response()->json($sheets);
    }

    /**
     * Get ALL bordereau items from ALL bordereaux, grouped by header,
     * with each item carrying its header name for frontend display.
     */
    public function allIngredients(Request $request)
    {
        $query = Bordereau::with('header')
            ->orderBy('bordereau_header_id')
            ->orderBy('price_number', 'asc');

        // Optional search filter
        if ($request->has('search') && $request->search) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('service_description', 'like', "%{$search}%")
                  ->orWhere('price_number', 'like', "%{$search}%");
            });
        }

        // Optional filter by bordereau_header_id
        if ($request->has('bordereau_header_id') && $request->bordereau_header_id) {
            $query->where('bordereau_header_id', $request->bordereau_header_id);
        }

        $items = $query->get()->map(function ($item) {
            return [
                'id' => $item->id,
                'price_number' => $item->price_number,
                'service_description' => $item->service_description,
                'unit_of_measure' => $item->unit_of_measure,
                'unit_price_ht' => $item->unit_price_ht,
                'vat_rate' => $item->vat_rate,
                'minimum_quantity' => $item->minimum_quantity,
                'maximum_quantity' => $item->maximum_quantity,
                'bordereau_header_id' => $item->bordereau_header_id,
                'bordereau_name' => $item->header?->market_name ?? 'Bordereau #' . $item->bordereau_header_id,
            ];
        });

        return response()->json($items);
    }

    /**
     * Get all bordereau headers (for filter dropdown)
     */
    public function bordereauHeaders()
    {
        $headers = BordereauHeader::select('id', 'market_name', 'created_at')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($headers);
    }

    public function store(Request $request)
    {
        // Support batch saving of items under 'items' key
        if ($request->has('items') && is_array($request->items)) {
            $saved = [];
            // To handle removal of items not in the payload but in the same meal type,
            // we first gather the list of meals we are updating
            $dates = collect($request->items)->pluck('date')->unique();
            $mealTypes = collect($request->items)->pluck('meal_type')->unique();

            // Then we'll clear out the old records for these meal types/dates and just insert the new ones
            // This is easier for a full sync per day.
            // But wait, it's better to delete by ID if they pass IDs.
            // Let's just do updateOrCreate based on a unique identifier (like ID if it exists, or insert new)
            // Or simpler: the frontend will just send the full state for a meal, and we can delete the old ones.
            // The safest is for the frontend to manage deletions via destroy(), and we just updateOrCreate here.
            
            foreach ($request->items as $itemData) {
                // If the item has an ID (and it's not a temp_ ID), use it to update
                $matchAttributes = [
                    'date' => $itemData['date'],
                    'meal_type' => $itemData['meal_type'],
                    'bordereau_id' => $itemData['bordereau_id'],
                    'plat_name' => $itemData['plat_name'] ?? null,
                ];

                if (isset($itemData['id']) && is_numeric($itemData['id'])) {
                    $matchAttributes = ['id' => $itemData['id']];
                }

                $sheet = TechnicalSheet::updateOrCreate(
                    $matchAttributes,
                    [
                        'date' => $itemData['date'],
                        'meal_type' => $itemData['meal_type'],
                        'bordereau_id' => $itemData['bordereau_id'],
                        'plat_name' => $itemData['plat_name'] ?? null,
                        'max_quantity' => $itemData['max_quantity'] ?? 0,
                        'max_people' => $itemData['max_people'] ?? 450,
                        'quantity_per_person' => $itemData['quantity_per_person'] ?? 0,
                        'present_people' => $itemData['present_people'],
                        'calculated_quantity' => $itemData['calculated_quantity'],
                        'r' => $itemData['r'] ?? 1.0000,
                        'pu_r' => $itemData['pu_r'],
                        'amount' => $itemData['amount'],
                    ]
                );
                $saved[] = $sheet;
            }

            $notificationService = new NotificationService();
            foreach ($dates as $d) {
                $notificationService->checkStockForTechnicalSheets($d);
                $notificationService->checkDailyCost($d);
            }

            return response()->json($saved);
        }

        $request->validate([
            'date' => 'required|date',
            'meal_type' => 'required|string',
            'bordereau_id' => 'required|exists:bordereau,id',
            'present_people' => 'required|integer',
            'quantity_per_person' => 'required|numeric',
            'calculated_quantity' => 'required|numeric',
            'r' => 'required|numeric',
            'pu_r' => 'required|numeric',
            'amount' => 'required|numeric',
        ]);

        // We can either update or create
        $sheet = TechnicalSheet::updateOrCreate(
            [
                'date' => $request->date,
                'meal_type' => $request->meal_type,
                'bordereau_id' => $request->bordereau_id,
                'plat_name' => $request->plat_name,
            ],
            [
                'quantity_per_person' => $request->quantity_per_person,
                'max_quantity' => $request->max_quantity ?? 0,
                'max_people' => $request->max_people ?? 450,
                'present_people' => $request->present_people,
                'calculated_quantity' => $request->calculated_quantity,
                'r' => $request->r,
                'pu_r' => $request->pu_r,
                'amount' => $request->amount,
            ]
        );

        $notificationService = new NotificationService();
        $notificationService->checkStockForTechnicalSheets($request->date);
        $notificationService->checkDailyCost($request->date);

        return response()->json($sheet);
    }

    public function destroy($id)
    {
        $sheet = TechnicalSheet::findOrFail($id);
        $sheet->delete();
        
        return response()->json(['message' => 'Deleted successfully']);
    }
}
