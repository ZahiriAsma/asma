<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pv_conformites', function (Blueprint $table) {
            $table->string('price_number')->nullable()->after('numero_ligne');
        });
    }

    public function down(): void
    {
        Schema::table('pv_conformites', function (Blueprint $table) {
            $table->dropColumn('price_number');
        });
    }
};
