# pm2-health
This [PM2](http://pm2.keymetrics.io/) module is:
* Monitoring events (like app crash, restarts etc.)
* Monitoring PMX metrics of your apps and send alerts when value hits treshold
* Sending mail notifications

## Installation

`pm2 install pankleks/pm2-health`

## Configuration

After installation, find `pm2-health` section in `module_conf.json` file in PM2 home folder (typically `~/.pm2/`)

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
`smtp` - SMTP server configuration. If your SMTP doesn't require authentication, leave `smtp.user` field empty

`mailTo` - comma separated list of notification receipients

`replyTo` - reply to address (optional)

`events` - list of events to monitor (optional) - if not set, all events will be monitored

`probeIntervalM` - how often PMX metrics will be tested [in minutes] (optional) - if not set, 1 minute is used

> if any of required parameters are not defined, `pm2-health` will shutdown. You can check error logs for details.

## Metrics monitoring

`pm2-health` can monitor any PMX metrics defined in your apps.

To configure metrics probes, create `Probes.js` or copy [Samples/Probes.js](./Samples/Probes.js) file into `pm2-health` module folder (typically `~/.pm2/node_modules/pm2-health`)

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

> After changing `Probes.js` file, please do `pm2 restart pm2-health`

> Learn how to define PMX probes for your apps here: http://pm2.keymetrics.io/docs/usage/process-metrics/

## Mail template

Mail uses HTML format. To adjust template, create `Template.html` or copy [Samples/Template.html](./Samples/Template.html) file into `pm2-health` module folder (typically `~/.pm2/node_modules/pm2-health`)

`<!-- body -->` will be exchanged with actual message body.

`<!-- timeStamp -->` will be exchanged with event timestamp (UTC).

## Holding notifications temporarily

To hold mail notification for 30 minutes execute command:

`pm2 trigger pm2-health hold`

After 30 minutes, notifications will start automatically. It's usefull during planned maintanance.

## Building

`pm2-health` is written using TypeScript with ES2017 target. 

ES2017 is supported by Node 8+, if you need to use ealier version of Node, please build solution using different target in `tsconfig.json`.