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
        Schema::table('attachments_bc', function (Blueprint $table) {
            // Ajouter marche_id si absent
            if (!Schema::hasColumn('attachments_bc', 'marche_id')) {
                $table->unsignedBigInteger('marche_id')->nullable()->after('bon_livraison_id');
            }
            // Ajouter date_attachment si absent
            if (!Schema::hasColumn('attachments_bc', 'date_attachment')) {
                $table->date('date_attachment')->nullable()->after('marche_id');
            }
            // Ajouter items (JSON) si absent
            if (!Schema::hasColumn('attachments_bc', 'items')) {
                $table->json('items')->nullable()->after('lieu_livraison');
            }
            // Supprimer les anciennes colonnes individuelles si elles existent
            if (Schema::hasColumn('attachments_bc', 'numero_article')) {
                $table->dropColumn('numero_article');
            }
            if (Schema::hasColumn('attachments_bc', 'designation')) {
                $table->dropColumn('designation');
            }
            if (Schema::hasColumn('attachments_bc', 'unite')) {
                $table->dropColumn('unite');
            }
            if (Schema::hasColumn('attachments_bc', 'quantite')) {
                $table->dropColumn('quantite');
            }
            if (Schema::hasColumn('attachments_bc', 'taux_tva')) {
                $table->dropColumn('taux_tva');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('attachments_bc', function (Blueprint $table) {
            if (Schema::hasColumn('attachments_bc', 'marche_id')) {
                $table->dropColumn('marche_id');
            }
            if (Schema::hasColumn('attachments_bc', 'date_attachment')) {
                $table->dropColumn('date_attachment');
            }
            if (Schema::hasColumn('attachments_bc', 'items')) {
                $table->dropColumn('items');
            }
            // Restaurer les anciennes colonnes
            $table->integer('numero_article')->nullable();
            $table->text('designation')->nullable();
            $table->string('unite')->nullable();
            $table->integer('quantite')->nullable();
            $table->decimal('taux_tva', 5, 2)->nullable();
        });
    }
};
