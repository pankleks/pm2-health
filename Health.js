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
var PM2 = require("pm2");
var Pmx = require("pmx");
var Fs = require("fs");
var path_1 = require("path");
var Mail_1 = require("./Mail");
var Snapshot_1 = require("./Snapshot");
var planck_http_fetch_1 = require("planck-http-fetch");
var Log_1 = require("./Log");
var MERTIC_INTERVAL_S = 60, HOLD_PERIOD_M = 30, ALIVE_MAX_CONSECUTIVE_TESTS = 6, ALIVE_CONSECUTIVE_TIMEOUT_S = 600, LOGS = ["pm_err_log_path", "pm_out_log_path"], OP = {
    "<": function (a, b, t) { return a < b && Math.abs(a - b) > t; },
    ">": function (a, b, t) { return a > b && Math.abs(a - b) > t; },
    "=": function (a, b, t) { return a === b; },
    "~": function (a, b, t) { return Math.abs(a - b) > t; },
    "<=": function (a, b, t) { return a <= b; },
    ">=": function (a, b, t) { return a >= b; },
    "!=": function (a, b, t) { return a !== b; },
    "!~": function (a, b, t) { return Math.abs(a - b) > t; }
}, CONFIG_KEYS = ["events", "metric", "exceptions", "messages", "messageExcludeExps", "eventExcludeExps", "appsExcluded", "metricIntervalS", "addLogs", "aliveTimeoutS"];
var Health = /** @class */ (function () {
    function Health(_config) {
        this._config = _config;
        this._holdTill = null;
        this._timeouts = new Map();
        if (this._config.metricIntervalS == null || this._config.metricIntervalS < MERTIC_INTERVAL_S) {
            Log_1.info("setting default metric check interval " + MERTIC_INTERVAL_S + " s.");
            this._config.metricIntervalS = MERTIC_INTERVAL_S;
        }
        if (!this._config.metric)
            this._config.metric = {};
        this._mail = new Mail_1.Mail(_config);
        this._snapshot = new Snapshot_1.Snapshot(this._config);
    }
    Health.prototype.fetchConfig = function () {
        return __awaiter(this, void 0, void 0, function () {
            var fetch_1, json, config, _i, CONFIG_KEYS_1, key, ex_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        Log_1.info("fetching config from [" + this._config.webConfig.url + "]");
                        fetch_1 = new planck_http_fetch_1.Fetch(this._config.webConfig.url);
                        if (this._config.webConfig.auth && this._config.webConfig.auth.user) // auth
                            fetch_1.basicAuth(this._config.webConfig.auth.user, this._config.webConfig.auth.password);
                        return [4 /*yield*/, fetch_1.fetch()];
                    case 1:
                        json = _a.sent(), config = JSON.parse(json);
                        // map config keys
                        for (_i = 0, CONFIG_KEYS_1 = CONFIG_KEYS; _i < CONFIG_KEYS_1.length; _i++) {
                            key = CONFIG_KEYS_1[_i];
                            if (config[key]) {
                                this._config[key] = config[key];
                                Log_1.info("applying [" + key + "]");
                            }
                        }
                        this.configChanged();
                        return [3 /*break*/, 3];
                    case 2:
                        ex_1 = _a.sent();
                        Log_1.error("failed to fetch config -> " + (ex_1.message || ex_1));
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    Health.prototype.configChanged = function () {
        this._messageExcludeExps = [];
        if (Array.isArray(this._config.messageExcludeExps))
            this._messageExcludeExps = this._config.messageExcludeExps.map(function (e) { return new RegExp(e); });
        this._eventExcludeExps = [];
        if (Array.isArray(this._config.eventExcludeExps))
            this._eventExcludeExps = this._config.eventExcludeExps.map(function (e) { return new RegExp(e); });
    };
    Health.prototype.isAppIncluded = function (app) {
        if (app === "pm2-health")
            return false;
        if (Array.isArray(this._config.appsIncluded))
            return this._config.appsIncluded.includes(app);
        if (Array.isArray(this._config.appsExcluded))
            return !this._config.appsExcluded.includes(app);
        return false;
    };
    Health.prototype.go = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        Log_1.info("pm2-health is on");
                        this.configChanged();
                        if (!(this._config.webConfig && this._config.webConfig.url)) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.fetchConfig()];
                    case 1:
                        _a.sent();
                        if (this._config.webConfig.fetchIntervalM > 0)
                            setInterval(function () {
                                _this.fetchConfig();
                            }, this._config.webConfig.fetchIntervalM * 60 * 1000);
                        _a.label = 2;
                    case 2:
                        PM2.connect(function (ex) {
                            stopIfEx(ex);
                            PM2.launchBus(function (ex, bus) {
                                stopIfEx(ex);
                                bus.on("process:event", function (data) {
                                    if (data.manually || !_this.isAppIncluded(data.process.name))
                                        return;
                                    if (Array.isArray(_this._config.events) && _this._config.events.indexOf(data.event) === -1)
                                        return;
                                    var json = JSON.stringify(data, undefined, 4);
                                    if (_this._eventExcludeExps.some(function (e) { return e.test(json); }))
                                        return; // exclude
                                    _this.mail(data.process.name + ":" + data.process.pm_id + " - " + data.event, "\n                        <p>App: <b>" + data.process.name + ":" + data.process.pm_id + "</b></p>\n                        <p>Event: <b>" + data.event + "</b></p>\n                        <pre>" + JSON.stringify(data, undefined, 4) + "</pre>", "high", LOGS.filter(function (e) { return _this._config.addLogs === true && data.process[e]; }).map(function (e) { return ({ filename: path_1.basename(data.process[e]), path: data.process[e] }); }));
                                });
                                if (_this._config.exceptions)
                                    bus.on("process:exception", function (data) {
                                        if (!_this.isAppIncluded(data.process.name))
                                            return;
                                        _this.mail(data.process.name + ":" + data.process.pm_id + " - exception", "\n                            <p>App: <b>" + data.process.name + ":" + data.process.pm_id + "</b></p>                            \n                            <pre>" + JSON.stringify(data.data, undefined, 4) + "</pre>", "high");
                                    });
                                if (_this._config.messages)
                                    bus.on("process:msg", function (data) {
                                        if (!_this.isAppIncluded(data.process.name))
                                            return;
                                        if (data.data === "alive") {
                                            _this.aliveReset(data.process, _this._config.aliveTimeoutS);
                                            return;
                                        }
                                        var json = JSON.stringify(data.data, undefined, 4);
                                        if (_this._messageExcludeExps.some(function (e) { return e.test(json); }))
                                            return; // exclude
                                        _this.mail(data.process.name + ":" + data.process.pm_id + " - message", "\n                            <p>App: <b>" + data.process.name + ":" + data.process.pm_id + "</b></p>\n                            <pre>" + json + "</pre>");
                                    });
                            });
                            _this.testProbes();
                        });
                        Pmx.action("hold", function (p, reply) {
                            var t = HOLD_PERIOD_M;
                            if (p) {
                                var n = Number.parseInt(p);
                                if (!Number.isNaN(n))
                                    t = n;
                            }
                            _this._holdTill = new Date();
                            _this._holdTill.setTime(_this._holdTill.getTime() + t * 60000);
                            var msg = "mail held for " + t + " minutes, till " + _this._holdTill.toISOString();
                            Log_1.info(msg);
                            reply(msg);
                        });
                        Pmx.action("unheld", function (reply) {
                            _this._holdTill = null;
                            reply("mail unheld");
                        });
                        Pmx.action("mail", function (reply) { return __awaiter(_this, void 0, void 0, function () {
                            var ex_2;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        _a.trys.push([0, 2, , 3]);
                                        return [4 /*yield*/, this._mail.send("Test only", "This is test only.")];
                                    case 1:
                                        _a.sent();
                                        reply("mail send");
                                        return [3 /*break*/, 3];
                                    case 2:
                                        ex_2 = _a.sent();
                                        reply("mail failed: " + (ex_2.message || ex_2));
                                        return [3 /*break*/, 3];
                                    case 3: return [2 /*return*/];
                                }
                            });
                        }); });
                        Pmx.action("dump", function (reply) {
                            _this._snapshot.dump();
                            reply("dumping");
                        });
                        // for dev. only
                        Pmx.action("debug", function (reply) {
                            PM2.list(function (ex, list) {
                                stopIfEx(ex);
                                Fs.writeFileSync("pm2-health-debug.json", JSON.stringify(list));
                                Fs.writeFileSync("pm2-health-config.json", JSON.stringify(_this._config));
                                reply("dumping");
                            });
                        });
                        return [2 /*return*/];
                }
            });
        });
    };
    Health.prototype.aliveReset = function (process, timeoutS, count) {
        var _this = this;
        if (count === void 0) { count = 1; }
        clearTimeout(this._timeouts.get(process.name));
        this._timeouts.set(process.name, setTimeout(function () {
            Log_1.info("death " + process.name + ":" + process.pm_id + ", count " + count);
            _this.mail(process.name + ":" + process.pm_id + " - is death!", "\n                    <p>App: <b>" + process.name + ":" + process.pm_id + "</b></p>\n                    <p>This is <b>" + count + "/" + ALIVE_MAX_CONSECUTIVE_TESTS + "</b> consecutive notice.</p>", "high");
            if (count < ALIVE_MAX_CONSECUTIVE_TESTS)
                _this.aliveReset(process, ALIVE_CONSECUTIVE_TIMEOUT_S, count + 1);
        }, timeoutS * 1000));
    };
    Health.prototype.mail = function (subject, body, priority, attachements) {
        if (attachements === void 0) { attachements = []; }
        return __awaiter(this, void 0, void 0, function () {
            var t, ex_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        t = new Date();
                        if (this._holdTill != null && t < this._holdTill)
                            return [2 /*return*/]; // skip
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this._mail.send(subject, body, priority, attachements)];
                    case 2:
                        _a.sent();
                        Log_1.info("mail [" + subject + "] sent");
                        return [3 /*break*/, 4];
                    case 3:
                        ex_3 = _a.sent();
                        Log_1.error("mail failed -> " + (ex_3.message || ex_3));
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    Health.prototype.testProbes = function () {
        var _this = this;
        var alerts = [];
        PM2.list(function (ex, list) { return __awaiter(_this, void 0, void 0, function () {
            var _i, list_1, app, monit, _a, _b, key, probe, v, bad, data;
            var _this = this;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        stopIfEx(ex);
                        for (_i = 0, list_1 = list; _i < list_1.length; _i++) {
                            app = list_1[_i];
                            if (!this.isAppIncluded(app.name))
                                continue;
                            monit = app.pm2_env["axm_monitor"];
                            if (!monit)
                                monit = {};
                            // add memory + cpu metrics
                            if (app.monit) {
                                monit["memory"] = { value: app.monit.memory / 1048576 };
                                monit["cpu"] = { value: app.monit.cpu };
                            }
                            if (app.pm2_env) {
                                if (app.pm2_env["_pm2_version"])
                                    monit["pm2"] = { value: app.pm2_env["_pm2_version"], direct: true };
                                if (app.pm2_env["node_version"])
                                    monit["node"] = { value: app.pm2_env["node_version"], direct: true };
                            }
                            for (_a = 0, _b = Object.keys(monit); _a < _b.length; _a++) {
                                key = _b[_a];
                                probe = this._config.metric[key];
                                if (!probe)
                                    probe = { noNotify: true, direct: monit[key].direct === true, noHistory: monit[key].direct === true };
                                if (probe.exclude === true)
                                    continue;
                                v = monit[key].value, bad = void 0;
                                if (!probe.direct) {
                                    v = Number.parseFloat(v);
                                    if (Number.isNaN(v)) {
                                        Log_1.error("monit [" + app.name + "." + key + "] -> [" + monit[key].value + "] is not a number");
                                        continue;
                                    }
                                }
                                if (probe.op && probe.op in OP && probe.target != null)
                                    bad = OP[probe.op](v, probe.target, probe.tolerance || 0);
                                // test
                                if (probe.noNotify !== true && bad === true && (probe.ifChanged !== true || this._snapshot.last(app.pm_id, key) !== v))
                                    alerts.push("<tr><td>" + app.name + ":" + app.pm_id + "</td><td>" + key + "</td><td>" + v + "</td><td>" + this._snapshot.last(app.pm_id, key) + "</td><td>" + probe.target + "</td></tr>");
                                data = { v: v };
                                if (bad) // safe space by not storing false
                                    data.bad = true;
                                this._snapshot.push(app.pm_id, app.name, key, !probe.noHistory, data);
                            }
                        }
                        this._snapshot.inactivate();
                        return [4 /*yield*/, this._snapshot.send()];
                    case 1:
                        _c.sent();
                        if (alerts.length > 0)
                            this.mail(alerts.length + " alert(s)", "\n                    <table>\n                        <tr>\n                            <th>App</th><th>Metric</th><th>Value</th><th>Prev. Value</th><th>Target</th>\n                        </tr>\n                        " + alerts.join("") + "\n                    </table>", "high");
                        setTimeout(function () { _this.testProbes(); }, 1000 * this._config.metricIntervalS);
                        return [2 /*return*/];
                }
            });
        }); });
    };
    return Health;
}());
exports.Health = Health;
function stopIfEx(ex) {
    if (ex) {
        console.error(ex.message || ex);
        PM2.disconnect();
        process.exit(1);
    }
}
exports.stopIfEx = stopIfEx;
