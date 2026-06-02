<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\MarcheController;

Route::post('/login',           [AuthController::class, 'login']);
Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
Route::post('/reset-password',  [AuthController::class, 'resetPassword']);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user',     [AuthController::class, 'user']);
    Route::put('/user/profile', [AuthController::class, 'updateProfile']);
    Route::post('/logout',  [AuthController::class, 'logout']);

    // Marches routes
    Route::get('/marches', [MarcheController::class, 'index']);
    Route::post('/marches', [MarcheController::class, 'store']);
    Route::post('/marches/{id}/archive', [MarcheController::class, 'archive']);

    // Fournisseurs routes
    Route::apiResource('fournisseurs', \App\Http\Controllers\Api\FournisseurController::class);

    // Menus routes
    Route::apiResource('menus', \App\Http\Controllers\Api\DailyMenuController::class);
    Route::get('/bon-commandes/{id}/export', [\App\Http\Controllers\Api\BonCommandeController::class, 'export']);
    Route::apiResource('bon-commandes', \App\Http\Controllers\Api\BonCommandeController::class);
    Route::get('/bons-livraison/{id}/export', [\App\Http\Controllers\Api\BonLivraisonController::class, 'export']);
    Route::apiResource('bons-livraison', \App\Http\Controllers\Api\BonLivraisonController::class);

    // Bordereau routes
    Route::get('/bordereau', [\App\Http\Controllers\Api\BordereauController::class, 'index']);
    Route::post('/bordereau/import', [\App\Http\Controllers\Api\BordereauController::class, 'import']);
    Route::get('/bordereau/{id}', [\App\Http\Controllers\Api\BordereauController::class, 'show']);
    Route::delete('/bordereau/{id}', [\App\Http\Controllers\Api\BordereauController::class, 'destroy']);

    // Factures routes
    Route::get('/factures/{id}/export', [\App\Http\Controllers\FactureController::class, 'export']);
    Route::apiResource('factures', \App\Http\Controllers\FactureController::class);

    // Attachment BC routes
    Route::get('/attachments-bc/{id}/export', [\App\Http\Controllers\Api\AttachmentBcController::class, 'export']);
    Route::apiResource('attachments-bc', \App\Http\Controllers\Api\AttachmentBcController::class);

    // PV Reception routes
    Route::get('/pv-receptions/{id}/export', [\App\Http\Controllers\Api\PvReceptionController::class, 'export']);
    Route::apiResource('pv-receptions', \App\Http\Controllers\Api\PvReceptionController::class);

    // PV Conformité routes
    Route::get('/pv-receptions/{id}/conformites', [\App\Http\Controllers\Api\PvConformiteController::class, 'index']);
    Route::post('/pv-receptions/{id}/conformites/generate', [\App\Http\Controllers\Api\PvConformiteController::class, 'generate']);
    Route::post('/pv-receptions/{id}/conformites', [\App\Http\Controllers\Api\PvConformiteController::class, 'store']);
    Route::put('/pv-receptions/{id}/conformites', [\App\Http\Controllers\Api\PvConformiteController::class, 'update']);
    Route::delete('/pv-receptions/{id}/conformites', [\App\Http\Controllers\Api\PvConformiteController::class, 'destroy']);
    Route::get('/pv-receptions/{id}/conformites/export', [\App\Http\Controllers\Api\PvConformiteController::class, 'export']);

    // Technical Sheets routes
    Route::get('/technical-sheets', [\App\Http\Controllers\TechnicalSheetController::class, 'index']);
    Route::post('/technical-sheets', [\App\Http\Controllers\TechnicalSheetController::class, 'store']);
    Route::delete('/technical-sheets/{id}', [\App\Http\Controllers\TechnicalSheetController::class, 'destroy']);
    Route::get('/technical-sheets/ingredients', [\App\Http\Controllers\TechnicalSheetController::class, 'allIngredients']);
    Route::get('/technical-sheets/bordereau-headers', [\App\Http\Controllers\TechnicalSheetController::class, 'bordereauHeaders']);

    // Stock Routes
    Route::get('/stocks', [\App\Http\Controllers\Api\StockController::class, 'index']);
    Route::get('/stocks/export', [\App\Http\Controllers\Api\StockController::class, 'export']);

    // Dashboard Route
    Route::get('/dashboard/stats', [\App\Http\Controllers\Api\DashboardController::class, 'stats']);
});
