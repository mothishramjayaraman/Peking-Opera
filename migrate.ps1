# Learning Paths Migration Script
# Run this script to migrate your database

Write-Host "🚀 Learning Paths Database Migration" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

$dbUrl = "postgresql://postgres:tiger@localhost:5432/singingai"
$migrationFile = "migrations\simple_migration.sql"

Write-Host "📋 Migration Details:" -ForegroundColor Yellow
Write-Host "  - Database: $dbUrl"
Write-Host "  - Migration File: $migrationFile"
Write-Host ""

# Check if psql is available
$psqlPath = Get-Command psql -ErrorAction SilentlyContinue

if (-not $psqlPath) {
    Write-Host "❌ Error: psql command not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install PostgreSQL client tools or add psql to your PATH." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Alternative: Run the SQL manually in pgAdmin or your database tool." -ForegroundColor Yellow
    Write-Host "SQL file location: $migrationFile" -ForegroundColor Cyan
    exit 1
}

Write-Host "✅ Found psql at: $($psqlPath.Source)" -ForegroundColor Green
Write-Host ""

# Run the migration
Write-Host "🔄 Running migration..." -ForegroundColor Yellow
Write-Host ""

try {
    psql $dbUrl -f $migrationFile
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Migration completed successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "📝 Next steps:" -ForegroundColor Cyan
        Write-Host "  1. Run: npm run db:seed" -ForegroundColor White
        Write-Host "  2. Visit: http://localhost:5000/learning-paths" -ForegroundColor White
        Write-Host ""
    } else {
        Write-Host ""
        Write-Host "⚠️  Migration completed with warnings" -ForegroundColor Yellow
        Write-Host "Check the output above for details." -ForegroundColor Yellow
        Write-Host ""
    }
} catch {
    Write-Host ""
    Write-Host "❌ Migration failed!" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Troubleshooting:" -ForegroundColor Yellow
    Write-Host "  1. Check if PostgreSQL is running" -ForegroundColor White
    Write-Host "  2. Verify database connection: psql $dbUrl" -ForegroundColor White
    Write-Host "  3. Check DATABASE_URL in .env file" -ForegroundColor White
    Write-Host ""
    exit 1
}
