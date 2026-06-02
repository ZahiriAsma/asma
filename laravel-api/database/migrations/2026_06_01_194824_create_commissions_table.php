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
        Schema::create('commissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pv_reception_id')->constrained()->onDelete('cascade');
            $table->string('nom_prenom');
            $table->string('fonction');
            $table->string('signature')->nullable();
            $table->enum('role', ['President', 'Membre', 'Rapporteur'])->default('Membre');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('commissions');
    }
};
