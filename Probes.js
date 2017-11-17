const probes = {
    "execution / min": {
        target: 0.5,
        fn: (v, t) => v <= t
    },
    "failed execution count": {
        target: 0,
        fn: (v, t) => v > t,
        ifChanged: true
    }
}

module.exports = probes;