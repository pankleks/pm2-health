"use strict";
exports.__esModule = true;
function info(text) {
    console.log(new Date().toISOString() + ": " + text);
}
exports.info = info;
function error(text) {
    console.error(new Date().toISOString() + ": " + text);
}
exports.error = error;
