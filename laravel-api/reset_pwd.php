<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$user = \App\Models\User::firstOrCreate(
    ['email' => 'admin@gmail.com'],
    ['name' => 'Admin User']
);
$user->password = \Illuminate\Support\Facades\Hash::make('admin123');
$user->save();
echo "User " . $user->email . " password reset to admin123\n";
