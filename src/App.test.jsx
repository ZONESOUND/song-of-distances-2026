import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';

vi.mock('react-p5-wrapper', () => ({default: () => null}));

it('renders without crashing', () => {
  const div = document.createElement('div');
  ReactDOM.render(<App />, div);
  ReactDOM.unmountComponentAtNode(div);
});
