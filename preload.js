(() => {
  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true })
    } else {
      fn()
    }
  }

  function clearLightThemeLeftovers() {
    try {
      localStorage.removeItem('xf_light_theme')
      document.documentElement.classList.remove('xf-light-theme')
      if (document.body) {
        document.body.classList.remove('xf-light-theme', 'xf-canvas-ui-light')
      }
    } catch (error) {
      // Ignore storage access edge cases.
    }
  }

  function injectReleasePatch() {
    if (document.getElementById('xf-release-page-patch')) return

    const script = document.createElement('script')
    script.id = 'xf-release-page-patch'
    script.textContent = `(${installReleasePatch.toString()})()`
    document.documentElement.appendChild(script)
    script.remove()
  }

  function installReleasePatch() {
    if (window.__xfReleasePatchInstalled) return
    window.__xfReleasePatchInstalled = true

    const SOCIAL_SCENE = 'SocialRoomScene'
    const MAP_RECT = {
      x: 0,
      y: 0,
      width: 2028,
      height: 990,
      centerX: 1014,
      centerY: 495,
    }

    const DEBUG_ENTRANCE_ZONES = false
    const ENTRANCE_ZONES = [
      { cx: 1258, cy: 280, rx: 56, ry: 42 },
      { cx: 1690, cy: 300, rx: 86, ry: 62 },
    ]

    function getGame() {
      return window.__phaserGame || null
    }

    function getScene(key) {
      const game = getGame()
      if (!game || !game.scene) return null

      try {
        if (typeof game.scene.getScene === 'function') return game.scene.getScene(key)
      } catch (error) {
        return null
      }

      return game.scene.keys ? game.scene.keys[key] : null
    }

    function sceneIsActive(scene) {
      return !!(
        scene &&
        scene.scene &&
        (typeof scene.scene.isActive !== 'function' || scene.scene.isActive())
      )
    }

    function getSocialScene() {
      const scene = getScene(SOCIAL_SCENE)
      return sceneIsActive(scene) ? scene : null
    }

    function setCameraZoom(camera, zoom) {
      if (typeof camera.setZoom === 'function') camera.setZoom(zoom)
      else camera.zoom = zoom
    }

    function centerCamera(camera, x, y) {
      if (typeof camera.centerOn === 'function') {
        camera.centerOn(x, y)
        return
      }

      const zoom = camera.zoom || 1
      camera.scrollX = x - camera.width / (2 * zoom)
      camera.scrollY = y - camera.height / (2 * zoom)
    }

    function applyFullParkView() {
      const scene = getSocialScene()
      if (!scene || !scene.cameras || !scene.cameras.main) return

      const camera = scene.cameras.main
      const scale = scene.scale || (getGame() && getGame().scale)
      const gameSize = scale && scale.gameSize
      const viewWidth = (gameSize && gameSize.width) || camera.width || 1548
      const viewHeight = (gameSize && gameSize.height) || camera.height || 990
      const zoom = Math.min(1, viewWidth / MAP_RECT.width, viewHeight / MAP_RECT.height)

      if (typeof camera.stopFollow === 'function') camera.stopFollow()
      if (typeof camera.setBounds === 'function') {
        camera.setBounds(MAP_RECT.x, MAP_RECT.y, MAP_RECT.width, MAP_RECT.height)
      }
      setCameraZoom(camera, zoom)
      centerCamera(camera, MAP_RECT.centerX, MAP_RECT.centerY)
    }

    function pointInEntrance(worldX, worldY) {
      return ENTRANCE_ZONES.some((zone) => {
        const dx = (worldX - zone.cx) / zone.rx
        const dy = (worldY - zone.cy) / zone.ry
        return dx * dx + dy * dy <= 1
      })
    }

    function openLobbyFromWorldPoint(worldX, worldY, event) {
      const scene = getSocialScene()
      if (!scene || scene.overlayOpen || !pointInEntrance(worldX, worldY)) return false
      if (typeof scene.toggleOverlay !== 'function') return false

      if (event) {
        event.preventDefault()
        event.stopPropagation()
        if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation()
      }

      scene.toggleOverlay()
      return true
    }

    function worldPointFromDomEvent(event) {
      const scene = getSocialScene()
      const canvas = document.querySelector('canvas')
      const camera = scene && scene.cameras && scene.cameras.main
      if (!canvas || !camera) return null

      const rect = canvas.getBoundingClientRect()
      if (!rect.width || !rect.height) return null
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      ) return null

      const localX = (event.clientX - rect.left) * ((camera.width || 1548) / rect.width)
      const localY = (event.clientY - rect.top) * ((camera.height || 990) / rect.height)

      if (typeof camera.getWorldPoint === 'function') {
        const point = camera.getWorldPoint(localX, localY)
        return { x: point.x, y: point.y }
      }

      const zoom = camera.zoom || 1
      return {
        x: (camera.scrollX || 0) + localX / zoom,
        y: (camera.scrollY || 0) + localY / zoom,
      }
    }

    function targetIsDomControl(target) {
      if (!target || !target.closest) return false
      return !!target.closest('input, textarea, button, select, [contenteditable="true"]')
    }

    function handleDomPointerDown(event) {
      if (targetIsDomControl(event.target)) return
      const point = worldPointFromDomEvent(event)
      if (!point) return
      openLobbyFromWorldPoint(point.x, point.y, event)
    }

    function hookScenePointerInput(scene) {
      if (!scene || scene.__xfReleaseEntranceHooked || !scene.input || typeof scene.input.on !== 'function') return

      scene.__xfReleaseEntranceHooked = true
      scene.input.on('pointerdown', (pointer) => {
        if (!pointer) return
        openLobbyFromWorldPoint(pointer.worldX, pointer.worldY)
      })
    }

    function drawEntranceDebug(scene) {
      if (!scene) return

      if (!DEBUG_ENTRANCE_ZONES) {
        if (scene.__xfEntranceDebugGraphics) {
          scene.__xfEntranceDebugGraphics.destroy()
          scene.__xfEntranceDebugGraphics = null
        }
        return
      }

      if (!scene.__xfEntranceDebugGraphics || !scene.__xfEntranceDebugGraphics.scene) {
        scene.__xfEntranceDebugGraphics = scene.add.graphics().setDepth(99999)
      }

      const graphics = scene.__xfEntranceDebugGraphics
      graphics.clear()
      graphics.fillStyle(0xff0000, 1)
      graphics.lineStyle(4, 0x7a0000, 1)

      ENTRANCE_ZONES.forEach((zone) => {
        graphics.fillEllipse(zone.cx, zone.cy, zone.rx * 2, zone.ry * 2)
        graphics.strokeEllipse(zone.cx, zone.cy, zone.rx * 2, zone.ry * 2)
      })
    }

    function tickReleasePatch() {
      const scene = getSocialScene()
      applyFullParkView()
      hookScenePointerInput(scene)
      drawEntranceDebug(scene)
    }

    document.addEventListener('pointerdown', handleDomPointerDown, true)
    setInterval(tickReleasePatch, 250)
    setTimeout(tickReleasePatch, 250)
    setTimeout(tickReleasePatch, 1000)
    setTimeout(tickReleasePatch, 2500)

    window.__xfApplyFullParkView = applyFullParkView
    window.__xfOpenLobbyFromWorldPoint = openLobbyFromWorldPoint
  }

  onReady(() => {
    clearLightThemeLeftovers()
    injectReleasePatch()
  })
})()




