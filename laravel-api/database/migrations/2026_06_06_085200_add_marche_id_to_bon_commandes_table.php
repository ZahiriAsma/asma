<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bon_commandes', function (Blueprint $table) {
            if (!Schema::hasColumn('bon_commandes', 'marche_id')) {
                $table->unsignedBigInteger('marche_id')->nullable()->after('id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('bon_commandes', function (Blueprint $table) {
            if (Schema::hasColumn('bon_commandes', 'marche_id')) {
                $table->dropColumn('marche_id');
            }
        });
    }
};
