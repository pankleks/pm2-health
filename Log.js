"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function info(text) {
    console.log(`${new Date().toISOString()}: ${text}`);
}
exports.info = info;
function error(text) {
    console.error(`${new Date().toISOString()}: ${text}`);
}
exports.error = error;
//# sourceMappingURL=Log.js.map