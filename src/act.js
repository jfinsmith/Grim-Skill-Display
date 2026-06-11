// act.js — connects to ACT via OverlayPlugin (preferred) or the WebSocket bridge.
// Ported from kagami / Rawrington's SkillDisplay, kept intact because it works.

const getHost = () => /HOST_PORT=(wss?:\/\/.+)/.exec(window.location.search);

function listenWebSocket(callback) {
  const url = new URLSearchParams(window.location.search);
  const wsUri = `${url.get('HOST_PORT')}BeforeLogLineRead`;
  const ws = new WebSocket(wsUri);
  ws.onerror = () => ws.close();
  ws.onclose = () => setTimeout(() => listenWebSocket(callback), 1000);
  ws.onmessage = (e) => {
    if (e.data === '.') return ws.send('.');
    const obj = JSON.parse(e.data);
    if (obj.msgtype === 'CombatData') return callback({ type: 'CombatData', message: obj.msg });
    if (obj.msgtype === 'SendCharName') return callback({ type: 'ChangePrimaryPlayer', message: obj.msg });
    if (obj.msgtype === 'Chat') return callback({ type: 'LogLine', message: obj.msg.split('|') });
    return undefined;
  };
}

function listenOverlayPlugin(callback) {
  addOverlayListener('CombatData', (e) => callback({ type: 'CombatData', message: { ...e } }));
  addOverlayListener('LogLine', (e) => callback({ type: 'LogLine', message: [...e.line] }));
  addOverlayListener('ChangePrimaryPlayer', (e) => callback({ type: 'ChangePrimaryPlayer', message: { ...e } }));
  startOverlayEvents();
}

export default function listenToACT(callback) {
  if (getHost()) return listenWebSocket(callback);
  return listenOverlayPlugin(callback);
}
