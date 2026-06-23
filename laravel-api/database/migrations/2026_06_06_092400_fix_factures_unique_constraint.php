<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('factures', function (Blueprint $table) {
            // Drop the global unique constraint on numero_facture
            $table->dropUnique('factures_numero_facture_unique');

            // Add a composite unique constraint: unique per marche_id
            $table->unique(['marche_id', 'numero_facture'], 'factures_marche_numero_unique');
        });
    }

    public function down(): void
    {
        Schema::table('factures', function (Blueprint $table) {
            $table->dropUnique('factures_marche_numero_unique');
            $table->unique('numero_facture', 'factures_numero_facture_unique');
        });
    }
};
