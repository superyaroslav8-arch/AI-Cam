/**
 * DUML / Osmo Mobile BLE protocol helpers
 * Based on alkersan/om-research + lib-osmo-ble research.
 * Service 0xFFF0, write fff5, notify fff4.
 * Tested publicly on OM2/OM3/OM4; OM5 may share stack — verify on device.
 */
(function (global) {
  'use strict';

  const SERVICE = '0000fff0-0000-1000-8000-00805f9b34fb';
  const CHAR_NOTIFY = '0000fff4-0000-1000-8000-00805f9b34fb';
  const CHAR_WRITE = '0000fff5-0000-1000-8000-00805f9b34fb';

  const CRC16_TBL = (function () {
    const t = new Uint16Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = c & 1 ? (c >> 1) ^ 0x8408 : c >> 1;
      t[i] = c;
    }
    return t;
  })();

  function crc16(bytes) {
    let crc = 0xdf0c;
    for (let i = 0; i < bytes.length; i++) {
      crc = (crc >> 8) ^ CRC16_TBL[(bytes[i] ^ crc) & 0xff];
    }
    return crc & 0xffff;
  }

  function int16LE(n) {
    n = n | 0;
    return [n & 0xff, (n >> 8) & 0xff];
  }

  /**
   * Build rotate packet (om-research web-bluetooth style).
   * mode: 'speed' | 'absolute' | 'relative'
   * yaw/pitch/roll: already scaled (*10 for degrees in some paths)
   * time: 0..255
   */
  function buildRotateMessage({ yaw, pitch, roll, time, mode }) {
    const header = [0x55, 0x15, 0x04, 0xa9];
    const body = [0x02, 0x04, 0x01, 0x00, 0x00, 0x04];
    const isSpeed = mode === 'speed';
    body.push(isSpeed ? 0x0c : 0x14);
    const modeByte = mode === 'relative' ? 0x04 : mode === 'absolute' ? 0x05 : 0x80;
    const payload = [
      ...int16LE(yaw),
      ...int16LE(roll),
      ...int16LE(pitch),
      modeByte,
      time & 0xff,
    ];
    const mid = Uint8Array.from([...body, ...payload]);
    const c = crc16(mid);
    return new Uint8Array([...header, ...mid, c & 0xff, (c >> 8) & 0xff]);
  }

  function cmdLeft() {
    return buildRotateMessage({ yaw: -800, pitch: 0, roll: 0, time: 20, mode: 'speed' });
  }
  function cmdRight() {
    return buildRotateMessage({ yaw: 800, pitch: 0, roll: 0, time: 20, mode: 'speed' });
  }
  function cmdUp() {
    return buildRotateMessage({ yaw: 0, pitch: 600, roll: 0, time: 20, mode: 'speed' });
  }
  function cmdDown() {
    return buildRotateMessage({ yaw: 0, pitch: -600, roll: 0, time: 20, mode: 'speed' });
  }
  function cmdStop() {
    return buildRotateMessage({ yaw: 0, pitch: 0, roll: 0, time: 5, mode: 'speed' });
  }
  function cmdOrbitStep(dir) {
    return buildRotateMessage({
      yaw: dir > 0 ? 500 : -500,
      pitch: 0,
      roll: 0,
      time: 30,
      mode: 'speed',
    });
  }

  global.CamBLE = {
    SERVICE,
    CHAR_NOTIFY,
    CHAR_WRITE,
    buildRotateMessage,
    cmdLeft,
    cmdRight,
    cmdUp,
    cmdDown,
    cmdStop,
    cmdOrbitStep,
  };
})(typeof window !== 'undefined' ? window : globalThis);
