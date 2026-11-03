/* Cam stick + call + BLE body — after app.js + ble/protocol.js */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);
  const statusEl = $('#robotStatus');
  const toastEl = $('#toast');
  const leftPupil = $('#leftPupil');
  const rightPupil = $('#rightPupil');
  const synth = window.speechSynthesis;

  let bleDevice = null;
  let bleServer = null;
  let writeChar = null;
  let connected = false;

  function look(x, y) {
    const max = 12;
    const t = 'translate(' + x * max + 'px, ' + y * max + 'px)';
    if (leftPupil) leftPupil.style.transform = t;
    if (rightPupil) rightPupil.style.transform = t;
  }
  function setStatus(text, hi) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.classList.toggle('hi', !!hi);
  }
  function toast(msg, ms) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => toastEl.classList.remove('show'), ms || 2400);
  }
  function speak(text) {
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ru-RU';
    u.rate = 1.05;
    u.pitch = 1.15;
    synth.speak(u);
  }

  async function sendPacket(bytes) {
    if (!writeChar || !connected) return false;
    try {
      await writeChar.writeValueWithoutResponse(bytes);
      return true;
    } catch (e) {
      try {
        await writeChar.writeValue(bytes);
        return true;
      } catch (e2) {
        toast('BLE write fail: ' + (e2.message || e.message));
        return false;
      }
    }
  }

  function packetFor(cmd) {
    const P = window.CamBLE;
    if (!P) return null;
    switch (cmd) {
      case 'left': return P.cmdLeft();
      case 'right': return P.cmdRight();
      case 'up': return P.cmdUp();
      case 'down': return P.cmdDown();
      case 'stop': return P.cmdStop();
      case 'orbit': return P.cmdOrbitStep(1);
      case 'push': return P.buildRotateMessage({ yaw: 0, pitch: 0, roll: 0, time: 15, mode: 'speed' });
      case 'track': return null;
      default: return null;
    }
  }

  const cmds = {
    left: { text: 'Влево — тело палки', look: [-1, 0], say: 'Влево' },
    right: { text: 'Вправо — тело палки', look: [1, 0], say: 'Вправо' },
    up: { text: 'Вверх', look: [0, -1], say: 'Вверх' },
    down: { text: 'Вниз', look: [0, 1], say: 'Вниз' },
    orbit: { text: 'Орбита: шаги yaw', look: [0.6, 0], say: 'Орбита' },
    push: { text: 'Наезд (держи кадр / Mimo)', look: [0, 0], say: 'Наезд' },
    stop: { text: 'Стоп', look: [0, 0], say: 'Стоп' },
    track: { text: 'ActiveTrack — открой Mimo', look: [0, 0], say: 'Трекинг' },
  };

  $$('.chip.cmd').forEach((b) => {
    b.addEventListener('click', async () => {
      $$('.chip.cmd').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      const key = b.dataset.cmd;
      const c = cmds[key];
      if (!c) return;
      look(c.look[0], c.look[1]);
      setStatus(c.text, true);
      speak(c.say);
      const card = $('#stickCard');
      if (card) card.innerHTML = '<p class="tip-title">Cam → тело</p><p class="tip-text">' + c.text + '</p>';

      if (key === 'track') {
        toast('ActiveTrack только в Mimo');
        return;
      }

      const pkt = packetFor(key);
      if (pkt && connected) {
        const ok = await sendPacket(pkt);
        toast(ok ? 'Команда на палку (BLE)' : 'Не ушло');
      } else if (!connected) {
        toast('BLE не подключён — голос + открой Mimo или ios-bridge');
      }
    });
  });

  function updateBleStatus() {
    const el = $('#bleStatus');
    if (!el) return;
    if (connected) el.textContent = 'Bluetooth: подключено к палке (эксперимент OM)';
    else if (navigator.bluetooth) el.textContent = 'Bluetooth: API есть — жми Подключить BLE (закрой Mimo)';
    else el.textContent = 'Bluetooth: Safari без WebBT → ios-bridge или beacio';
  }
  updateBleStatus();

  async function tryBleConnect() {
    if (!navigator.bluetooth) {
      toast('Нужен ios-bridge (Xcode) или beacio');
      speak('Нужен мост');
      setStatus('BLE недоступен в Safari');
      return;
    }
    if (!window.CamBLE) {
      toast('protocol.js не загружен');
      return;
    }
    try {
      setStatus('Ищу OM / Osmo…', true);
      toast('Закрой Mimo. Выбери палку в списке');
      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { namePrefix: 'OM' },
          { namePrefix: 'Osmo' },
          { namePrefix: 'DJI' },
          { services: [window.CamBLE.SERVICE] },
        ],
        optionalServices: [window.CamBLE.SERVICE],
      }).catch(async () => {
        return navigator.bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: [window.CamBLE.SERVICE],
        });
      });
      bleDevice = device;
      device.addEventListener('gattserverdisconnected', () => {
        connected = false;
        writeChar = null;
        updateBleStatus();
        toast('BLE отключён');
        setStatus('Палка отключена');
      });
      bleServer = await device.gatt.connect();
      const service = await bleServer.getPrimaryService(window.CamBLE.SERVICE);
      try {
        const nchar = await service.getCharacteristic(window.CamBLE.CHAR_NOTIFY);
        await nchar.startNotifications();
        try {
          await nchar.writeValue(new Uint8Array([0x01, 0x00]));
        } catch (_) {}
      } catch (_) {}
      writeChar = await service.getCharacteristic(window.CamBLE.CHAR_WRITE);
      connected = true;
      updateBleStatus();
      setStatus('Тело на связи: ' + (device.name || 'OM'), true);
      speak('Тело подключено');
      toast('Подключено. Жми влево/вправо');
    } catch (e) {
      toast('Не удалось: ' + (e.message || 'отмена'));
      setStatus('BLE: нет связи');
      speak('Не подключился');
    }
  }

  $('#btnBleConnect') && $('#btnBleConnect').addEventListener('click', tryBleConnect);
  $('#btnOpenMimo') && $('#btnOpenMimo').addEventListener('click', () => {
    speak('Mimo');
    window.location.href = 'djimimo://';
    setTimeout(() => toast('Если не открылось — Mimo вручную'), 1200);
  });

  function camCall() {
    setStatus('Cam звонит… 📞', true);
    speak('Алло! Это Cam. Готов снимать?');
    toast('Cam звонит тебе');
    const ring = $('#listeningRing');
    if (ring) {
      ring.classList.add('active');
      setTimeout(() => ring.classList.remove('active'), 3500);
    }
  }

  function dialNumber() {
    const input = $('#callNumber');
    const num = ((input && input.value) || '').replace(/[^\d+]/g, '');
    if (!num) {
      window.location.href = 'tel:';
      toast('Открываю Телефон');
      return;
    }
    setStatus('Набираю ' + num, true);
    speak('Звоню');
    window.location.href = 'tel:' + num;
  }

  $('#btnCall') && $('#btnCall').addEventListener('click', camCall);
  $('#btnCallPanel') && $('#btnCallPanel').addEventListener('click', camCall);
  $('#btnDial') && $('#btnDial').addEventListener('click', dialNumber);
})();
