import * as Pmx from "pmx";
import { stopIfEx, Health } from "./Health";

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
}, (ex, config) => {
    stopIfEx(ex);

    try {
        new Health(config).go();
    }
    catch (ex) {
        stopIfEx(ex);
    }
});

