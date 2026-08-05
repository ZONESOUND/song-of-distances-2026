import React from 'react';
import LocData from './ControlPanel';
import {ExhibitionStatus} from './ExhibitionStatus';
import './App.css';


class App extends React.Component {
  
  render() {
    return (
      <>
        <LocData/>
        <ExhibitionStatus/>
      </>
    )
  }
}

export default App;
