<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('pv_conformites');
        Schema::create('pv_conformites', function (Blueprint $table) {
            $table->id();

            $table->foreignId('pv_reception_id')
                  ->constrained()
                  ->onDelete('cascade');

            $table->integer('numero_ligne')->nullable();

            $table->string('designation');
            $table->string('unite');

            $table->decimal('quantite', 10, 2);

            $table->enum('conformite', [
                'Conforme',
                'Non Conforme'
            ])->default('Conforme');

            $table->text('observation')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pv_conformites');
    }
};
