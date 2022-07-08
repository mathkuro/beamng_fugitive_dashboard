local M = {}
local logTag = 'mathkuro'

local lastPlayerDamage = -1
local lastCameraName = ''
local isCrashCameraMode = false

local currentDamageTable = {}

local DAMAGE_TBL_KEY = 10001
local DAMAGE_BY_VAL_TBL_KEY = 10002

-- ダメージ値を金額ベースに換算する係数(要チューニング)
local DAMAGE_TO_VALUE = 100000

-- value未定義の車両のvalue値
local DEFAULT_VEHICLE_VALUE = 10000

-- 被害総額算出対象とする車両距離
local SQUEARED_DISTANCE_THRESHOLD = 20 * 20

-- クラッシュカメラの設定
local SIM_SPEED = 0.5
local CRASH_CAMERA_MODE = 'external'

local function getTable(key)
  if not currentDamageTable[key] then
    currentDamageTable[key] = {}
  end

  return currentDamageTable[key]
end

local function getCurrentDamageByValue(key)
  local _key = (type(key) == 'number') and key or DAMAGE_BY_VAL_TBL_KEY
  local _tbl = getTable(_key)
  local _currentDamage = 0
  local _playerVeh = be:getPlayerVehicle(0)
  local _playerVid = _playerVeh:getId()
  local _playerPos = _playerVeh:getPosition()

  for vid, veh in activeVehiclesIterator() do
    -- 前回のダメージ値(初出の車両の場合は0)
    local _lastDamage = 0
    if _tbl[vid] then
      _lastDamage = _tbl[vid]
    end

    -- Value値が未設定の車両がたまにあるので補正
    local _value = core_vehicles.getVehicleDetails(vid).configs.Value or DEFAULT_VEHICLE_VALUE

    if map.objects[vid] == nil then
      -- 'damage'が取得できない車両は諦めて0にしておく
      _tbl[vid] = 0
    else
      _tbl[vid] = (map.objects[vid]['damage'] / DAMAGE_TO_VALUE) * _value
    end

    if _tbl[vid] < _lastDamage then
      -- 前回値よりもダメージ量が小さい場合は車両がリセットされているので前回値は0として扱う
      _lastDamage = 0
    end

    if vid ~= _playerVid and veh:getPosition():squaredDistance(_playerPos) < SQUEARED_DISTANCE_THRESHOLD then
      -- プレイヤー車両との距離が閾値未満の車両のみ加算
      _currentDamage = _currentDamage + (_tbl[vid] - _lastDamage)
    end

  end

  return _currentDamage
end

-- プレイヤーのダメージ差分(前回呼び出し時との差分)を取得
local function getPlayerDamageDelta()
  local _playerDamageDelta = 0
  local _playerDamage = map.objects[be:getPlayerVehicle(0):getId()]["damage"]

  if _playerDamage < lastPlayerDamage then
    lastPlayerDamage = 0
  end

  if lastPlayerDamage == -1 then
    lastPlayerDamage = _playerDamage
    -- 初回呼び出し時に_playerDamageの値に関わらず差分は0として扱う
    _playerDamageDelta = 0
  else
    _playerDamageDelta = _playerDamage - lastPlayerDamage
    lastPlayerDamage = _playerDamage
  end

  return _playerDamageDelta
end

local function enableCrashCamera()
  -- 現在設定されているカメラを退避
  if isCrashCameraMode then
    -- クラッシュカメラ中はクラッシュカメラを起動しない
    log('D', logTag, 'crashCameraMode already enabled')
  else
    lastCameraName = core_camera.getActiveCamName()
    log('D', logTag, 'lastCameraName:'..lastCameraName)

    bullettime.set(SIM_SPEED)
    core_camera.setByName(0, CRASH_CAMERA_MODE)
    core_camera.resetCamera(0)
    isCrashCameraMode = true
  end
end

local function disableCrashCamera()
  if isCrashCameraMode then
    -- クラッシュカメラが有効化されている場合のみ解除処理を行う
    bullettime.set(1)
    core_camera.setByName(0, lastCameraName)
    core_camera.resetCamera(0)
    isCrashCameraMode = false
  else
    log('D', logTag, 'crashCameraMode is not enabled')
  end
end

M.getCurrentDamageByValue = getCurrentDamageByValue
M.getPlayerDamageDelta = getPlayerDamageDelta

M.enableCrashCamera = enableCrashCamera
M.disableCrashCamera = disableCrashCamera

return M
