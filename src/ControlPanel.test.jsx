import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import LocData from './ControlPanel';
import {gpsData, setupGPS} from './gps';

const captured = vi.hoisted(() => ({p5Props: null}));

vi.mock('@p5-wrapper/react', () => ({
  P5Canvas: (props) => {
    captured.p5Props = props;
    return null;
  },
}));
vi.mock('./NameModal', () => ({NameModal: () => null}));
vi.mock('./IntroModal', () => ({IntroModal: () => null}));
vi.mock('./LocHintModal', () => ({LocHintModal: () => null}));
vi.mock('./gps', () => ({
  gpsData: {},
  setupGPS: vi.fn(),
  clearWatchGPS: vi.fn(),
}));

it('keeps one session id while GPS and the client center move together', () => {
  let onSessions;
  const store = {
    subscribeSessions: vi.fn((listener) => {
      onSessions = listener;
      listener({});
      return vi.fn();
    }),
    reserveSessionId: vi.fn(() => 'session-a'),
    startSession: vi.fn(() => Promise.resolve()),
    updatePosition: vi.fn(() => Promise.resolve()),
    renameSession: vi.fn(() => Promise.resolve()),
    endSession: vi.fn(() => Promise.resolve()),
    dispose: vi.fn(),
  };
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<LocData sessionStore={store}/>);
  });
  const gpsCallback = setupGPS.mock.calls[0][0];
  const now = Date.now();
  const first = {
    lat: 25.033,
    lon: 121.5654,
    timeStamp: now,
    date: 'start',
    leave: false,
  };
  Object.assign(gpsData, first);
  act(() => gpsCallback(true, first));

  const topologyPanel = document.querySelector('.dg.main');
  expect(topologyPanel).not.toBeNull();
  expect(topologyPanel.style.display).toBe('none');
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', {key: 'h'}));
  });
  expect(topologyPanel.style.display).toBe('');
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', {key: 'H'}));
  });
  expect(topologyPanel.style.display).toBe('none');

  const second = {
    lat: 25.091,
    lon: 121.602,
    timeStamp: now + 5000,
    date: 'moved',
    leave: false,
  };
  act(() => gpsCallback(true, second));
  act(() => onSessions({
    'session-a': {...second, key: 'session-a'},
    'stale-session': {
      lat: 25.04,
      lon: 121.57,
      timeStamp: now - 60001,
      leave: false,
    },
  }));

  expect(store.reserveSessionId).toHaveBeenCalledTimes(1);
  expect(store.startSession).toHaveBeenCalledWith(
    'session-a',
    expect.objectContaining(first)
  );
  expect(store.updatePosition).toHaveBeenLastCalledWith('session-a', second);
  expect(captured.p5Props.configData).toMatchObject({
    lat: second.lat,
    lon: second.lon,
  });
  expect(captured.p5Props.dataPoint).toHaveLength(1);
  expect(captured.p5Props.dataPoint[0]).toMatchObject({
    key: 'stale-session',
    leave: true,
  });
  expect(captured.p5Props.myId).toBe('session-a');

  act(() => {
    root.unmount();
  });
  container.remove();
});
