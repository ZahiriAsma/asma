<?php

namespace App\Services;

use App\Models\Notification;
use App\Models\TechnicalSheet;
use App\Http\Controllers\Api\StockController;

class NotificationService
{
    /**
     * Règle 1: Stock Insuffisant
     * Lors de la validation d'une Fiche Technique, on compare les quantités nécessaires
     * avec le stock restant (quantite_restante).
     */
    public function checkStockForTechnicalSheets($date)
    {
        // 1. Calculate total required for each ingredient for the given date
        $sheets = TechnicalSheet::with('bordereau')
            ->where('date', $date)
            ->get();

        $requiredQuantities = [];
        foreach ($sheets as $sheet) {
            if (!$sheet->bordereau) continue;
            
            $designation = trim($sheet->bordereau->service_description);
            $key = strtolower($designation);
            $unite = trim($sheet->bordereau->unit_of_measure);
            
            if (!isset($requiredQuantities[$key])) {
                $requiredQuantities[$key] = [
                    'designation' => $designation,
                    'unite' => $unite,
                    'qty' => 0
                ];
            }
            $requiredQuantities[$key]['qty'] += (float) $sheet->calculated_quantity;
        }

        if (empty($requiredQuantities)) return;

        // 2. Get current stock remaining using StockController logic
        $stockController = new StockController();
        $stockResponse = $stockController->index();
        $stocks = json_decode($stockResponse->getContent(), true);

        // Create an associative array for quick lookup
        $stockMap = [];
        foreach ($stocks as $stock) {
            $key = strtolower(trim($stock['designation']));
            $stockMap[$key] = $stock['quantite_restante'];
        }

        // 3. Compare and generate notifications
        foreach ($requiredQuantities as $key => $req) {
            $needed = $req['qty'];
            $available = $stockMap[$key] ?? 0;

            if ($available < $needed) {
                $manque = $needed - $available;
                $title = 'Stock insuffisant - ' . $req['designation'];
                $message = "Stock insuffisant pour le produit {$req['designation']}.\n"
                         . "Disponible : " . round($available, 2) . " {$req['unite']}\n"
                         . "Nécessaire : " . round($needed, 2) . " {$req['unite']}\n"
                         . "Manque : " . round($manque, 2) . " {$req['unite']}";

                // Check if a similar notification already exists for this date to avoid duplicates
                $exists = Notification::where('title', $title)
                            ->whereDate('created_at', now()->toDateString())
                            ->exists();

                if (!$exists) {
                    Notification::create([
                        'title' => $title,
                        'message' => $message,
                        'type' => 'alert',
                        'tab' => 'stock'
                    ]);
                }
            }
        }
    }

    /**
     * Règle 2: Coût Journalier Dépassé
     * Calculer la somme totale des montants de la journée / Nombre de personnes.
     * Si > 25 DH, on génère une notification.
     */
    public function checkDailyCost($date)
    {
        $sheets = TechnicalSheet::where('date', $date)->get();
        if ($sheets->isEmpty()) return;

        $totalAmount = $sheets->sum('amount');
        
        // Find max people for the day (usually residents count is same across meals)
        $peopleCount = $sheets->max('present_people');
        
        if ($peopleCount > 0) {
            $costPerPerson = $totalAmount / $peopleCount;

            if ($costPerPerson > 25) {
                $title = 'Alerte Coût Journalier Dépassé (' . $date . ')';
                $message = "Attention : le coût journalier par personne dépasse le seuil autorisé.\n"
                         . "Coût actuel : " . round($costPerPerson, 2) . " DH\n"
                         . "Seuil maximum : 25 DH\n"
                         . "Montant Total : " . round($totalAmount, 2) . " DH pour " . $peopleCount . " personnes.";

                // Avoid duplicate for the same date
                $exists = Notification::where('title', $title)->exists();

                if (!$exists) {
                    Notification::create([
                        'title' => $title,
                        'message' => $message,
                        'type' => 'alert',
                        'tab' => 'menus'
                    ]);
                }
            }
        }
    }
}
