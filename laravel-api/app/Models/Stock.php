<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Stock extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected $casts = [
        'last_entry_date' => 'date',
        'quantite_initiale' => 'decimal:3',
    ];
}
