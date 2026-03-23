$ErrorActionPreference = 'Stop'

$defaultUrl = 'amqp://mcp:discovery@127.0.0.1:5672'

if (-not $env:AMQP_INTEGRATION_URL) {
    $env:AMQP_INTEGRATION_URL = $defaultUrl
}

if (-not $env:AMQP_EXAMPLE_URL) {
    $env:AMQP_EXAMPLE_URL = $env:AMQP_INTEGRATION_URL
}

Write-Host "AMQP_INTEGRATION_URL=$($env:AMQP_INTEGRATION_URL)"
Write-Host "AMQP_EXAMPLE_URL=$($env:AMQP_EXAMPLE_URL)"
Write-Host 'Environment variables are set for the current PowerShell session.'
Write-Host 'Examples:'
Write-Host '  npm run test:integration'
Write-Host '  npm run example:rabbitmq'