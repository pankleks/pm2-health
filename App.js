"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Pmx = require("pmx");
const Health_1 = require("./Health");
Pmx.initModule({
    type: "generic",
    el: {
        probes: false,
        actions: true
    },
    block: {
        actions: true,
        cpu: true,
        mem: true
    }
}, async (ex, config) => {
    Health_1.stopIfEx(ex);
    try {
        await (new Health_1.Health(config)).go();
    }
    catch (ex) {
        Health_1.stopIfEx(ex);
    }
});
//# sourceMappingURL=App.js.map