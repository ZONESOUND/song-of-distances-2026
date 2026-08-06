import React, { useState, useEffect } from 'react';
import { configRef } from './firebase';
import './AdminPanel.css';

const AdminPanel = () => {
    const [config, setConfig] = useState({
        globalScale: 250000,
        globalPow: 0.58,
        radioSpeed: 0.8,
        baseHue: 200,
        soundVolume: -12,
        mode: 'ambient'
    });

    useEffect(() => {
        configRef.on('value', (snapshot) => {
            const val = snapshot.val();
            if (val) {
                setConfig(prev => ({ ...prev, ...val }));
            }
        });
        return () => configRef.off();
    }, []);

    const handleChange = (key, value) => {
        const newConfig = { ...config, [key]: value };
        setConfig(newConfig);
        configRef.set(newConfig);
    };

    return (
        <div className="admin-container">
            <header className="admin-header">
                <h1>SONG OF DISTANCES // CONTROL</h1>
                <div className="status-badge">LIVE SYNC ENABLED</div>
            </header>

            <section className="admin-section">
                <h3>Visual Parameters</h3>
                <div className="control-group">
                    <label>Global Scale ({config.globalScale})</label>
                    <input
                        type="range" min="1000" max="800000" step="1000"
                        value={config.globalScale}
                        onChange={(e) => handleChange('globalScale', parseInt(e.target.value))}
                    />
                </div>
                <div className="control-group">
                    <label>Geometry Power ({config.globalPow})</label>
                    <input
                        type="range" min="0" max="1" step="0.01"
                        value={config.globalPow}
                        onChange={(e) => handleChange('globalPow', parseFloat(e.target.value))}
                    />
                </div>
                <div className="control-group">
                    <label>Radar Speed ({config.radioSpeed})</label>
                    <input
                        type="range" min="0" max="3" step="0.01"
                        value={config.radioSpeed}
                        onChange={(e) => handleChange('radioSpeed', parseFloat(e.target.value))}
                    />
                </div>
            </section>

            <section className="admin-section">
                <h3>Acoustic Engine</h3>
                <div className="control-group">
                    <label>Volume ({config.soundVolume}dB)</label>
                    <input
                        type="range" min="-60" max="0" step="1"
                        value={config.soundVolume}
                        onChange={(e) => handleChange('soundVolume', parseInt(e.target.value))}
                    />
                </div>
                <div className="control-group">
                    <label>Sound Mode</label>
                    <select value={config.mode} onChange={(e) => handleChange('mode', e.target.value)}>
                        <option value="classic">Original</option>
                        <option value="hybrid">Hybrid Ensemble</option>
                        <option value="synth">Pure Synthesis</option>
                    </select>
                </div>
            </section>

            <footer className="admin-footer">
                <p>Changes are synchronized in real-time to all connected nodes.</p>
            </footer>
        </div>
    );
};

export default AdminPanel;
