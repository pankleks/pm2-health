# pm2-health
Apps health monitor and mail notification module for pm2

It can:
* Monitor events (like app crash, restart etc.) and send mail with logs as attachement
* Monitor PMX probes send mail alerts when value hits treshold

## Installation

`pm2 install pankleks/pm2-health`

## Configuration

```json
"smtp": {
    "host": "your-smtp-host",
    "port": 587,
    "user": "your-smtp-user",
    "password": "your-smtp-password"
},
"mailTo": "mail1,mail2",
"replyTo": "",
"events": ["exit"],
"probeIntervalM": 1
```
`smtp` - SMTP server configuration

`mailTo` - comma separated list of notification receipients

`replyTo` - reply to address (optional)

`events` - list of events to monitor (optional) - if not set, all events will be monitored

`probeIntervalM` - how often PMX probes should be tested [minutes] (optional) - if not set, 1 minute is used

> if any of required parameters are not defined, `pm2-health` will shutdown. You can check error logs for details.

## Probes monitoring

`pm2-health` can monitor any PMX probe defined in apps you run with pm2.

Assuming some of your apps define PMX probes named `execution / min` and `failed execution count` you can define alerting rules in `Probes.js`:

```js
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
```

* Use [Probes.js](./Samples/Probes.js) as starting point

* `Probes.js` file must be in PM2 home folder under `node_modules/pm2-health`

* After changing `Probes.js` file, please do `pm2 restart pm2-health`

* All alerts are grouped in single mail

* Since build-in PMX probe alerting settings are used only by https://keymetrics.io/, they are ignored by `pm2-health`

> Learn how to define PMX probes for your apps here: http://pm2.keymetrics.io/docs/usage/process-metrics/

## Mail template

Mail is send in HTML format, you can adjust template in `Template.html` file.

Just place `<!-- body -->` inside HTML where mail body should be pasted.

* Use [Template.html](./Samples/Template.html) as starting point

## Holding notifications temporarily

To hold mail notification for 30 minutes execute command:

`pm2 trigger pm2-health hold`

After 30 minutes, notifications will start automatically. It's usefull during planned maintanance.

## Building

`pm2-health` is written using TypeScript with ES2017 target. 

ES2017 is supported by Node 8+, if you need to use ealier version of Node, please build solution using different target in `tsconfig.json`. 

Also in `Probes.js`, use `function` instead `=>` syntax.