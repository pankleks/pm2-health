# pm2-health
This [PM2](http://pm2.keymetrics.io/) module is:
* Monitoring events (like app exit, restart etc.)
* Monitoring app exceptions
* Monitoring PMX metrics of your apps and send alerts when value hits treshold
* Sending mail notifications

## Installation

`pm2 install pm2-health`

## Configuration

After installation run `pm2 conf` to configure module. Alternatively edit `module_conf.json` file directly (in PM2 home folder).

```json
"pm2-health": {
    "smtp": {
        "host": "your-smtp-host",
        "port": 587,
        "user": "your-smtp-user",
        "password": "your-smtp-password"
    },
    "mailTo": "mail1,mail2",
    "replyTo": "",
    "events": ["exit"],
    "probes": {
        "execution / min": {
            "target": 0.5,
            "op": "<="
        },
        "failed execution count": {
            "target": 0,
            "op": ">"
        }
    },
    "probeIntervalM": 1,
    "addLogs": true
}
```
`smtp` - SMTP server configuration. If your SMTP doesn't require auth, leave `smtp.user` empty

`mailTo` - comma separated list of notification receipients

`replyTo` - reply to address (optional)

`events` - list of events to monitor (optional). If not set, all events will be monitored. 

> Manually triggered events will not send notification.

`exceptions` - if `true` apps exceptions will be monitored (optional)

`messages` - if `true` apps custom messages will be monitored (optional). See [Custom messages](#custom-messages)

`classes` - list of message classes to monitor (optional). See [Custom messages](#custom-messages)

`probes` - object describing PMX metrics to be monitored (optional). See [Metrics monitoring](#metrics-monitoring)

`probeIntervalM` - how often PMX metrics will be tested in minutes (optional). If not set, 1 minute is used

`addLogs` - if `true` app logs will be added as mail attachement (optional)

> if any of required parameters is not defined, `pm2-health` will shutdown. You can check error logs for details.

## Metrics monitoring

`pm2-health` can monitor any PMX metrics defined in your apps.

To configure rules of alerting, setup `probes` section in module config file.

```json
"probes": {
    "metric name": {
        "target": 0,
        "op": ">",
        "ifChanged": true,
        "disabled": false
    }    
}
```
`metric name` - name of metric defined in one of your apps

`target` - target numeric value

`op` - operator to compare metric value and target. Can be one of: `<`, `>`, `=`, `<=`, `>=`, `!=`

`ifChanged` - if `true`, alert will trigger only if current metric value is different from last recorded value (optional)

`disabled` - if `true`, metric won't be tested (optional)

> Learn how to define PMX probes in your apps here: http://pm2.keymetrics.io/docs/usage/process-metrics/

## Custom messages

On top of standard PM2 events, you can send custom messages from your apps.

To send message from your app use:
```javascript
process.send({
    type : "process:msg",    
    class: "new user",
    desc: "user " + name + " created",
    data : {
        ...
    }
});
```

`type` - must be `process:msg`

`class` - class of message (optional). Classes can be used to filter messages to monitor.

`desc` - some description (optional). If exist it will be used as mail subject.

`data` - object containing additional data (optional)

> Lean more here: http://pm2.keymetrics.io/docs/usage/pm2-api/#send-message-to-process

## Hold notifications temporarily

To hold mail notification: `pm2 trigger pm2-health hold`

> Notifications will restart automatically after 30 minutes.

To unhold immediatelly: `pm2 trigger pm2-health unhold`

> All monitoring processes continues, just mail notification is held

## Mail template

Mail uses HTML format. To adjust template, you can edit [Template.html](./Template.html)

`<!-- body -->` will be exchanged with actual message body.

`<!-- timeStamp -->` will be exchanged with event timestamp (UTC).

> `pm2-health` update will override your `Template.html`, so keep backup :blush:

## Testing mail

To send test mail: `pm2 trigger pm2-health mail`

## Building

`pm2-health` is written using TypeScript 2.6.1+ with `es2017` target. 

`es2017` is supported by Node 8+. If you need to use ealier version, build solution using `es5` or `es6` target.

> Solution includes VS Code settings for build and debug.