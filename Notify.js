"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Mail_1 = require("./Mail");
const Log_1 = require("./Log");
// todo: add messages persistance in case of crash
class Notify {
    constructor(_config) {
        this._config = _config;
        this._holdTill = null;
        this._messages = [];
        this._mail = new Mail_1.Mail(this._config);
    }
    get isEnabled() {
        return this._config.batchPeriodM > 0;
    }
    configChanged() {
        this._mail.configChanged();
        clearInterval(this._t);
        if (this.isEnabled) {
            Log_1.debug(`message batching is enabled, period = ${this._config.batchPeriodM} minutes`);
            this._t = setInterval(async () => {
                if (this._messages.length > 0)
                    await this.sendBatch();
            }, this._config.batchPeriodM * 60 * 1000);
        }
    }
    hold(till) {
        this._holdTill = till;
    }
    async sendBatch() {
        const snapshot = this._messages.slice(); // make snapshot of messages
        this._messages = [];
        let body = "", i = 1;
        for (const message of snapshot)
            body += `-------- ${i++} | ${message.subject} | ${message.on.toISOString()} --------<br/>${message.body}`;
        const temp = {
            subject: `${snapshot[0].subject} (${snapshot.length} items)`,
            body,
            attachements: snapshot.filter(e => e.attachements != null).map(e => e.attachements).reduce((p, c) => p.concat(c), [])
        };
        try {
            await this._mail.send(temp);
            Log_1.debug(`batch of ${snapshot.length} messages sent`);
        }
        catch (ex) {
            // restore messages if sent fail
            this._messages.unshift(...snapshot);
            Log_1.error(`can't send batch mail -> ${ex.message || ex}`);
        }
    }
    async send(message) {
        const t = new Date();
        message.on = t;
        if (this._holdTill != null && t < this._holdTill)
            return; // skip
        if (this.isEnabled && message.priority !== "high") {
            Log_1.debug(`message (batch) -> ${message.subject}`);
            this._messages.push(message);
            if (this._config.batchMaxMessages > 0 && this._messages.length >= this._config.batchMaxMessages)
                await this.sendBatch();
        }
        else {
            Log_1.debug(`message -> ${message.subject}`);
            try {
                await this._mail.send(message);
            }
            catch (ex) {
                Log_1.error(`can't send mail -> ${ex.message || ex}`);
            }
        }
    }
}
exports.Notify = Notify;
//# sourceMappingURL=Notify.js.map