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
        Schema::create('pv_receptions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('marche_id')->nullable();
            $table->unsignedBigInteger('bon_livraison_id')->nullable();
            $table->date('date_reception')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pv_receptions');
    }
};
