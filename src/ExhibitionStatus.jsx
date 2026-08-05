import React from 'react';
import {runtimeConfig} from './runtimeConfig';
import {RUNTIME_EVENT} from './runtimeEvents';

export class ExhibitionStatus extends React.Component {
  state = {socket: 'off', lastEvent: 'waiting'};

  componentDidMount() {
    window.addEventListener(RUNTIME_EVENT, this.handleRuntimeEvent);
  }

  componentWillUnmount() {
    window.removeEventListener(RUNTIME_EVENT, this.handleRuntimeEvent);
  }

  handleRuntimeEvent = (event) => {
    const detail = event.detail || {};
    if (detail.type === 'socket') this.setState({socket: detail.status});
    if (detail.type === 'osc') {
      this.setState({lastEvent: `${detail.direction}: ${detail.envelope.address}`});
    }
  };

  render() {
    if (!runtimeConfig.showDiagnostics) return null;
    return (
      <aside className="exhibition-status" aria-label="Exhibition diagnostics">
        <div>DATA {runtimeConfig.dataMode.toUpperCase()}</div>
        <div>GPS {runtimeConfig.locationMode.toUpperCase()}</div>
        <div>SOCKET {this.state.socket.toUpperCase()}</div>
        <div>OSC {runtimeConfig.oscOutputEnabled ? 'ON' : 'OFF'}</div>
        <div>{this.state.lastEvent}</div>
      </aside>
    );
  }
}
