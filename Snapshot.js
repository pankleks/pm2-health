"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var Fs = require("fs");
var os_1 = require("os");
var planck_http_fetch_1 = require("planck-http-fetch");
var Log_1 = require("./Log");
var INACTIVE_AFTER_M = 5;
var Snapshot = /** @class */ (function () {
    function Snapshot(_config) {
        this._config = _config;
        this._data = {
            host: os_1.hostname(),
            app: {}
        };
        if (!this._config.snapshot)
            this._config.snapshot = {};
        this._data.token = this._config.snapshot.token;
        if (this._config.snapshot.inactiveAfterM == null)
            this._config.snapshot.inactiveAfterM = INACTIVE_AFTER_M;
    }
    Snapshot.prototype.push = function (appId, app, key, history, v) {
        if (!this._data.app[appId])
            this._data.app[appId] = { name: app, metric: {}, inactive: false };
        this._data.app[appId].timeStamp = new Date().getTime();
        this._data.app[appId].metric[key] = { history: history, v: v };
    };
    Snapshot.prototype.last = function (appId, key) {
        if (!this._data.app[appId] || !this._data.app[appId].metric[key])
            return undefined;
        return this._data.app[appId].metric[key].v.v;
    };
    Snapshot.prototype.dump = function () {
        this._data.timeStamp = new Date().getTime();
        Fs.writeFile("History_" + new Date().toISOString() + ".json", JSON.stringify(this._data), function (ex) {
            if (ex)
                Log_1.error("can't dump history -> " + (ex.message || ex));
        });
    };
    Snapshot.prototype.send = function () {
        return __awaiter(this, void 0, void 0, function () {
            var fetch_1, ex_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this._config.snapshot.url || !this._config.snapshot.token || this._config.snapshot.disabled === true)
                            return [2 /*return*/];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        this._data.timeStamp = new Date().getTime();
                        fetch_1 = new planck_http_fetch_1.Fetch(this._config.snapshot.url);
                        if (this._config.snapshot.auth && this._config.snapshot.auth.user) // auth
                            fetch_1.basicAuth(this._config.snapshot.auth.user, this._config.snapshot.auth.password);
                        return [4 /*yield*/, fetch_1.fetch(JSON.stringify(this._data))];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        ex_1 = _a.sent();
                        Log_1.error("snapshot push failed -> " + (ex_1.message || ex_1));
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    Snapshot.prototype.inactivate = function () {
        var t = new Date().getTime();
        for (var _i = 0, _a = Object.keys(this._data.app); _i < _a.length; _i++) {
            var id = _a[_i];
            var app = this._data.app[id], dt = (t - app.timeStamp) / 60000;
            app.inactive = dt > this._config.snapshot.inactiveAfterM;
            if (app.inactive)
                Log_1.info("app [" + app.name + "] is inactive");
        }
    };
    return Snapshot;
}());
exports.Snapshot = Snapshot;
