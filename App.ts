import * as Pmx from "@pm2/io";
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
}, async (ex, config) => {
    stopIfEx(ex);

    try {
        await (new Health(config)).go();
    }
    catch (ex) {
        stopIfEx(ex);
    }
});

