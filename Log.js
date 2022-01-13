"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enableDebugLog = exports.debug = exports.error = exports.info = void 0;
function info(text) {
    console.log(`i-${new Date().toISOString()}: ${text}`);
}
exports.info = info;
function error(text) {
    console.error(`${new Date().toISOString()}: ${text}`);
}
exports.error = error;
let debug = (text) => { };
exports.debug = debug;
function enableDebugLog() {
    exports.debug = (text) => {
        console.log(`d-${new Date().toISOString()}: ${text}`);
    };
    (0, exports.debug)("debug log enabled in config");
}
exports.enableDebugLog = enableDebugLog;
//# sourceMappingURL=Log.js.map