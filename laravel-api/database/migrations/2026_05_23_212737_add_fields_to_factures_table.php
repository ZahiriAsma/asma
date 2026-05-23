<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('factures', function (Blueprint $table) {
            $table->string('reference_bc')->nullable();
            $table->string('site_livraison')->nullable();
            $table->string('montant_lettres')->nullable();
            $table->decimal('tva_9', 15, 2)->default(0);
            $table->decimal('tva_10', 15, 2)->default(0);
            $table->decimal('tva_20', 15, 2)->default(0);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('factures', function (Blueprint $table) {
            $table->dropColumn(['reference_bc', 'site_livraison', 'montant_lettres', 'tva_9', 'tva_10', 'tva_20']);
        });
    }
};
