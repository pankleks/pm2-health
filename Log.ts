export function info(text: string) {
    console.log(`i-${new Date().toISOString()}: ${text}`);
}

export function error(text: string) {
    console.error(`${new Date().toISOString()}: ${text}`);
}

export let debug = (text: string) => { };

export function enableDebugLog() {
    debug = (text: string) => {
        console.log(`d-${new Date().toISOString()}: ${text}`);
    };

    debug("debug log enabled in config");
}