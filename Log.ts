export function info(text: string) {
    console.log(`${new Date().toISOString()}: ${text}`);
}

export function error(text: string) {
    console.error(`${new Date().toISOString()}: ${text}`);
}