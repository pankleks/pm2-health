# pm2-health
Apps health monitor and mail notification module for pm2

It can:
* Monitor events (like app crash, restart etc.) and send mail with logs as attachement
* Monitor PMX probes send mail alerts when value hits treshold

## Configuration

```json
"smtp": {
  "host": "",
  "port": 587,
  "user": "",
  "password": ""
},
"mailTo": "",
"replyTo": "",
"events": [
  "exit"
],
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

In `Probes.js` file you can define which probes should be monitored, and what triggers an alert.

```js
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
```

`target` - target value for probe
`fn` - function to compare current value and target, should return `true` to trigger an alert
`ifChanged` - if set to `true`, alert will fire only if probe value has changed (optional)

> All alerts are grouped in single mail

> Since build-in PMX probe alerting settings are used only by https://keymetrics.io/, they are ignored by `pm2-health`

To learn how to define PMX probes for your app see: http://pm2.keymetrics.io/docs/usage/process-metrics/

## Mail template

Mail is send in HTML format, you can adjust template in `Template.html` file.

Just place `<!-- body -->` inside HTML where mail body should be pasted.

## Holding notifications temporarily

To hold mail notification for 30 minutes execute command:

`pm2 trigger pm2-health hold`

After 30 minutes, notifications will start automatically. It's usefull during planned maintanance.

## Building

`pm2-health` is written using TypeScript with ES2017 target. 

ES2017 is supported by Node 8+, if you need to use ealier version of Node, please build solution using different target in `tsconfig.json`. 

Also in `Probes.js`, use `function` instead `=>` syntax.