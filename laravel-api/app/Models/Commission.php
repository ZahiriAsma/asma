<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Commission extends Model
{
    use HasFactory;

    protected $fillable = [
        'pv_reception_id',
        'nom_prenom',
        'fonction',
        'signature',
        'role'
    ];

    public function pvReception()
    {
        return $this->belongsTo(PvReception::class);
    }
}
