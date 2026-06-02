<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PvReception extends Model
{
    use HasFactory;

    protected $fillable = [
        'marche_id',
        'bon_livraison_id',
        'date_reception'
    ];

    public function commissions()
    {
        return $this->hasMany(Commission::class);
    }

    public function bonLivraison()
    {
        return $this->belongsTo(BonLivraison::class, 'bon_livraison_id');
    }

    public function marche()
    {
        return $this->belongsTo(Marche::class, 'marche_id');
    }

    public function pvConformites()
    {
        return $this->hasMany(PvConformite::class);
    }
}
