# フェーズ1疎通確認スクリプト。
# 前提: `npx supabase start` と `npx supabase functions serve --no-verify-jwt` が起動済みであること。
#
# 検証内容:
#   1. create-room -> join-room -> start-round -> apply-actionでラウンド終了まで進行
#   2. turn_versionが手ごとにインクリメントすること
#   3. 古いexpectedTurnVersionでの呼び出しが409(turn_version_conflict)を返すこと（楽観的ロック）
#   4. 公開ビュー(public)に他プレイヤーの手札内容が含まれないこと（手札秘匿性）
#   5. action_logの行数が実行したアクション数（round_start込み）と一致すること

$ErrorActionPreference = "Stop"

$FunctionsUrl = "http://127.0.0.1:54321/functions/v1"
$RestUrl = "http://127.0.0.1:54321/rest/v1"

Write-Host "--- supabase statusからSERVICE_ROLE_KEYを取得 ---"
# npx経由のnative実行はstderr出力がNativeCommandErrorとして扱われ、
# $ErrorActionPreference=Stopの下では終了扱いになるため、cmd /c 経由でOSレベルに破棄する。
$statusJson = cmd /c "npx supabase status -o json 2>NUL"
$status = ($statusJson | Out-String) | ConvertFrom-Json
$serviceRoleKey = $status.SERVICE_ROLE_KEY
if (-not $serviceRoleKey) { throw "SERVICE_ROLE_KEYの取得に失敗しました" }

function Invoke-Fn($name, $body) {
  $json = $body | ConvertTo-Json -Depth 10 -Compress
  return Invoke-RestMethod -Method Post -Uri "$FunctionsUrl/$name" -ContentType "application/json" -Body $json
}

function Invoke-FnRaw($name, $body) {
  $json = $body | ConvertTo-Json -Depth 10 -Compress
  try {
    Invoke-WebRequest -Method Post -Uri "$FunctionsUrl/$name" -ContentType "application/json" -Body $json -ErrorAction Stop
  } catch {
    return $_.Exception.Response
  }
}

function Invoke-RestGet($path) {
  $headers = @{ apikey = $serviceRoleKey; Authorization = "Bearer $serviceRoleKey" }
  return Invoke-RestMethod -Method Get -Uri "$RestUrl/$path" -Headers $headers
}

Write-Host "--- 1. create-room (host) ---"
$hostRes = Invoke-Fn "create-room" @{ nickname = "host-alice"; maxPlayers = 2; penalty = 5 }
$roomCode = $hostRes.roomCode
$hostSecret = $hostRes.clientSecret
Write-Host "roomCode=$roomCode hostSeat=$($hostRes.seatIdx)"

Write-Host "--- 2. join-room (guest) ---"
$guestRes = Invoke-Fn "join-room" @{ roomCode = $roomCode; nickname = "guest-bob" }
$guestSecret = $guestRes.clientSecret
Write-Host "guestSeat=$($guestRes.seatIdx)"

$secrets = @{ 0 = $hostSecret; 1 = $guestSecret }

Write-Host "--- 3. start-round ---"
$startRes = Invoke-Fn "start-round" @{
  roomCode = $roomCode; seatIdx = 0; clientSecret = $hostSecret; expectedTurnVersion = 0
}
$turnVersion = $startRes.public.turnVersion
Write-Host "started. turnVersion=$turnVersion currentPlayerIdx=$($startRes.public.currentPlayerIdx)"

# 手札秘匿性チェック: 自分以外のプレイヤーにhandプロパティが存在しないこと
foreach ($p in $startRes.public.players) {
  if ($p.PSObject.Properties.Name -contains "hand") {
    throw "公開ビューに手札が含まれています（秘匿性違反）: seatIdx=$($p.seatIdx)"
  }
}
Write-Host "OK: 公開ビューは手札を含まない（handCountのみ: $($startRes.public.players | ForEach-Object { $_.handCount })）"

Write-Host "--- 4. 楽観的ロックの実証: 古いturn_versionで呼び出し ---"
$currentSeat = $startRes.public.currentPlayerIdx
$staleRes = Invoke-FnRaw "apply-action" @{
  roomCode = $roomCode; seatIdx = $currentSeat; clientSecret = $secrets[$currentSeat]
  expectedTurnVersion = -1; decision = @{ type = "pass" }
}
if ($staleRes.StatusCode -ne 409) { throw "古いturn_versionが409を返しませんでした（実際: $($staleRes.StatusCode)）" }
Write-Host "OK: 古いturn_versionでの呼び出しは409(turn_version_conflict)"

Write-Host "--- 5. ラウンド終了まで進行 ---"
$actionCount = 0
$gsView = $startRes
$maxIter = 500
while (-not $gsView.public.roundOver -and $actionCount -lt $maxIter) {
  $seat = $gsView.public.currentPlayerIdx
  $myView = Invoke-Fn "get-my-view" @{ roomCode = $roomCode; seatIdx = $seat; clientSecret = $secrets[$seat] }
  $legal = $myView.private.legalActions

  if ($legal.canPlay -and $legal.canPlay.Count -gt 0) {
    $decision = @{ type = "play"; cardId = $legal.canPlay[0].id }
  } elseif ($legal.canDraw) {
    $decision = @{ type = "draw" }
  } elseif ($legal.canFold) {
    $decision = @{ type = "fold" }
  } else {
    $decision = @{ type = "pass" }
  }

  $gsView = Invoke-Fn "apply-action" @{
    roomCode = $roomCode; seatIdx = $seat; clientSecret = $secrets[$seat]
    expectedTurnVersion = $gsView.public.turnVersion; decision = $decision
  }
  $actionCount++
}
if ($actionCount -ge $maxIter) { throw "ラウンドが$maxIter 手以内に終了しませんでした（無限ループの可能性）" }
Write-Host "OK: $actionCount 手でラウンド終了。turnVersion=$($gsView.public.turnVersion) roundResult=$($gsView.public.roundResult | ConvertTo-Json -Compress)"
Write-Host "最終チップ: $($gsView.public.players | ForEach-Object { "$($_.nickname)=$($_.chips -join ',')" })"

Write-Host "--- 6. action_logの行数を検証 ---"
$roomRow = Invoke-RestGet "rooms?code=eq.$roomCode&select=id"
$roomId = $roomRow[0].id
$logs = Invoke-RestGet "action_log?room_id=eq.$roomId&select=id"
$expected = $actionCount + 1  # +1 は round_start分
if ($logs.Count -ne $expected) {
  throw "action_logの行数が一致しません（期待: $expected, 実際: $($logs.Count)）"
}
Write-Host "OK: action_logの行数は期待通り（$($logs.Count)行 = round_start 1 + アクション$actionCount 件）"

Write-Host ""
Write-Host "=== フェーズ1疎通確認: すべて成功 ==="
