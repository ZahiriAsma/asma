<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bons_livraison', function (Blueprint $table) {
            if (!Schema::hasColumn('bons_livraison', 'marche_id')) {
                $table->unsignedBigInteger('marche_id')->nullable()->after('id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('bons_livraison', function (Blueprint $table) {
            if (Schema::hasColumn('bons_livraison', 'marche_id')) {
                $table->dropColumn('marche_id');
            }
        });
    }
};
