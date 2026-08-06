import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';

vi.mock('@p5-wrapper/react', () => ({P5Canvas: () => null}));

it('renders without crashing', () => {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  act(() => {
    root.render(<App />);
  });
  act(() => {
    root.unmount();
  });
  div.remove();
});
