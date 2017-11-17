const probes = {
    // pmx probe name
    "execution / min": {
        target: 0.5,    // target number value
        fn: function (v, t) {
            // v - current value
            // t - target
            return v <= t;  // return true to trigger an alert
        }
    },
    "failed execution count": {
        target: 0,
        fn: (v, t) => v > t,    // if Node allows, you can use arrow functions too
        ifChanged: true // if true, alert triggers only if value changed compared to previous reading
    }
}

// module exports (don't forget)
module.exports = probes;