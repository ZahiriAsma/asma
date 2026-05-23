<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AttachmentBc extends Model
{
    use HasFactory;

    protected $table = 'attachments_bc';

    protected $fillable = [
        'bon_livraison_id',
        'marche_id',
        'numero_attachment',
        'date_attachment',
        'budget',
        'exercice',
        'rubrique',
        'reference_marche',
        'lieu_livraison',
        'items'
    ];

    protected $casts = [
        'items' => 'array',
    ];

    public function bonLivraison()
    {
        return $this->belongsTo(BonLivraison::class, 'bon_livraison_id');
    }

    public function marche()
    {
        return $this->belongsTo(Marche::class, 'marche_id');
    }
}
