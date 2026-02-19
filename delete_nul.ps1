$path = "D:\Dev\daniel-augusto-v2\nul"
$item = Get-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue
if ($item) {
    Write-Host "Found: $($item.FullName)"
    $item.Delete()
    Write-Host "Deleted successfully"
} else {
    Write-Host "File not found"
}
