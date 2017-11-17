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

### Probes monitoring

`pm2-health` can monitor any Pmx probe defined in apps you run with pm2.
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

To learn how to define probe for your app see: http://pm2.keymetrics.io/docs/usage/process-metrics/

### Mail template

Mail is send in HTML format, you can adjust template in `Template.html` file.

Just place `<!-- body -->` inside HTML where mail body should be pasted.
