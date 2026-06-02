<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PvConformite extends Model
{
    use HasFactory;

    protected $fillable = [
        'pv_reception_id',
        'numero_ligne',
        'price_number',
        'designation',
        'unite',
        'quantite',
        'conformite',
        'observation'
    ];

    public function pvReception()
    {
        return $this->belongsTo(PvReception::class, 'pv_reception_id');
    }
}
