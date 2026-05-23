<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Marche extends Model
{
    use HasFactory;

    protected $fillable = [
        'titulaire',
        'id_fournisseur',
        'date_debut',
        'date_fin',
        'budget',
        'consomme',
        'statut',
        'is_archived',
        'archived_at'
    ];

    protected $casts = [
        'is_archived' => 'boolean',
        'archived_at' => 'datetime',
        'date_debut' => 'date',
        'date_fin' => 'date',
    ];

    public function bordereauHeader()
    {
        return $this->hasOne(BordereauHeader::class, 'marche_id');
    }

    public function bonCommandes()
    {
        return $this->hasMany(BonCommande::class, 'marche_id');
    }

    public function bonLivraisons()
    {
        return $this->hasMany(BonLivraison::class, 'marche_id');
    }

    public function factures()
    {
        return $this->hasMany(Facture::class, 'marche_id');
    }

    public function attachmentsBc()
    {
        return $this->hasMany(AttachmentBc::class, 'marche_id');
    }

    public function fournisseur()
    {
        return $this->belongsTo(Fournisseur::class, 'id_fournisseur');
    }
}
