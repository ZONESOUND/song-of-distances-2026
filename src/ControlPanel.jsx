import React, {Component} from 'react';
import * as dat from 'dat.gui';
import P5Wrapper from 'react-p5-wrapper';
import sketch from './sketch';
import {createSessionStore} from './data/createSessionStore';
import {gpsData, setupGPS, clearWatchGPS} from './gps';
import {NameModal} from './NameModal';
import {IntroModal} from './IntroModal';
import { LocHintModal } from './LocHintModal';
import {withEffectivePresence} from './sessionPresence';

const SESSION_ID = 'generative_geo_id';
const SESSION_NAME = 'generative_name';
const SESSION_TIME = 'generative_geo_id_time';
const CONTROL_DATA = 'controlData';
const DEFAULT_TOPOLOGY_CONTROLS = {
    globalScale: 250000,
    globalPow: 0.58,
    radioSpeed: 0.5/2*Math.PI,
};
const defaultSessionStore = createSessionStore();

class LocData extends Component {
    latestPosition = null;
    latestLocations = {};

    state = {
        gp: {},
        gpsPermission: null,
        key: null,
        currentPosition: null,
        //allLocations: [],
        dataPoint: []
    }
    gpsPermit = (b, position) => {
        if (position) this.latestPosition = position;
        this.setState({
            gpsPermission: b,
            ...(position ? {currentPosition: position} : {}),
        });
        if (b && position && this.state.key) {
            this.props.sessionStore.updatePosition(
                this.state.key,
                position
            ).catch((error) => {
                console.error('Unable to update location session', error);
            });
        }
    }

    componentDidMount() {
        //this.initGPS();
        //console.log('setupGPS');
        setupGPS(this.gpsPermit);
        this.unsubscribeSessions = this.props.sessionStore.subscribeSessions(
            this.updateDataSet
        );
        this.presenceTimer = setInterval(() => {
            this.updateDataSet(this.latestLocations);
        }, 5000);
    }

    componentWillUnmount() {
        if (this.unsubscribeSessions) this.unsubscribeSessions();
        if (this.presenceTimer) clearInterval(this.presenceTimer);
        clearWatchGPS();
        if (this.props.sessionStore.dispose) this.props.sessionStore.dispose();
    }

    initGPS = () => {
        
    }

    updateDataSet = (allLocations) => {
        this.latestLocations = allLocations || {};
        this.setState({
            dataPoint: Object.entries(this.latestLocations)
            .filter(([id, value]) =>
                id !== this.state.key &&
                id !== gpsData.key &&
                value &&
                Number.isFinite(Number(value.lat)) &&
                Number.isFinite(Number(value.lon)) &&
                Number.isFinite(Number(value.timeStamp))
            )
            .map(([id, value]) => ({
                ...withEffectivePresence(value),
                key: id,
                showId: value.showId || getShowId(id),
            }))

        })
    }

    startListen = (key) => {
        this.setState({key: key}, () => {
            if (this.latestPosition) {
                this.props.sessionStore.updatePosition(
                    key,
                    this.latestPosition
                ).catch((error) => {
                    console.error('Unable to update initial location session', error);
                });
            }
        });
    }
     

    render() {
        let {gpsPermission} = this.state;
        return (<>
            <LocHintModal show={gpsPermission===false}/>
            <IntroModal show={false}/>
            {gpsPermission && <ControlPanel dataPoint={this.state.dataPoint}
                currentPosition={this.state.currentPosition}
                done={this.startListen}
                sessionStore={this.props.sessionStore}/>
            }
            </>
        );
    }
}

class ControlPanel extends Component {
    GUI = null;
    controlModel = null;
    controlPanelVisible = false;

    state = {
        data: {
            ...DEFAULT_TOPOLOGY_CONTROLS,
            maxLineLength: 100,
            lat: gpsData.lat,
            lon: gpsData.lon,
            centerName: 'center'
        }, 
        name: 'center',
        naming: false,
        key: null,
        //GUI: new dat.GUI()
    }

    componentDidMount() {
        this.addGPSKey();
        this.setState({naming: true});
        window.addEventListener("beforeunload", this.handleWindowBeforeUnload);
        window.addEventListener("keydown", this.handleControlPanelShortcut);
        this.setupControlPanel();
    }

    componentDidUpdate(previousProps) {
        const previous = previousProps.currentPosition;
        const current = this.props.currentPosition;
        if (current && (!previous ||
            current.lat !== previous.lat || current.lon !== previous.lon)) {
            this.setState({
                data: {
                    ...this.state.data,
                    lat: current.lat,
                    lon: current.lon,
                },
            });
        }
    }

    componentWillUnmount() {
        window.removeEventListener("beforeunload", this.handleWindowBeforeUnload);
        window.removeEventListener("keydown", this.handleControlPanelShortcut);
        if (this.GUI) this.GUI.destroy();
        if (this.state.key) {
            this.props.sessionStore.endSession(this.state.key).catch(() => {});
        }
    }

    addGPSKey = () => {
        //console.log('add gps key');
        let myId;
        let showId;
        let lastId = localStorage.getItem(SESSION_ID)
        let lastIdTime = localStorage.getItem(SESSION_TIME)

        if (lastId && (Date.now() - lastIdTime < 60*60*1000)){
            //console.log("Old Id Detected! use " + lastId)
            myId = lastId
            localStorage.setItem(SESSION_TIME, Date.now())
            showId = localStorage.getItem(SESSION_NAME);
        } else{
            myId = this.props.sessionStore.reserveSessionId();
            showId = getShowId(myId);
            //console.log("Generate new id " + myId)
            localStorage.setItem(SESSION_ID,myId)
            localStorage.setItem(SESSION_TIME, Date.now())
        }
        
        gpsData.key = myId;
        if (!showId)
            showId = getShowId(myId);
        gpsData.showId = showId;

        this.setState({key:myId});
        this.props.sessionStore.startSession(myId, gpsData).catch((error) => {
            console.error('Unable to start location session', error);
        });
        this.props.done(myId);
        this.changeCenterName(showId, false);
    }

    changeCenterName = (name, updateFirebase) => {
        localStorage.setItem(SESSION_NAME, name);
        if (updateFirebase && this.state.key) {
            this.props.sessionStore.renameSession(this.state.key, name).catch((error) => {
                console.error('Unable to rename location session', error);
            });
            this.props.done(this.state.key);
        }
        this.setState({data:{...this.state.data, centerName: name}, name: name});

    }
    
    saveControlData = () => {
        const {globalScale, globalPow, radioSpeed} = this.state.data;
        sessionStorage.setItem(CONTROL_DATA, JSON.stringify({
            globalScale,
            globalPow,
            radioSpeed,
        }));
    }

    loadControlData = () => {
        try {
            const saved = JSON.parse(sessionStorage.getItem(CONTROL_DATA));
            if (!saved) return DEFAULT_TOPOLOGY_CONTROLS;
            return Object.keys(DEFAULT_TOPOLOGY_CONTROLS).reduce(
                (controls, key) => ({
                    ...controls,
                    [key]: Number.isFinite(Number(saved[key]))
                        ? Number(saved[key])
                        : DEFAULT_TOPOLOGY_CONTROLS[key],
                }),
                {}
            );
        } catch (error) {
            return DEFAULT_TOPOLOGY_CONTROLS;
        }
    }

    updateTopologyControl = (key, value) => {
        const numberValue = Number(value);
        if (!Number.isFinite(numberValue)) return;
        this.setState({
            data: {...this.state.data, [key]: numberValue},
        }, this.saveControlData);
    }

    resetTopologyControls = () => {
        Object.assign(this.controlModel, DEFAULT_TOPOLOGY_CONTROLS);
        this.setState({
            data: {...this.state.data, ...DEFAULT_TOPOLOGY_CONTROLS},
        }, () => {
            this.saveControlData();
            if (this.GUI) this.GUI.updateDisplay();
        });
    }

    setupControlPanel = () => {
        const savedControls = this.loadControlData();
        this.controlModel = {
            ...savedControls,
            reset: this.resetTopologyControls,
        };
        this.setState({
            data: {...this.state.data, ...savedControls},
        });

        this.GUI = new dat.GUI({
            name: 'Song of Distances — Topology',
            width: 320,
            hideable: false,
        });
        this.GUI.add(this.controlModel, 'globalScale', 1000, 800000, 1000)
            .name('距離比例 globalScale')
            .onChange((value) => this.updateTopologyControl('globalScale', value));
        this.GUI.add(this.controlModel, 'globalPow', 0.1, 0.99, 0.01)
            .name('拓樸曲線 globalPow')
            .onChange((value) => this.updateTopologyControl('globalPow', value));
        this.GUI.add(this.controlModel, 'radioSpeed', 0, 3, 0.01)
            .name('雷達速度 radioSpeed')
            .onChange((value) => this.updateTopologyControl('radioSpeed', value));
        this.GUI.add(this.controlModel, 'reset').name('還原原始參數');
        this.GUI.open();
        this.GUI.hide();
    }

    handleControlPanelShortcut = (event) => {
        const target = event.target;
        const tagName = target && target.tagName;
        if (tagName === 'INPUT' || tagName === 'TEXTAREA' ||
            tagName === 'SELECT' ||
            String(event.key || '').toLowerCase() !== 'h') return;
        this.controlPanelVisible = !this.controlPanelVisible;
        if (this.controlPanelVisible) this.GUI.show();
        else this.GUI.hide();
    }

    handleWindowBeforeUnload = (e) => {
        if (this.state.key) {
            this.props.sessionStore.endSession(this.state.key).catch(() => {});
        }
    }

    render() {
        const {data} = this.state;
        let {dataPoint} = this.props;

        return (
            <>
            <NameModal show={this.state.naming} name={this.state.name} 
                        onChange={this.changeCenterName}/>
            <P5Wrapper sketch={sketch} dataPoint={dataPoint}
                    configData={data} myId={this.state.key}/>
            </>
        )


    }

}

const getShowId = (id) => {
    return "A" + (id.split("").map(ch=>ch.charCodeAt(0)).reduce((a,b)=>(a*b),1) % 1000)
  }

export default LocData;

LocData.defaultProps = {
    sessionStore: defaultSessionStore,
};
