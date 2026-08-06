// React 19's `act` requires this flag, otherwise every act() call warns that
// the test environment was not configured to support it.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
