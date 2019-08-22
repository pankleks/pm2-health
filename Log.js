"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function info(text) {
    console.log(`i-${new Date().toISOString()}: ${text}`);
}
exports.info = info;
function error(text) {
    console.error(`${new Date().toISOString()}: ${text}`);
}
exports.error = error;
exports.debug = (text) => { };
function enableDebugLog() {
    exports.debug = (text) => {
        console.log(`d-${new Date().toISOString()}: ${text}`);
    };
    exports.debug("debug log enabled in config");
}
exports.enableDebugLog = enableDebugLog;
//# sourceMappingURL=Log.js.map